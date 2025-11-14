import { apiGet, apiPut, apiDelete, apiPost } from '../client'
import { ENDPOINTS } from '../config'
import type {
  AdminUser,
  AdminAnalytics,
  UpdateUserStatusRequest,
  UpdateUserRoleRequest
} from '../types/admin'
import type { PaginationParams } from '../types/common'
import type {
  WebhookUrl,
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhooksListResponse
} from '../types/webhook'

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

  // ============================================================================
  // WEBHOOK URL MANAGEMENT
  // ============================================================================

  /**
   * Get all webhook URLs with pagination (SUPERADMIN only)
   */
  async getWebhooks(page: number = 1, limit: number = 50): Promise<WebhooksListResponse> {
    const searchParams = new URLSearchParams()
    searchParams.append('page', page.toString())
    searchParams.append('limit', limit.toString())

    const url = `${ENDPOINTS.ADMIN.WEBHOOKS}?${searchParams.toString()}`
    return apiGet<WebhooksListResponse>(url)
  },

  /**
   * Get webhook by ID (SUPERADMIN only)
   */
  async getWebhook(webhookId: string): Promise<WebhookUrl> {
    return apiGet<WebhookUrl>(ENDPOINTS.ADMIN.WEBHOOK(webhookId))
  },

  /**
   * Create new webhook URL (SUPERADMIN only)
   */
  async createWebhook(data: CreateWebhookDto): Promise<WebhookUrl> {
    return apiPost<WebhookUrl>(ENDPOINTS.ADMIN.WEBHOOKS, data)
  },

  /**
   * Update webhook URL (SUPERADMIN only)
   */
  async updateWebhook(webhookId: string, data: UpdateWebhookDto): Promise<WebhookUrl> {
    return apiPut<WebhookUrl>(ENDPOINTS.ADMIN.WEBHOOK(webhookId), data)
  },

  /**
   * Delete webhook URL (SUPERADMIN only)
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    return apiDelete<void>(ENDPOINTS.ADMIN.WEBHOOK(webhookId))
  },

  /**
   * Toggle webhook active status (SUPERADMIN only)
   */
  async toggleWebhookStatus(webhookId: string): Promise<WebhookUrl> {
    return apiPut<WebhookUrl>(ENDPOINTS.ADMIN.WEBHOOK_TOGGLE(webhookId), {})
  },
}