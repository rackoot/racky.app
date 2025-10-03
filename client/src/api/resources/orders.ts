import { apiGet, apiPost } from '../client'
import { ENDPOINTS } from '../config'
import { PaginationResponse } from '../types'

// Order Types based on the backend model
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
export type MarketplaceType = 'shopify' | 'vtex' | 'mercadolibre' | 'amazon' | 'facebook_shop' | 'google_shopping' | 'woocommerce'

export interface OrderItem {
  productId?: string
  externalProductId: string
  sku?: string
  title: string
  quantity: number
  price: number
  totalPrice: number
  variant?: string
  imageUrl?: string
}

export interface OrderAddress {
  firstName?: string
  lastName?: string
  company?: string
  address1: string
  address2?: string
  city: string
  province?: string
  country: string
  zip: string
  phone?: string
}

export interface OrderCustomer {
  id?: string
  email?: string
  firstName?: string
  lastName?: string
  phone?: string
}

export interface OrderShipping {
  method?: string
  cost: number
  trackingNumber?: string
  carrier?: string
}

export interface Order {
  _id: string
  workspaceId: string
  storeConnectionId: {
    _id: string
    storeName: string
    marketplaceType: MarketplaceType
  }
  externalOrderId: string
  orderNumber: string
  marketplace: MarketplaceType

  // Order details
  status: OrderStatus
  financialStatus?: string
  fulfillmentStatus?: string

  // Order items
  items: OrderItem[]

  // Customer info
  customer?: OrderCustomer

  // Addresses
  billingAddress?: OrderAddress
  shippingAddress?: OrderAddress

  // Financial info
  subtotal: number
  taxTotal: number
  shippingTotal: number
  discountTotal: number
  total: number
  currency: string

  // Shipping info
  shipping?: OrderShipping

  // Dates
  orderDate: Date
  shippedDate?: Date
  deliveredDate?: Date

  // Metadata from marketplace
  metadata: Record<string, unknown>

  // Sync info
  lastSyncDate: Date

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

export interface OrdersResponse {
  orders: Order[]
  pagination: PaginationResponse
}

export interface OrderQuery {
  page?: number
  limit?: number
  status?: string
  marketplace?: string
  storeConnectionId?: string
  search?: string
  sortBy?: 'orderDate' | 'total' | 'status' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface OrderSyncResult {
  success: boolean
  message: string
  syncedOrders: number
  newOrders: number
  updatedOrders: number
  errors: string[]
}

export interface OrderStats {
  totalOrders: number
  monthlyOrders: number
  pendingOrders: number
  recentOrders: Order[]
}

export const ordersApi = {
  /**
   * Get all orders for the current workspace with pagination and filtering
   */
  async getAllOrders(query: OrderQuery = {}): Promise<OrdersResponse> {
    const searchParams = new URLSearchParams()

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, value.toString())
      }
    })

    const url = `${ENDPOINTS.ORDERS.LIST}?${searchParams.toString()}`
    return apiGet<OrdersResponse>(url)
  },

  /**
   * Get a single order by ID
   */
  async getOrderById(id: string): Promise<Order> {
    return apiGet<Order>(ENDPOINTS.ORDERS.GET(id))
  },

  /**
   * Sync orders from all connected stores
   */
  async syncAllStores(): Promise<OrderSyncResult> {
    return apiPost<OrderSyncResult>(ENDPOINTS.ORDERS.SYNC_ALL)
  },

  /**
   * Sync orders from a specific store
   */
  async syncStore(storeConnectionId: string): Promise<OrderSyncResult> {
    return apiPost<OrderSyncResult>(ENDPOINTS.ORDERS.SYNC_STORE(storeConnectionId))
  },

  /**
   * Get order summary statistics
   */
  async getOrderStats(): Promise<OrderStats> {
    return apiGet<OrderStats>(ENDPOINTS.ORDERS.STATS)
  },
}