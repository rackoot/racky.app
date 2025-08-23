import axios from 'axios';
import { SUPPORTED_MARKETPLACES } from '@/common/constants/marketplaces';
import { Marketplace } from '@/common/types/marketplace';
// Note: These imports may cause circular dependencies and should be handled carefully
// import StoreConnection from '../../stores/models/StoreConnection';
// import Product from '../../products/models/Product';

// Type definitions for marketplace service
export interface MarketplaceCredentials {
  [key: string]: string;
}

export interface MarketplaceTestResult {
  success: boolean;
  message: string;
  data?: Record<string, any>;
}

export interface ShopifyCredentials extends MarketplaceCredentials {
  shop_url: string;
  access_token: string;
}

export interface VtexCredentials extends MarketplaceCredentials {
  account_name: string;
  app_key: string;
  app_token: string;
}

export interface MercadoLibreCredentials extends MarketplaceCredentials {
  client_id: string;
  client_secret: string;
  access_token: string;
  user_id: string;
}

export interface AmazonCredentials extends MarketplaceCredentials {
  seller_id: string;
  marketplace_id: string;
  access_key: string;
  secret_key: string;
  region: string;
}

export interface FacebookShopCredentials extends MarketplaceCredentials {
  page_id: string;
  access_token: string;
}

export interface GoogleShoppingCredentials extends MarketplaceCredentials {
  merchant_id: string;
  client_email: string;
  private_key: string;
}

export interface WooCommerceCredentials extends MarketplaceCredentials {
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
}

export interface MarketplaceInfo {
  id: string;
  name: string;
  description: string;
  requiredCredentials: string[];
  documentationUrl: string;
}

export interface ConnectionInfo {
  connectionId: string;
  storeName: string;
  lastSync: Date | null;
  syncStatus: string;
  productsCount?: number;
}

export interface MarketplaceStatus {
  id: string;
  name: string;
  description: string;
  requiredCredentials: string[];
  documentationUrl: string;
  connectionInfo: ConnectionInfo | null;
}

// Service functions
const getAvailableMarketplaces = (): MarketplaceInfo[] => {
  return SUPPORTED_MARKETPLACES.map(marketplace => ({
    id: marketplace.id,
    name: marketplace.name,
    description: marketplace.description,
    requiredCredentials: marketplace.requiredCredentials,
    documentationUrl: marketplace.documentationUrl
  }));
};

const testShopifyConnection = async (credentials: ShopifyCredentials): Promise<MarketplaceTestResult> => {
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
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.errors || error.message || 'Shopify connection failed'
    };
  }
};

const testVtexConnection = async (credentials: VtexCredentials): Promise<MarketplaceTestResult> => {
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
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'VTEX connection failed'
    };
  }
};

const testMercadoLibreConnection = async (credentials: MercadoLibreCredentials): Promise<MarketplaceTestResult> => {
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
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'MercadoLibre connection failed'
    };
  }
};

const testAmazonConnection = async (credentials: AmazonCredentials): Promise<MarketplaceTestResult> => {
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
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Amazon connection failed'
    };
  }
};

const testFacebookShopConnection = async (credentials: FacebookShopCredentials): Promise<MarketplaceTestResult> => {
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
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error?.message || error.message || 'Facebook Shop connection failed'
    };
  }
};

const testGoogleShoppingConnection = async (credentials: GoogleShoppingCredentials): Promise<MarketplaceTestResult> => {
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
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Google Shopping connection failed'
    };
  }
};

const testWooCommerceConnection = async (credentials: WooCommerceCredentials): Promise<MarketplaceTestResult> => {
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
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'WooCommerce connection failed'
    };
  }
};

const testMarketplaceConnection = async (marketplaceType: string, credentials: MarketplaceCredentials): Promise<MarketplaceTestResult> => {
  switch (marketplaceType) {
    case 'shopify':
      return await testShopifyConnection(credentials as ShopifyCredentials);
    case 'vtex':
      return await testVtexConnection(credentials as VtexCredentials);
    case 'mercadolibre':
      return await testMercadoLibreConnection(credentials as MercadoLibreCredentials);
    case 'amazon':
      return await testAmazonConnection(credentials as AmazonCredentials);
    case 'facebook_shop':
      return await testFacebookShopConnection(credentials as FacebookShopCredentials);
    case 'google_shopping':
      return await testGoogleShoppingConnection(credentials as GoogleShoppingCredentials);
    case 'woocommerce':
      return await testWooCommerceConnection(credentials as WooCommerceCredentials);
    default:
      return {
        success: false,
        message: 'Unsupported marketplace type'
      };
  }
};

const getWorkspaceMarketplaceStatus = async (workspaceId: string): Promise<MarketplaceStatus[]> => {
  // Dynamic imports to avoid circular dependencies
  const { default: StoreConnection } = await import('../../stores/models/StoreConnection');
  const { default: Product } = await import('../../products/models/Product');
  
  try {
    const connections = await StoreConnection.find({ workspaceId });
    const connectedMarketplaces: { [key: string]: ConnectionInfo } = {};
    
    connections.forEach(connection => {
      connectedMarketplaces[connection.marketplaceType] = {
        connectionId: connection._id.toString(),
        storeName: connection.storeName,
        lastSync: connection.lastSync,
        syncStatus: connection.syncStatus
      };
    });
    
    // Get product counts for connected marketplaces
    const marketplaceStatuses = await Promise.all(
      SUPPORTED_MARKETPLACES.map(async marketplace => {
        const connectionInfo = connectedMarketplaces[marketplace.id];
        let productsCount = 0;
        
        if (connectionInfo) {
          // Count products for this marketplace and workspace
          productsCount = await Product.countDocuments({
            workspaceId,
            storeConnectionId: connectionInfo.connectionId
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
  } catch (error: any) {
    throw new Error('Failed to get marketplace status: ' + error.message);
  }
};

export {
  getAvailableMarketplaces,
  testMarketplaceConnection,
  getWorkspaceMarketplaceStatus,
  SUPPORTED_MARKETPLACES
};