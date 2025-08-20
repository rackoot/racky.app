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

// General opportunity categories
const OPPORTUNITY_CATEGORIES = [
  {
    id: 'pricing',
    name: 'Pricing',
    description: 'Price optimization and competitive analysis',
    icon: 'DollarSign',
    color: 'text-green-600 bg-green-100'
  },
  {
    id: 'description',
    name: 'Description',
    description: 'Product description improvements and SEO',
    icon: 'FileText',
    color: 'text-blue-600 bg-blue-100'
  },
  {
    id: 'images',
    name: 'Images',
    description: 'Image quality and additional photos needed',
    icon: 'Camera',
    color: 'text-purple-600 bg-purple-100'
  },
  {
    id: 'seo',
    name: 'SEO',
    description: 'Search optimization and keywords',
    icon: 'Search',
    color: 'text-orange-600 bg-orange-100'
  },
  {
    id: 'inventory',
    name: 'Inventory',
    description: 'Stock management and variants',
    icon: 'Package',
    color: 'text-red-600 bg-red-100'
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Promotional strategies and cross-selling',
    icon: 'Megaphone',
    color: 'text-pink-600 bg-pink-100'
  },
  {
    id: 'unconnected_marketplaces',
    name: 'Market Expansion',
    description: 'Opportunities on new marketplaces',
    icon: 'TrendingUp',
    color: 'text-indigo-600 bg-indigo-100'
  }
];

// Get marketplace by ID
const getMarketplaceById = (id) => {
  return SUPPORTED_MARKETPLACES.find(marketplace => marketplace.id === id);
};

// Get marketplace names only
const getMarketplaceNames = () => {
  return SUPPORTED_MARKETPLACES.map(marketplace => marketplace.name);
};

// Get marketplace IDs only
const getMarketplaceIds = () => {
  return SUPPORTED_MARKETPLACES.map(marketplace => marketplace.id);
};

// Get category by ID
const getCategoryById = (id) => {
  return OPPORTUNITY_CATEGORIES.find(category => category.id === id);
};

// Get all marketplace categories (for dynamic tabs)
const getMarketplaceCategories = () => {
  return SUPPORTED_MARKETPLACES.map(marketplace => ({
    id: marketplace.id,
    name: marketplace.name,
    description: `Opportunities specific to ${marketplace.name}`,
    icon: 'Store',
    color: 'text-gray-600 bg-gray-100',
    isMarketplace: true
  }));
};

module.exports = {
  SUPPORTED_MARKETPLACES,
  OPPORTUNITY_CATEGORIES,
  getMarketplaceById,
  getMarketplaceNames,
  getMarketplaceIds,
  getCategoryById,
  getMarketplaceCategories
};