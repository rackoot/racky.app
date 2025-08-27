import { apiGet, apiPost, apiPut, apiDelete } from './client'
import { ENDPOINTS } from './config'
import type { 
  Marketplace, 
  TestConnectionResponse, 
  ConnectMarketplaceRequest, 
  MarketplaceCredentials 
} from '@/types/marketplace'

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
    return apiPost<TestConnectionResponse>(ENDPOINTS.MARKETPLACES.TEST, { type, credentials })
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
}