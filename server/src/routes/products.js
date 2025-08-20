const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Product = require('../models/Product');
const StoreConnection = require('../models/StoreConnection');

// Get all products for a user with pagination, filtering, and sorting
router.get('/', protect, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      marketplace = '',
      store = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status = ''
    } = req.query;

    // Build query filter
    const filter = { userId: req.user._id };
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { handle: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (marketplace) {
      filter.marketplace = marketplace;
    }
    
    if (store) {
      filter.storeConnectionId = store;
    }
    
    if (status) {
      filter.status = { $regex: status, $options: 'i' };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get products with pagination
    const [products, totalCount] = await Promise.all([
      Product.find(filter)
        .populate('storeConnectionId', 'storeName marketplaceType')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(filter)
    ]);

    // Get marketplace statistics
    const marketplaceStats = await Product.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: '$marketplace',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // Ensure products have both _id and id fields for frontend compatibility
    const formattedProducts = products.map(product => {
      const productObj = product.toObject ? product.toObject() : product;
      return {
        ...productObj,
        id: productObj._id.toString(),
        _id: productObj._id.toString()
      };
    });

    res.json({
      success: true,
      data: {
        products: formattedProducts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          limit: parseInt(limit),
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        },
        filters: {
          marketplaces: marketplaceStats.map(stat => ({
            marketplace: stat._id,
            count: stat.count
          }))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
});

// Get products for a specific store connection
router.get('/store/:connectionId', protect, async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    // Verify user owns the store connection
    const connection = await StoreConnection.findOne({
      _id: connectionId,
      userId: req.user._id
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Store connection not found'
      });
    }

    const products = await Product.find({ 
      userId: req.user._id,
      storeConnectionId: connectionId
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error fetching store products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch store products',
      error: error.message
    });
  }
});

// Sync products from a marketplace
router.post('/sync/:connectionId', protect, async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    // Verify user owns the store connection
    const connection = await StoreConnection.findOne({
      _id: connectionId,
      userId: req.user._id
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Store connection not found'
      });
    }

    // Sync products based on marketplace type
    const result = await syncProductsFromMarketplace(
      connection.marketplaceType,
      connection.credentials,
      req.user._id,
      connectionId
    );

    // Update connection metadata
    connection.lastSync = new Date();
    connection.syncStatus = 'completed';
    await connection.save();

    res.json({
      success: true,
      message: `Successfully synced ${result.totalProducts} products from ${connection.marketplaceType}`,
      data: {
        totalProducts: result.totalProducts,
        newProducts: result.newProducts,
        updatedProducts: result.updatedProducts
      }
    });

  } catch (error) {
    console.error('Error syncing products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync products',
      error: error.message
    });
  }
});

async function syncProductsFromMarketplace(type, credentials, userId, connectionId) {
  switch (type) {
    case 'shopify':
      return await syncShopifyProducts(credentials, userId, connectionId);
    default:
      throw new Error(`Product sync not implemented for ${type}`);
  }
}

