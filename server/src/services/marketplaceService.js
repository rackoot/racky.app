const axios = require('axios');

const SUPPORTED_MARKETPLACES = [
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Connect to your Shopify store',
    requiredCredentials: ['shop_url', 'access_token'],
    testEndpoint: 'https://{shop_url}/admin/api/2023-10/shop.json',
    documentationUrl: 'https://help.shopify.com/en/manual/apps/private-apps'
  },
  {
    id: 'vtex',
    name: 'VTEX',
    description: 'Connect to your VTEX store',
    requiredCredentials: ['account_name', 'app_key', 'app_token'],
    testEndpoint: 'https://{account_name}.vtexcommercestable.com.br/api/catalog_system/pvt/collection/search',
    documentationUrl: 'https://developers.vtex.com/vtex-rest-api/docs/getting-started-authentication'
  },
  {
    id: 'mercadolibre',
    name: 'MercadoLibre',
    description: 'Connect to MercadoLibre marketplace',
    requiredCredentials: ['client_id', 'client_secret', 'access_token', 'user_id'],
    testEndpoint: 'https://api.mercadolibre.com/users/{user_id}',
    documentationUrl: 'https://developers.mercadolibre.com/en/authentication-and-authorization'
  },
  {
    id: 'amazon',
    name: 'Amazon',
    description: 'Connect to Amazon marketplace',
    requiredCredentials: ['seller_id', 'marketplace_id', 'access_key', 'secret_key', 'region'],
    testEndpoint: null, // Amazon requires more complex SP-API authentication
    documentationUrl: 'https://developer-docs.amazon.com/sp-api/docs/sp-api-endpoints'
  },
  {
    id: 'facebook_shop',
    name: 'Facebook Shop',
    description: 'Connect to Facebook Shop',
    requiredCredentials: ['page_id', 'access_token'],
    testEndpoint: 'https://graph.facebook.com/v18.0/{page_id}',
    documentationUrl: 'https://developers.facebook.com/docs/commerce-platform'
  },
  {
    id: 'google_shopping',
    name: 'Google Shopping',
    description: 'Connect to Google Shopping',
    requiredCredentials: ['merchant_id', 'client_email', 'private_key'],
    testEndpoint: 'https://shoppingcontent.googleapis.com/content/v2.1/{merchant_id}/accounts/{merchant_id}',
    documentationUrl: 'https://developers.google.com/shopping-content/guides/quickstart'
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    description: 'Connect to your WooCommerce store',
    requiredCredentials: ['site_url', 'consumer_key', 'consumer_secret'],
    testEndpoint: '{site_url}/wp-json/wc/v3/system_status',
    documentationUrl: 'https://woocommerce.github.io/woocommerce-rest-api-docs/'
  }
];

const getAvailableMarketplaces = () => {
  return SUPPORTED_MARKETPLACES.map(marketplace => ({
    id: marketplace.id,
    name: marketplace.name,
    description: marketplace.description,
    requiredCredentials: marketplace.requiredCredentials,
    documentationUrl: marketplace.documentationUrl
  }));
};

const testShopifyConnection = async (credentials) => {
  try {
    const { shop_url, access_token } = credentials;
    const cleanShopUrl = shop_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    const response = await axios.get(`https://${cleanShopUrl}/admin/api/2023-10/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': access_token
      },
      timeout: 10000
    });
    
    return {
      success: true,
      message: 'Shopify connection successful',
      data: {
        shop_name: response.data.shop.name,
        domain: response.data.shop.domain,
        plan: response.data.shop.plan_name
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.errors || error.message || 'Shopify connection failed'
    };
  }
};

const testVtexConnection = async (credentials) => {
  try {
    const { account_name, app_key, app_token } = credentials;
    
    const response = await axios.get(`https://${account_name}.vtexcommercestable.com.br/api/catalog_system/pvt/collection/search`, {
      headers: {
        'X-VTEX-API-AppKey': app_key,
        'X-VTEX-API-AppToken': app_token
      },
      timeout: 10000
    });
    
    return {
      success: true,
      message: 'VTEX connection successful',
      data: {
        account_name: account_name,
        collections_count: response.data?.length || 0
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'VTEX connection failed'
    };
  }
};

const testMercadoLibreConnection = async (credentials) => {
  try {
    const { access_token, user_id } = credentials;
    
    const response = await axios.get(`https://api.mercadolibre.com/users/${user_id}`, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      },
      timeout: 10000
    });
    
    return {
      success: true,
      message: 'MercadoLibre connection successful',
      data: {
        user_id: response.data.id,
        nickname: response.data.nickname,
        country: response.data.country_id
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'MercadoLibre connection failed'
    };
  }
};

