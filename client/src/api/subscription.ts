import { apiGet, apiPost, apiPut, apiDelete } from './client'
import { ENDPOINTS } from './config'

export interface SubscriptionInfo {
  workspaceId: string;
  workspaceName: string;
  subscription: {
    status: string;
    plan: string | null;
    hasActiveSubscription: boolean;
    endsAt: string | null;
    planLimits: any;
  };
  currentPlan: any;
  hasActiveSubscription: boolean;
  contributorCount: number;
  totalMonthlyActions: number;
  currentMonthlyPrice: number;
  billingCycle: 'monthly' | 'annual';
  limits: {
    maxStores: number;
    maxProducts: number;
    maxMarketplaces: number;
    apiCallsPerMonth: number;
  } | null;
  features: Array<{
    name: string;
    description: string;
    enabled: boolean;
  }> | null;
  scheduledDowngrade?: {
    contributorType: string;
    planDisplayName: string;
    contributorCount: number;
    effectiveDate: string;
    scheduleId: string;
  } | null;
}

export interface SubscriptionUpdateRequest {
  contributorType: 'JUNIOR' | 'SENIOR';
  billingCycle?: 'monthly' | 'annual';
  contributorCount?: number;
}

export interface SubscriptionPreviewRequest {
  contributorType: 'JUNIOR' | 'SENIOR';
  billingCycle: 'monthly' | 'annual';
  contributorCount: number;
}

export interface SubscriptionPreview {
  workspaceId: string;
  changes: {
    planChange: boolean;
    contributorChange: boolean;
    billingCycleChange: boolean;
  };
  current: {
    contributorType: string;
    contributorCount: number;
    billingCycle: string;
    monthlyPrice: number;
    totalActions: number;
  };
  new: {
    contributorType: string;
    contributorCount: number;
    billingCycle: string;
    monthlyPrice: number;
    totalActions: number;
  };
  pricing: {
    priceDifference: number;
    isUpgrade: boolean;
    isDowngrade: boolean;
    changeType: 'upgrade' | 'downgrade' | 'no_change';
    timing: 'immediate' | 'next_billing_period';
    message: string;
  };
}

export const subscriptionApi = {
  /**
   * Get workspace subscription info
   */
  async getSubscription(workspaceId: string): Promise<SubscriptionInfo> {
    return apiGet<SubscriptionInfo>(ENDPOINTS.SUBSCRIPTIONS.GET(workspaceId))
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
  async updateSubscription(workspaceId: string, data: SubscriptionUpdateRequest): Promise<any> {
    return apiPut<any>(ENDPOINTS.SUBSCRIPTIONS.UPDATE(workspaceId), data)
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
}