// Export all API modules from resources directory
export { authApi } from './resources/auth'
export { ordersApi } from './resources/orders'
export { customersApi } from './resources/customers'
export { workspacesApi } from './resources/workspaces'
export { marketplacesApi } from './resources/marketplaces'
export { productsApi, getMarketplaceProductUrl } from './resources/products'
export { dashboardApi } from './resources/dashboard'
export { opportunitiesApi } from './resources/opportunities'
export { optimizationsApi } from './resources/optimizations'
export { billingApi } from './resources/billing'
export { subscriptionApi } from './resources/subscription'
export { workspaceUsageApi } from './resources/workspace-usage'
export { usageApi } from './resources/usage'
export { plansApi } from './resources/plans'
export { adminApi } from './resources/admin'
export { demoApi } from './resources/demo'
export { videosApi } from './resources/videos'
export { couponsApi } from './resources/coupons'

// Export common utilities and HTTP client
export { default as apiClient, apiGet, apiPost, apiPut, apiDelete, handleApiResponse } from './client'
export { API_CONFIG, ENDPOINTS } from './config'

// Export all types from centralized types directory
export * from './types'

// Export helper functions for backward compatibility and convenience
import { subscriptionApi } from './resources/subscription'
import { workspaceUsageApi } from './resources/workspace-usage'

export const getWorkspaceSubscription = (workspaceId: string) =>
  subscriptionApi.getSubscription(workspaceId)

export const previewWorkspaceSubscriptionChange = (workspaceId: string, data: any) =>
  subscriptionApi.previewSubscriptionChanges(workspaceId, data)

export const updateWorkspaceSubscription = (workspaceId: string, data: any) =>
  subscriptionApi.updateSubscription(workspaceId, data)

export const cancelWorkspaceSubscription = (workspaceId: string) =>
  subscriptionApi.cancelSubscription(workspaceId)

export const reactivateWorkspaceSubscription = (workspaceId: string, data: any) =>
  subscriptionApi.reactivateSubscription(workspaceId, data)

export const cancelSubscriptionCancellation = (workspaceId: string) =>
  subscriptionApi.cancelSubscriptionCancellation(workspaceId)

export const getWorkspaceUsage = (workspaceId: string) =>
  workspaceUsageApi.getWorkspaceUsage(workspaceId)
