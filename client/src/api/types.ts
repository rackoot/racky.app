// Common API response structure
export interface ApiResponse<T = any> {
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

// Auth types
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface AuthResponse {
  token: string
  user: {
    _id: string
    email: string
    firstName?: string
    lastName?: string
    name?: string
    role: 'USER' | 'SUPERADMIN'
  }
}

// Workspace types
export interface Workspace {
  _id: string
  name: string
  description?: string
  userId: string
  createdAt: string
  updatedAt: string
}

export interface CreateWorkspaceRequest {
  name: string
  description?: string
}

// Usage types
export interface UsageData {
  period: string
  apiCalls: number
  productSyncs: number
  storeConnections: number
  limit: {
    apiCalls: number
    productSyncs: number
    storeConnections: number
  }
}

export interface UsageTrend {
  date: string
  apiCalls: number
  productSyncs: number
}

// Analytics types
export interface AnalyticsData {
  totalProducts: number
  totalStores: number
  connectedMarketplaces: number
  totalOpportunities: number
  totalRevenue: number
  revenueGrowth: number
  lastSyncAt?: string
}

// Admin types
export interface AdminUser {
  _id: string
  email: string
  name?: string
  role: 'USER' | 'SUPERADMIN'
  isActive: boolean
  createdAt: string
  subscription?: {
    status: string
    plan: string
    trialEndsAt?: string
  }
}

export interface AdminAnalytics {
  totalUsers: number
  activeUsers: number
  totalRevenue: number
  revenueGrowth: number
  newUsersThisMonth: number
  churnRate: number
}

export interface UpdateUserStatusRequest {
  isActive: boolean
}

export interface UpdateUserRoleRequest {
  role: 'USER' | 'SUPERADMIN'
}

// Task-related types (complementing tasks.ts API types)
export interface TaskUsageMetrics {
  currentPeriod: {
    unitsConsumed: number
    unitsRemaining: number
    totalTasks: number
    completedTasks: number
    pendingTasks: number
    failedTasks: number
  }
  limits: {
    subscriptionLimit: number
    percentageUsed: number
  }
  billingPeriod: {
    startDate: string
    endDate: string
    daysRemaining: number
    daysElapsed: number
    renewalDate: string
  }
  subscription: {
    planType: string
    planName: string
    status: string
    isActive: boolean
  }
}

export interface TaskTypeStats {
  taskTypeSlug: string
  name: string
  unitCost: number
  unitType?: string
  tasksCount: number
  unitsConsumed: number
  percentageOfTotal: number
  color?: string
  icon?: string
}

export interface DailyUsagePoint {
  date: string
  taskCount: number
  unitsConsumed: number
  dayOfWeek: string
  isToday: boolean
}

export interface TaskUsageChartData {
  dailyUsage: DailyUsagePoint[]
  taskTypeBreakdown: TaskTypeStats[]
  weeklyTrend: {
    current: number
    previous: number
    change: number
  }
}

