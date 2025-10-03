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

// Workspace subscription types
export interface WorkspaceSubscription {
  workspaceId: string
  workspaceName: string
  subscription: {
    status: string
    plan: string | null
    hasActiveSubscription: boolean
    endsAt: string | null
    planLimits: any
    cancelAtPeriodEnd: boolean
    cancelledAt?: string
    cancellationReason?: string
    hasCoupon?: boolean
    coupon?: {
      id: string
      type: 'percent' | 'amount'
      value: number
      duration: 'once' | 'repeating' | 'forever'
      durationInMonths?: number
      appliedAt: string
      endsAt?: string
    }
  }
  currentPlan: any
  hasActiveSubscription: boolean
  contributorCount: number
  totalMonthlyActions: number
  currentMonthlyPrice: number
  billingCycle: 'monthly'
  limits: {
    maxStores: number
    maxProducts: number
    maxMarketplaces: number
    apiCallsPerMonth: number
  } | null
  features: Array<{
    name: string
    description: string
    enabled: boolean
  }> | null
  scheduledDowngrade?: {
    contributorType: string
    planDisplayName: string
    contributorCount: number
    effectiveDate: string
    scheduleId: string
  } | null
}

// Workspace usage types
export interface WorkspaceUsage {
  workspaceId: string
  workspaceName: string
  currentPeriod: {
    month: string
    apiCalls: number
    productSyncs: number
    storesConnected: number
    totalProducts: number
    features: {
      aiSuggestions: number
      opportunityScans: number
      bulkOperations: number
    }
  }
  limits: {
    maxStores: number
    maxProducts: number
    maxMarketplaces: number
    apiCallsPerMonth: number
  } | null
  percentageUsed: {
    stores: number
    products: number
    apiCalls: number
  } | null
}
