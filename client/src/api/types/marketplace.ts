// Marketplace types
export interface Marketplace {
  id: string
  name: string
  description: string
  requiredCredentials: string[]
  documentationUrl: string
  connectionInfo?: ConnectionInfo
}

export interface ConnectionInfo {
  connectionId: string
  storeName: string
  lastSync: string
  syncStatus: 'pending' | 'syncing' | 'completed' | 'failed'
  productsCount: number
  activeProductsCount?: number
  totalInventory?: number
  inventoryValue?: string
}

export interface MarketplaceCredentials {
  [key: string]: string
}

export interface TestConnectionResponse {
  success: boolean
  message: string
  data?: {
    shop_name?: string
    domain?: string
    plan?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
  }
}

export interface ConnectMarketplaceRequest {
  storeConnectionId?: string
  storeName?: string
  type: string
  credentials: MarketplaceCredentials
}
