// Dashboard types
export interface DashboardSuggestion {
  id: string
  title: string
  description: string
  category: string
  priority: 'high' | 'medium' | 'low'
  estimatedImpact: string
  actionRequired: boolean
  createdAt: string
}

export interface AnalyticsData {
  totalProducts: number
  totalStores: number
  connectedMarketplaces: number
  totalOpportunities: number
  totalRevenue: number
  revenueGrowth: number
  lastSyncAt?: string
}
