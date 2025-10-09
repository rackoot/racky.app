import { apiPost } from '../client'
import { ENDPOINTS } from '../config'

export interface DemoUpgradeRequest {
  contributorType: string
  // Add any other demo-specific fields as needed
}

export const demoApi = {
  /**
   * Upgrade subscription in demo mode
   */
  async upgradeSubscription(data: DemoUpgradeRequest): Promise<any> {
    return apiPost<any>(ENDPOINTS.DEMO.UPGRADE_SUBSCRIPTION, data)
  },
}