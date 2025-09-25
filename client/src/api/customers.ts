import { apiGet, apiPost } from './client'
import { ENDPOINTS } from './config'

export interface CustomerAddress {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province?: string;
  country: string;
  zip: string;
  phone?: string;
  isDefault?: boolean;
}

export interface Customer {
  _id: string;
  workspaceId: string;
  storeConnectionId: {
    _id: string;
    storeName: string;
    marketplaceType: string;
  };
  externalCustomerId: string;
  marketplace: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  acceptsMarketing: boolean;
  isActive: boolean;
  totalSpent: number;
  totalOrders: number;
  lastOrderDate?: string;
  addresses: CustomerAddress[];
  defaultAddress?: CustomerAddress;
  createdDate: string;
  updatedDate?: string;
  metadata: Record<string, any>;
  lastSyncDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomersResponse {
  customers: Customer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerSyncResult {
  syncedCustomers: number;
  newCustomers: number;
  updatedCustomers: number;
  errors: string[];
}

export interface CustomerQuery {
  page?: number;
  limit?: number;
  marketplace?: string;
  storeConnectionId?: string;
  search?: string;
  sortBy?: 'createdDate' | 'totalSpent' | 'totalOrders' | 'lastOrderDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export const customersApi = {
  /**
   * Get all customers with optional filtering
   */
  async getAllCustomers(query?: CustomerQuery): Promise<CustomersResponse> {
    let url = ENDPOINTS.CUSTOMERS.LIST

    if (query) {
      const params = new URLSearchParams()
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value))
        }
      })
      if (params.toString()) {
        url += `?${params.toString()}`
      }
    }

    return apiGet<CustomersResponse>(url)
  },

  /**
   * Get a single customer by ID
   */
  async getCustomerById(id: string): Promise<Customer> {
    return apiGet<Customer>(`${ENDPOINTS.CUSTOMERS.LIST}/${id}`)
  },

  /**
   * Sync customers from all connected stores
   */
  async syncAllStores(): Promise<CustomerSyncResult> {
    return apiPost<CustomerSyncResult>(ENDPOINTS.CUSTOMERS.SYNC_ALL, {})
  },

  /**
   * Sync customers from a specific store
   */
  async syncStore(storeConnectionId: string): Promise<CustomerSyncResult> {
    return apiPost<CustomerSyncResult>(`${ENDPOINTS.CUSTOMERS.SYNC}/${storeConnectionId}`, {})
  },

  /**
   * Get customer statistics summary
   */
  async getCustomerStats(): Promise<{
    totalCustomers: number;
    monthlyCustomers: number;
    activeCustomers: number;
    recentCustomers: Customer[];
  }> {
    return apiGet(`${ENDPOINTS.CUSTOMERS.LIST}/stats/summary`)
  }
}