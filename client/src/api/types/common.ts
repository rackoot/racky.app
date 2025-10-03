// Common API response structure
export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
}

// Common pagination structure
export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginationResponse {
  currentPage: number
  totalPages: number
  totalCount: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

// Query parameters for list endpoints
export interface QueryParams extends PaginationParams {
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// Error response structure
export interface ApiError {
  message: string
  status?: number
  code?: string
}