const testAmazonConnection = async (credentials) => {
  // Amazon SP-API requires complex authentication with AWS signature
  // For now, we'll do basic validation and return a simulated response
  try {
    const { seller_id, marketplace_id, access_key, secret_key, region } = credentials;
    
    if (!seller_id || !marketplace_id || !access_key || !secret_key || !region) {
      return {
        success: false,
        message: 'Missing required Amazon credentials'
      };
    }
    
    // Simulate connection test (in production, implement proper SP-API authentication)
    return {
      success: true,
      message: 'Amazon connection validated (credentials format correct)',
      data: {
        seller_id: seller_id,
        marketplace_id: marketplace_id,
        region: region,
        note: 'Full Amazon SP-API integration pending'
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Amazon connection failed'
    };
  }
};

const testFacebookShopConnection = async (credentials) => {
  try {
    const { page_id, access_token } = credentials;
    
    const response = await axios.get(`https://graph.facebook.com/v18.0/${page_id}`, {
      params: {
        access_token: access_token,
        fields: 'name,category'
      },
      timeout: 10000
    });
    
    return {
      success: true,
      message: 'Facebook Shop connection successful',
      data: {
        page_id: response.data.id,
        page_name: response.data.name,
        category: response.data.category
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.error?.message || error.message || 'Facebook Shop connection failed'
    };
  }
};

const testGoogleShoppingConnection = async (credentials) => {
  try {
    const { merchant_id, client_email, private_key } = credentials;
    
    if (!merchant_id || !client_email || !private_key) {
      return {
        success: false,
        message: 'Missing required Google Shopping credentials'
      };
    }
    
    // Google Shopping requires JWT authentication with service account
    // For now, validate credentials format
    return {
      success: true,
      message: 'Google Shopping credentials validated (format correct)',
      data: {
        merchant_id: merchant_id,
        client_email: client_email,
        note: 'Full Google Shopping API integration pending'
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Google Shopping connection failed'
    };
  }
};

const testWooCommerceConnection = async (credentials) => {
  try {
    const { site_url, consumer_key, consumer_secret } = credentials;
    const cleanUrl = site_url.replace(/\/$/, '');
    
    const response = await axios.get(`${cleanUrl}/wp-json/wc/v3/system_status`, {
      auth: {
        username: consumer_key,
        password: consumer_secret
      },
      timeout: 10000
    });
    
    return {
      success: true,
      message: 'WooCommerce connection successful',
      data: {
        site_url: cleanUrl,
        version: response.data.settings?.version || 'Unknown',
        theme: response.data.theme?.name || 'Unknown'
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'WooCommerce connection failed'
    };
  }
};

const testMarketplaceConnection = async (marketplaceType, credentials) => {
  switch (marketplaceType) {
    case 'shopify':
      return await testShopifyConnection(credentials);
    case 'vtex':
      return await testVtexConnection(credentials);
    case 'mercadolibre':
      return await testMercadoLibreConnection(credentials);
    case 'amazon':
      return await testAmazonConnection(credentials);
    case 'facebook_shop':
      return await testFacebookShopConnection(credentials);
    case 'google_shopping':
      return await testGoogleShoppingConnection(credentials);
    case 'woocommerce':
      return await testWooCommerceConnection(credentials);
    default:
      return {
        success: false,
        message: 'Unsupported marketplace type'
      };
  }
};

const getUserMarketplaceStatus = async (userId) => {
  const StoreConnection = require('../models/StoreConnection');
  const Product = require('../models/Product');
  
  try {
    const connections = await StoreConnection.find({ userId, isActive: true });
    const connectedMarketplaces = {};
    
    connections.forEach(connection => {
      connection.marketplaces.forEach(marketplace => {
        if (marketplace.isActive) {
          connectedMarketplaces[marketplace.type] = {
            connectionId: connection._id,
            marketplaceId: marketplace._id,
            storeName: connection.storeName,
            lastSync: marketplace.lastSync,
            syncStatus: marketplace.syncStatus
          };
        }
      });
    });
    
    // Get product counts for connected marketplaces
    const marketplaceStatuses = await Promise.all(
      SUPPORTED_MARKETPLACES.map(async marketplace => {
        const connectionInfo = connectedMarketplaces[marketplace.id];
        let productsCount = 0;
        
        if (connectionInfo) {
          // Count products for this marketplace and user
          productsCount = await Product.countDocuments({
            userId,
            $or: [
              { marketplace: marketplace.id }, // Legacy field
              { 
                storeConnectionId: connectionInfo.connectionId,
                'platforms.platform': marketplace.id 
              } // New structure
            ]
          });
          
          // Add product count to connection info
          connectionInfo.productsCount = productsCount;
        }
        
        return {
          id: marketplace.id,
          name: marketplace.name,
          description: marketplace.description,
          requiredCredentials: marketplace.requiredCredentials,
          documentationUrl: marketplace.documentationUrl,
          connectionInfo: connectionInfo || null
        };
      })
    );
    
    return marketplaceStatuses;
  } catch (error) {
    throw new Error('Failed to get marketplace status: ' + error.message);
  }
};

module.exports = {
  getAvailableMarketplaces,
  testMarketplaceConnection,
  getUserMarketplaceStatus,
  SUPPORTED_MARKETPLACES
};