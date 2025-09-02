import { apiGet, apiPost } from './client'
import { ENDPOINTS } from './config'

// Re-export existing opportunity types and interfaces from services
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

export const opportunitiesApi = {
  /**
   * Get opportunities with optional filtering
   */
  async getOpportunities(filters: OpportunityFilters = {}): Promise<any[]> {
    let endpoint = ENDPOINTS.OPPORTUNITIES.LIST
    
    const searchParams = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, value.toString())
      }
    })
    
    if (searchParams.toString()) {
      endpoint = `${endpoint}?${searchParams.toString()}`
    }
    
    return apiGet<any[]>(endpoint)
  },

  /**
   * Get single opportunity by ID
   */
  async getOpportunity(id: string): Promise<any> {
    return apiGet<any>(ENDPOINTS.OPPORTUNITIES.GET(id))
  },

  /**
   * Generate optimization opportunities for a product
   */
  async generateOpportunities(productId: string): Promise<any> {
    return apiPost<any>(ENDPOINTS.OPPORTUNITIES.GENERATE(productId))
  },

  /**
   * Optimize a product based on opportunities
   */
  async optimizeProduct(productId: string, data: OptimizationRequest): Promise<any> {
    return apiPost<any>(ENDPOINTS.OPPORTUNITIES.OPTIMIZE(productId), data)
  },
}