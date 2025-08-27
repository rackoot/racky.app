import { apiGet } from './client'
import { ENDPOINTS } from './config'
import { AnalyticsData } from './types'

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

export const dashboardApi = {
  /**
   * Get dashboard analytics data
   */
  async getAnalytics(): Promise<AnalyticsData> {
    return apiGet<AnalyticsData>(ENDPOINTS.DASHBOARD.ANALYTICS)
  },

  /**
   * Get dashboard suggestions
   */
  async getSuggestions(params?: { 
    category?: string; 
    priority?: string; 
    limit?: number 
  }): Promise<DashboardSuggestion[]> {
    let url = ENDPOINTS.DASHBOARD.SUGGESTIONS
    
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString())
        }
      })
      
      if (searchParams.toString()) {
        url = `${url}?${searchParams.toString()}`
      }
    }
    
    return apiGet<DashboardSuggestion[]>(url)
  },
}