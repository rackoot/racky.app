// Export all API modules
export { authApi } from './auth'
export { workspacesApi } from './workspaces'
export { marketplacesApi } from './marketplaces'
export { productsApi } from './products'
export { dashboardApi } from './dashboard'
export { opportunitiesApi } from './opportunities'
export { billingApi } from './billing'
export { subscriptionApi } from './subscription'
export { workspaceUsageApi } from './workspace-usage'
export { usageApi } from './usage'
export { plansApi } from './plans'
export { adminApi } from './admin'
export { demoApi } from './demo'
export { tasksApi } from './tasks'

// Export common utilities and types
export { default as apiClient, apiGet, apiPost, apiPut, apiDelete, handleApiResponse } from './client'
export { API_CONFIG, ENDPOINTS } from './config'
export * from './types'

// Export product and marketplace types from existing files
export type { Product, ProductsResponse, ProductsQuery } from './products'
export type {
  Marketplace,
  TestConnectionResponse,
  ConnectMarketplaceRequest,
  MarketplaceCredentials
} from '@/types/marketplace'

// Export task types
export type {
  TaskType,
  Task,
  TaskWithDetails,
  TaskStatus,
  TaskQueryParams,
  PaginatedTaskResponse,
  TaskTypeUsageBreakdown,
  WorkspaceUsageCalculation,
  TaskExecutionCheck,
  TaskAnalytics
} from './tasks'