async function syncShopifyProducts(credentials, userId, connectionId) {
  const { shop_url, access_token } = credentials;
  
  if (!shop_url || !access_token) {
    throw new Error('Shop URL and access token are required for Shopify sync');
  }

  // Extract store name from shop_url
  let storeName = shop_url;
  
  // Remove protocol if present
  storeName = storeName.replace(/^https?:\/\//, '');
  
  // Remove trailing slash if present
  storeName = storeName.replace(/\/$/, '');
  
  // Remove .myshopify.com if present
  storeName = storeName.replace(/\.myshopify\.com$/, '');
  
  console.log('Processed shop_url:', shop_url, '-> storeName:', storeName);

  try {
    let hasNextPage = true;
    let cursor = null;
    let totalProducts = 0;
    let newProducts = 0;
    let updatedProducts = 0;
    const apiUrl = `https://${storeName}.myshopify.com/admin/api/2023-10/graphql.json`;

    console.log('Starting Shopify sync for user:', userId, 'store:', storeName);

    while (hasNextPage) {
      const response = await queryShopifyGraphQL(apiUrl, access_token, cursor);
      const products = response.data.products.edges;
      
      console.log(`Retrieved ${products.length} products from Shopify`);
      
      for (const productEdge of products) {
        const syncResult = await saveShopifyProduct(productEdge.node, userId, connectionId);
        totalProducts++;
        if (syncResult.isNew) {
          newProducts++;
        } else {
          updatedProducts++;
        }
      }

      hasNextPage = response.data.products.pageInfo.hasNextPage;
      cursor = response.data.products.pageInfo.endCursor;
      
      console.log(`Synced ${totalProducts} products so far...`);
    }

    console.log(`Shopify sync completed. Total: ${totalProducts}, New: ${newProducts}, Updated: ${updatedProducts}`);
    return { success: true, totalProducts, newProducts, updatedProducts };
  } catch (error) {
    console.error('Error syncing Shopify products:', error);
    throw error;
  }
}

async function queryShopifyGraphQL(apiUrl, accessToken, cursor) {
  const query = `
    query GetProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges {
          node {
            id
            title
            handle
            description
            productType
            vendor
            tags
            status
            createdAt
            updatedAt
            images(first: 10) {
              edges {
                node {
                  id
                  url
                  altText
                }
              }
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  price
                  compareAtPrice
                  sku
                  inventoryQuantity
                  taxable
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const variables = {
    first: 50,
    after: cursor
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`Shopify API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data;
}

async function saveShopifyProduct(shopifyProduct, userId, connectionId) {
  try {
    // Find existing product by Shopify ID or title
    const existingProduct = await Product.findOne({
      userId: userId,
      $or: [
        { shopifyId: shopifyProduct.id },
        { 'platforms.platformId': shopifyProduct.id },
        { title: shopifyProduct.title, storeConnectionId: connectionId }
      ]
    });

    const shopifyPlatform = {
      platform: 'shopify',
      platformId: shopifyProduct.id,
      platformSku: shopifyProduct.handle,
      platformPrice: shopifyProduct.variants.edges[0]?.node.price ? parseFloat(shopifyProduct.variants.edges[0].node.price) : undefined,
      platformInventory: shopifyProduct.variants.edges.reduce((sum, edge) => sum + (edge.node.inventoryQuantity || 0), 0),
      platformStatus: shopifyProduct.status,
      lastSyncAt: new Date()
    };

    let isNew = false;

    if (existingProduct) {
      // Update existing product
      const platformIndex = existingProduct.platforms.findIndex(p => p.platform === 'shopify');
      
      if (platformIndex >= 0) {
        existingProduct.platforms[platformIndex] = shopifyPlatform;
      } else {
        existingProduct.platforms.push(shopifyPlatform);
      }

      // Update other fields
      if (!existingProduct.description && shopifyProduct.description) {
        existingProduct.description = shopifyProduct.description;
      }
      
      if (shopifyProduct.images.edges.length > 0 && existingProduct.images.length === 0) {
        existingProduct.images = shopifyProduct.images.edges.map(edge => ({
          shopifyId: edge.node.id,
          url: edge.node.url,
          altText: edge.node.altText || ''
        }));
      }

      existingProduct.shopifyId = shopifyProduct.id;
      existingProduct.handle = shopifyProduct.handle;
      existingProduct.shopifyUpdatedAt = new Date(shopifyProduct.updatedAt);
      existingProduct.lastSyncedAt = new Date();

      await existingProduct.save();
    } else {
      // Create new product
      isNew = true;
      const newProduct = new Product({
        userId,
        storeConnectionId: connectionId,
        title: shopifyProduct.title,
        description: shopifyProduct.description || '',
        price: shopifyProduct.variants.edges[0]?.node.price ? parseFloat(shopifyProduct.variants.edges[0].node.price) : 0,
        compareAtPrice: shopifyProduct.variants.edges[0]?.node.compareAtPrice ? parseFloat(shopifyProduct.variants.edges[0].node.compareAtPrice) : undefined,
        sku: shopifyProduct.handle,
        inventory: shopifyProduct.variants.edges.reduce((sum, edge) => sum + (edge.node.inventoryQuantity || 0), 0),
        vendor: shopifyProduct.vendor || '',
        productType: shopifyProduct.productType || '',
        tags: shopifyProduct.tags || [],
        images: shopifyProduct.images.edges.map(edge => ({
          shopifyId: edge.node.id,
          url: edge.node.url,
          altText: edge.node.altText || ''
        })),
        variants: shopifyProduct.variants.edges.map(edge => ({
          id: edge.node.id,
          shopifyId: edge.node.id,
          title: edge.node.title,
          price: edge.node.price || '0',
          compareAtPrice: edge.node.compareAtPrice || undefined,
          sku: edge.node.sku || '',
          inventory: edge.node.inventoryQuantity || 0,
          inventoryQuantity: edge.node.inventoryQuantity || 0
        })),
        platforms: [shopifyPlatform],
        status: 'active',
        shopifyId: shopifyProduct.id,
        handle: shopifyProduct.handle,
        shopifyCreatedAt: new Date(shopifyProduct.createdAt),
        shopifyUpdatedAt: new Date(shopifyProduct.updatedAt),
        // Legacy fields for backward compatibility
        marketplace: 'shopify',
        externalId: shopifyProduct.id,
        stock: shopifyProduct.variants.edges.reduce((sum, edge) => sum + (edge.node.inventoryQuantity || 0), 0),
        lastSyncedAt: new Date()
      });

      await newProduct.save();
    }

    console.log(`${isNew ? 'Created' : 'Updated'} product: ${shopifyProduct.title}`);
    return { isNew };
  } catch (error) {
    console.error(`Error saving product ${shopifyProduct.title}:`, error);
    throw error;
  }
}

// Get single product by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findOne({
      _id: id,
      userId: req.user._id
    }).populate('storeConnectionId', 'storeName marketplaceType credentials');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Generate platform availability data based on marketplace
    const platformData = {
      [product.marketplace]: {
        platformId: product.externalId,
        platformSku: product.sku,
        platformPrice: product.price,
        platformInventory: product.inventory,
        platformStatus: product.status,
        lastSyncAt: product.lastSyncedAt || product.updatedAt
      }
    };

    // Enhanced product object with additional fields for detail view
    const enhancedProduct = {
      ...product.toObject(),
      platforms: platformData,
      variants: product.variants || [],
      tags: product.tags || [],
      images: product.images || []
    };

    res.json({
      success: true,
      data: enhancedProduct
    });
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product details',
      error: error.message
    });
  }
});

module.exports = router;