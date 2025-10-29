/**
 * Product Synchronization Types
 * Types for async product sync with filters and job tracking
 */

export interface ProductSyncFilters {
  includeActive: boolean
  includeInactive: boolean
  categoryIds: string[]
}

export interface SyncJobRequest {
  connectionId: string
  marketplace: string
  estimatedProducts: number
  batchSize: number
  filters: ProductSyncFilters
}

export interface SyncJobResponse {
  jobId: string
  estimatedProducts: number
  batchSize: number
  estimatedTime: string
  status: string
  createdAt: string
}

export type SyncJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface SyncJobStatusResponse {
  jobId: string
  status: SyncJobStatus
  progress: {
    current: number
    total: number
    percentage: number
  }
  eta?: string
  createdAt: string
  processedOn?: string
  completedAt?: string
  error?: string
}

export interface CategoryFilter {
  name: string
  value: string // ID for VTEX (numeric), name for Shopify (string)
  productCount?: number
}

export interface BrandFilter {
  name: string
  value: string // ID for VTEX (numeric), name for Shopify (string)
  productCount?: number
}

export interface MarketplaceFiltersResponse {
  success: boolean
  data: {
    items: Array<CategoryFilter | BrandFilter>
    totalCount: number
    marketplace: string
    includeCount: boolean
    source: 'cache' | 'api'
  }
}

export interface SyncJob {
  jobId: string
  connectionId: string
  marketplace: string
  status: SyncJobStatus
  progress: number
  productsProcessed: number
  totalProducts: number
  startedAt: string
  completedAt?: string
  error?: string
}

export interface SyncJobsListResponse {
  success: boolean
  data: {
    jobs: SyncJob[]
    totalCount: number
    page: number
    limit: number
  }
}
