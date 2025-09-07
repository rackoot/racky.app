import axios from 'axios';

/**
 * Service for updating product descriptions in various marketplaces
 */

export interface MarketplaceUpdateResult {
  success: boolean;
  message: string;
}

export async function updateProductDescriptionInMarketplace(
  marketplace: string, 
  product: any, 
  description: string, 
  storeConnection: any
): Promise<MarketplaceUpdateResult> {
  const { credentials } = storeConnection;
  
  switch (marketplace) {
    case 'shopify':
      return await updateShopifyProductDescription(product, description, credentials);
    case 'woocommerce':
      return await updateWooCommerceProductDescription(product, description, credentials);
    case 'vtex':
      return await updateVtexProductDescription(product, description, credentials);
    case 'mercadolibre':
      return await updateMercadoLibreProductDescription(product, description, credentials);
    case 'facebook_shop':
      return await updateFacebookShopProductDescription(product, description, credentials);
    default:
      return {
        success: false,
        message: `Marketplace updates not yet implemented for ${marketplace}`
      };
  }
}

// Shopify product description update
async function updateShopifyProductDescription(
  product: any, 
  description: string, 
  credentials: any
): Promise<MarketplaceUpdateResult> {
  try {
    const { shop_url, access_token } = credentials;
    const cleanShopUrl = shop_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Extract numeric ID from GraphQL ID
    let productId = product.externalId || product.shopifyId;
    if (productId && productId.includes('gid://shopify/Product/')) {
      productId = productId.replace('gid://shopify/Product/', '');
    }
    
    console.log(`[Shopify] Updating product ${productId} with new description`);
    
    const response = await axios.put(
      `https://${cleanShopUrl}/admin/api/2023-10/products/${productId}.json`,
      {
        product: {
          body_html: description
        }
      },
      {
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    return {
      success: true,
      message: 'Shopify product description updated successfully'
    };
  } catch (error: any) {
    console.error('[Shopify] Update error:', error.response?.data || error.message);
    return {
      success: false,
      message: `Shopify update failed: ${error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message}`
    };
  }
}

// WooCommerce product description update
async function updateWooCommerceProductDescription(
  product: any, 
  description: string, 
  credentials: any
): Promise<MarketplaceUpdateResult> {
  try {
    const { site_url, consumer_key, consumer_secret } = credentials;
    const cleanUrl = site_url.replace(/\/$/, '');
    
    let productId = product.externalId;
    
    const response = await axios.put(
      `${cleanUrl}/wp-json/wc/v3/products/${productId}`,
      {
        description: description
      },
      {
        auth: {
          username: consumer_key,
          password: consumer_secret
        },
        timeout: 30000
      }
    );

    return {
      success: true,
      message: 'WooCommerce product description updated successfully'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `WooCommerce update failed: ${error.response?.data?.message || error.message}`
    };
  }
}

// VTEX product description update
async function updateVtexProductDescription(
  product: any, 
  description: string, 
  credentials: any
): Promise<MarketplaceUpdateResult> {
  try {
    const { account_name, app_key, app_token } = credentials;
    
    let productId = product.externalId;
    
    const response = await axios.put(
      `https://${account_name}.vtexcommercestable.com.br/api/catalog/pvt/product/${productId}`,
      {
        Description: description
      },
      {
        headers: {
          'X-VTEX-API-AppKey': app_key,
          'X-VTEX-API-AppToken': app_token,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    return {
      success: true,
      message: 'VTEX product description updated successfully'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `VTEX update failed: ${error.response?.data?.message || error.message}`
    };
  }
}

// MercadoLibre product description update
async function updateMercadoLibreProductDescription(
  product: any, 
  description: string, 
  credentials: any
): Promise<MarketplaceUpdateResult> {
  try {
    const { access_token } = credentials;
    
    let productId = product.externalId;
    
    const response = await axios.put(
      `https://api.mercadolibre.com/items/${productId}`,
      {
        description: {
          plain_text: description
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    return {
      success: true,
      message: 'MercadoLibre product description updated successfully'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `MercadoLibre update failed: ${error.response?.data?.message || error.message}`
    };
  }
}

// Facebook Shop product description update
async function updateFacebookShopProductDescription(
  product: any, 
  description: string, 
  credentials: any
): Promise<MarketplaceUpdateResult> {
  try {
    const { page_id, access_token } = credentials;
    
    let productId = product.externalId;
    
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${productId}`,
      {
        description: description,
        access_token: access_token
      },
      {
        timeout: 30000
      }
    );

    return {
      success: true,
      message: 'Facebook Shop product description updated successfully'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Facebook Shop update failed: ${error.response?.data?.error?.message || error.message}`
    };
  }
}