import { apiGet, apiPost, apiPut, apiDelete } from '../client'
import { ENDPOINTS } from '../config'
import type {
  WorkspaceSubscription,
  UpdateSubscriptionRequest,
  SubscriptionPreviewRequest,
  SubscriptionPreview
} from '../types/subscription'

export const subscriptionApi = {
  /**
   * Get workspace subscription info
   */
  async getSubscription(workspaceId: string): Promise<WorkspaceSubscription> {
    return apiGet<WorkspaceSubscription>(ENDPOINTS.SUBSCRIPTIONS.GET(workspaceId))
  },

  /**
   * Preview subscription changes
   */
  async previewSubscriptionChanges(workspaceId: string, data: SubscriptionPreviewRequest): Promise<SubscriptionPreview> {
    return apiPost<SubscriptionPreview>(ENDPOINTS.SUBSCRIPTIONS.PREVIEW(workspaceId), data)
  },

  /**
   * Update workspace subscription
   */
  async updateSubscription(workspaceId: string, data: UpdateSubscriptionRequest): Promise<any> {
    console.log('Updating workspace subscription:', { workspaceId, subscriptionData: data })
    try {
      const result = await apiPut<any>(ENDPOINTS.SUBSCRIPTIONS.UPDATE(workspaceId), data)
      console.log('Subscription update successful:', result)
      return result
    } catch (error) {
      console.error('Subscription update failed in API:', error)
      throw error
    }
  },

  /**
   * Cancel workspace subscription
   */
  async cancelSubscription(workspaceId: string): Promise<any> {
    return apiDelete<any>(ENDPOINTS.SUBSCRIPTIONS.CANCEL(workspaceId))
  },

  /**
   * Cancel scheduled downgrade
   */
  async cancelScheduledDowngrade(workspaceId: string): Promise<any> {
    return apiDelete<any>(ENDPOINTS.SUBSCRIPTIONS.CANCEL_DOWNGRADE(workspaceId))
  },

  /**
   * Reactivate cancelled subscription
   */
  async reactivateSubscription(workspaceId: string, data: UpdateSubscriptionRequest): Promise<any> {
    console.log('Reactivating workspace subscription:', { workspaceId, subscriptionData: data })

    try {
      const response = await fetch(`/api/subscription/${workspaceId}/reactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': workspaceId
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('Subscription reactivation successful:', result)
      return result
    } catch (error) {
      console.error('Subscription reactivation failed in API:', error)
      throw error
    }
  },

  /**
   * Cancel subscription cancellation (undo cancellation)
   */
  async cancelSubscriptionCancellation(workspaceId: string): Promise<any> {
    console.log('Cancelling subscription cancellation for workspace:', workspaceId)

    try {
      const response = await fetch(`/api/subscription/${workspaceId}/cancel-cancellation`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': workspaceId
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('Subscription cancellation cancelled successfully:', result)
      return result
    } catch (error) {
      console.error('Failed to cancel subscription cancellation:', error)
      throw error
    }
  }
}