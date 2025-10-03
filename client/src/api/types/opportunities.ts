// Opportunity types
export interface OpportunityFilters {
  status?: 'pending' | 'in_progress' | 'completed'
  category?: string
  priority?: 'high' | 'medium' | 'low'
  dateFrom?: string
  dateTo?: string
}

export interface OptimizationRequest {
  productId: string
  optimizationType: string
  targetPlatform?: string
  customPrompt?: string
}
