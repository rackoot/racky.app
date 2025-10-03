import { apiGet, apiPut, apiDelete } from '../client'
import { ENDPOINTS } from '../config'
import type {
  AdminUser,
  AdminAnalytics,
  UpdateUserStatusRequest,
  UpdateUserRoleRequest
} from '../types/admin'
import type { PaginationParams } from '../types/common'

export interface AdminUsersQuery extends PaginationParams {
  search?: string
  role?: 'USER' | 'SUPERADMIN'
  status?: 'active' | 'inactive'
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface AdminUsersResponse {
  users: AdminUser[]
  pagination: {
    currentPage: number
    totalPages: number
    totalCount: number
    limit: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface AdminSubscriptionsQuery extends PaginationParams {
  status?: string
  plan?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export const adminApi = {
  /**
   * Get all users with pagination and filtering (SUPERADMIN only)
   */
  async getUsers(query: AdminUsersQuery = {}): Promise<AdminUsersResponse> {
    const searchParams = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, value.toString())
      }
    })
    
    const url = `${ENDPOINTS.ADMIN.USERS}?${searchParams.toString()}`
    return apiGet<AdminUsersResponse>(url)
  },

  /**
   * Get specific user details (SUPERADMIN only)
   */
  async getUser(userId: string): Promise<AdminUser> {
    return apiGet<AdminUser>(ENDPOINTS.ADMIN.USER(userId))
  },

  /**
   * Update user status (activate/deactivate)
   */
  async updateUserStatus(userId: string, data: UpdateUserStatusRequest): Promise<AdminUser> {
    return apiPut<AdminUser>(ENDPOINTS.ADMIN.USER_STATUS(userId), data)
  },

  /**
   * Update user role
   */
  async updateUserRole(userId: string, data: UpdateUserRoleRequest): Promise<AdminUser> {
    return apiPut<AdminUser>(ENDPOINTS.ADMIN.USER_ROLE(userId), data)
  },

  /**
   * Delete user with all data
   */
  async deleteUser(userId: string, force: boolean = true): Promise<void> {
    const url = `${ENDPOINTS.ADMIN.USER(userId)}?force=${force}`
    return apiDelete<void>(url)
  },

  /**
   * Get platform analytics (SUPERADMIN only)
   */
  async getAnalytics(): Promise<AdminAnalytics> {
    return apiGet<AdminAnalytics>(ENDPOINTS.ADMIN.ANALYTICS)
  },

  /**
   * Get subscription analytics (SUPERADMIN only)
   */
  async getSubscriptions(query: AdminSubscriptionsQuery = {}): Promise<any> {
    const searchParams = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, value.toString())
      }
    })
    
    const url = `${ENDPOINTS.ADMIN.SUBSCRIPTIONS}?${searchParams.toString()}`
    return apiGet<any>(url)
  },
}