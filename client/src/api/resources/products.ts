import { apiGet, apiPost } from '../client'
import { ENDPOINTS } from '../config'
import type { Product, ProductsResponse, ProductsQuery } from '../types/product'

/**
 * Get marketplace-specific product URL
 */
export const getMarketplaceProductUrl = (product: any) => {
  const { marketplace, externalId, handle, storeConnectionId } = product

  switch (marketplace) {
    case 'shopify':
      // For Shopify, use the actual shop_url from credentials
      if (storeConnectionId?.credentials?.shop_url && handle) {
        const shopUrl = storeConnectionId.credentials.shop_url
        // Remove protocol if present and ensure it ends with .myshopify.com
        const cleanShopUrl = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
        return `https://${cleanShopUrl}/products/${handle}`
      }
      return null
    case 'amazon':
      if (externalId) {
        return `https://www.amazon.com/dp/${externalId}`
      }
      return null
    case 'mercadolibre':
      if (externalId) {
        return `https://www.mercadolibre.com/item/${externalId}`
      }
      return null
    case 'vtex':
      // For VTEX, use the account_name from credentials
      if (storeConnectionId?.credentials?.account_name && handle) {
        const accountName = storeConnectionId.credentials.account_name
        return `https://${accountName}.vtexcommercestable.com.br/${handle}/p`
      }
      return null
    case 'woocommerce':
      // For WooCommerce, we'd need the actual domain from credentials
      if (storeConnectionId?.credentials?.site_url && handle) {
        const siteUrl = storeConnectionId.credentials.site_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
        return `https://${siteUrl}/product/${handle}`
      }
      return null
    case 'facebook_shop':
      return null // Facebook Shop URLs are complex and require specific page/shop IDs
    case 'google_shopping':
      return null // Google Shopping doesn't have direct product URLs
    default:
      return null
  }
}

export const productsApi = {
  /**
   * Get all products for a user with pagination and filtering
   */
  async getAllProducts(query: ProductsQuery = {}): Promise<ProductsResponse> {
    const searchParams = new URLSearchParams();
    
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, value.toString());
      }
    });
    
    const url = `${ENDPOINTS.PRODUCTS.LIST}?${searchParams.toString()}`
    return apiGet<ProductsResponse>(url)
  },

  /**
   * Get products for a specific store connection
   */
  async getStoreProducts(connectionId: string): Promise<Product[]> {
    return apiGet<Product[]>(ENDPOINTS.PRODUCTS.STORE_PRODUCTS(connectionId))
  },

  /**
   * Sync products from a marketplace
   */
  async syncProducts(connectionId: string, force: boolean = false): Promise<any> {
    return apiPost<any>(ENDPOINTS.PRODUCTS.SYNC(connectionId), { force })
  },

  /**
   * Check if products exist for a connection
   */
  async hasProducts(connectionId: string): Promise<{ hasProducts: boolean; count: number }> {
    return apiGet<{ hasProducts: boolean; count: number }>(ENDPOINTS.PRODUCTS.STORE_COUNT(connectionId))
  },

  /**
   * Get single product by ID
   */
  async getProductById(id: string): Promise<any> {
    return apiGet<any>(ENDPOINTS.PRODUCTS.GET(id))
  },

  /**
   * Resync a single product from its marketplace
   */
  async resyncProduct(id: string): Promise<any> {
    return apiPost<any>(`${ENDPOINTS.PRODUCTS.BASE}/${id}/resync`)
  },
}