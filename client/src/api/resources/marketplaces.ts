import { apiGet, apiPost, apiPut, apiDelete } from '../client'
import apiClient from '../client'
import { ENDPOINTS } from '../config'
import axios from 'axios'
import type {
  Marketplace,
  TestConnectionResponse,
  ConnectMarketplaceRequest,
  MarketplaceCredentials
} from '../types/marketplace'
import type {
  CategoryFilter,
  BrandFilter,
  MarketplaceFiltersResponse
} from '@/types/sync'

export const marketplacesApi = {
  /**
   * Get all available marketplaces
   */
  async getMarketplaces(): Promise<Marketplace[]> {
    return apiGet<Marketplace[]>(ENDPOINTS.MARKETPLACES.LIST)
  },

  /**
   * Get marketplace status (connected/disconnected)
   */
  async getMarketplaceStatus(): Promise<Marketplace[]> {
    return apiGet<Marketplace[]>(ENDPOINTS.MARKETPLACES.STATUS)
  },

  /**
   * Test marketplace connection
   */
  async testConnection(type: string, credentials: MarketplaceCredentials): Promise<TestConnectionResponse> {
    // Special handling for test connection - we need the full response with success/message
    try {
      const response = await apiClient.post(ENDPOINTS.MARKETPLACES.TEST, { type, credentials })
      
      // Return the full response data instead of just the nested data
      return {
        success: response.data.success,
        message: response.data.message,
        data: response.data.data
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          message: error.response.data?.message || `HTTP ${error.response.status}: ${error.response.statusText}`,
          data: null
        }
      }
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
        data: null
      }
    }
  },

  /**
   * Connect marketplace to existing store
   */
  async connectToStore(request: ConnectMarketplaceRequest): Promise<any> {
    return apiPost<any>(ENDPOINTS.MARKETPLACES.CONNECT, request)
  },

  /**
   * Create new store with marketplace
   */
  async createStoreWithMarketplace(request: ConnectMarketplaceRequest): Promise<any> {
    return apiPost<any>(ENDPOINTS.MARKETPLACES.CREATE_STORE, request)
  },

  /**
   * Test existing marketplace connection
   */
  async testExistingConnection(connectionId: string): Promise<any> {
    return apiPut<any>(ENDPOINTS.MARKETPLACES.TEST_CONNECTION(connectionId))
  },

  /**
   * Toggle marketplace status
   */
  async toggleMarketplaceStatus(connectionId: string): Promise<any> {
    return apiPut<any>(ENDPOINTS.MARKETPLACES.TOGGLE(connectionId))
  },

  /**
   * Disconnect marketplace from store
   */
  async disconnectMarketplace(connectionId: string, deleteProducts: boolean = false): Promise<any> {
    const url = `${ENDPOINTS.CONNECTIONS.DELETE(connectionId)}?deleteProducts=${deleteProducts}`
    return apiDelete<any>(url)
  },

  // ========================================
  // MARKETPLACE FILTERS (For Sync)
  // ========================================

  /**
   * Get categories/product types for a marketplace connection
   * Used for filtering products before sync
   *
   * @param connectionId - Store connection ID
   * @param includeCount - Whether to include product counts (cached for 24h)
   * @returns Array of categories with name, value, and optional productCount
   */
  async getCategories(
    connectionId: string,
    includeCount: boolean = true
  ): Promise<CategoryFilter[]> {
    const url = includeCount
      ? `${ENDPOINTS.MARKETPLACES.CATEGORIES(connectionId)}?includeCount=true`
      : ENDPOINTS.MARKETPLACES.CATEGORIES(connectionId)

    const response = await apiGet<MarketplaceFiltersResponse['data']>(url)
    return response.items as CategoryFilter[]
  },

  /**
   * Get brands/vendors for a marketplace connection
   * Used for filtering products before sync
   *
   * @param connectionId - Store connection ID
   * @param includeCount - Whether to include product counts (cached for 24h)
   * @returns Array of brands with name, value, and optional productCount
   */
  async getBrands(
    connectionId: string,
    includeCount: boolean = true
  ): Promise<BrandFilter[]> {
    const url = includeCount
      ? `${ENDPOINTS.MARKETPLACES.BRANDS(connectionId)}?includeCount=true`
      : ENDPOINTS.MARKETPLACES.BRANDS(connectionId)

    const response = await apiGet<MarketplaceFiltersResponse['data']>(url)
    return response.items as BrandFilter[]
  },
}