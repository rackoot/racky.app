import { apiGet } from '../client'
import { ENDPOINTS } from '../config'
import { UsageData, UsageTrend } from '../types'

export const usageApi = {
  /**
   * Get current usage data
   */
  async getCurrentUsage(): Promise<UsageData> {
    return apiGet<UsageData>(ENDPOINTS.USAGE.CURRENT)
  },

  /**
   * Get usage trends
   */
  async getUsageTrends(): Promise<UsageTrend[]> {
    return apiGet<UsageTrend[]>(ENDPOINTS.USAGE.TRENDS)
  },

  /**
   * Get usage history
   */
  async getUsageHistory(days?: number): Promise<UsageTrend[]> {
    let url = ENDPOINTS.USAGE.HISTORY
    if (days) {
      url = `${url}?days=${days}`
    }
    return apiGet<UsageTrend[]>(url)
  },
}