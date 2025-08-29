import { workspacesApi, subscriptionApi, workspaceUsageApi } from '@/api'
import { getAuthHeaders } from '@/lib/utils'

export interface WorkspaceSubscription {
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
}

export interface WorkspaceUsage {
  workspaceId: string;
  workspaceName: string;
  currentPeriod: {
    month: string;
    apiCalls: number;
    productSyncs: number;
    storesConnected: number;
    totalProducts: number;
    features: {
      aiSuggestions: number;
      opportunityScans: number;
      bulkOperations: number;
    };
  };
  limits: {
    maxStores: number;
    maxProducts: number;
    maxMarketplaces: number;
    apiCallsPerMonth: number;
  } | null;
  percentageUsed: {
    stores: number;
    products: number;
    apiCalls: number;
  } | null;
}

export interface UpdateSubscriptionRequest {
  planName: 'BASIC' | 'PRO' | 'ENTERPRISE';
  billingCycle?: 'monthly' | 'annual';
  contributorCount?: number;
}

export interface SubscriptionPreviewRequest {
  planName: 'BASIC' | 'PRO' | 'ENTERPRISE';
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
    planName: string;
    contributorCount: number;
    billingCycle: string;
    monthlyPrice: number;
    totalActions: number;
  };
  new: {
    planName: string;
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

export const getWorkspaceSubscription = async (workspaceId: string): Promise<WorkspaceSubscription> => {
  return subscriptionApi.getSubscription(workspaceId) as Promise<WorkspaceSubscription>
};

export const previewWorkspaceSubscriptionChange = async (
  workspaceId: string, 
  previewData: SubscriptionPreviewRequest
): Promise<SubscriptionPreview> => {
  return subscriptionApi.previewSubscriptionChanges(workspaceId, previewData) as Promise<SubscriptionPreview>
};

export const updateWorkspaceSubscription = async (
  workspaceId: string, 
  subscriptionData: UpdateSubscriptionRequest
): Promise<any> => {
  try {
    console.log('Updating workspace subscription:', { workspaceId, subscriptionData });
    const result = await subscriptionApi.updateSubscription(workspaceId, subscriptionData);
    console.log('Subscription update successful:', result);
    return result;
  } catch (error) {
    console.error('Subscription update failed in service:', error);
    throw error;
  }
};

export const cancelWorkspaceSubscription = async (workspaceId: string): Promise<any> => {
  return subscriptionApi.cancelSubscription(workspaceId)
};

export const getWorkspaceUsage = async (workspaceId: string): Promise<WorkspaceUsage> => {
  return workspaceUsageApi.getWorkspaceUsage(workspaceId) as Promise<WorkspaceUsage>
};

// Get available plans (public endpoint)
export const getSubscriptionPlans = async () => {
  const response = await fetch('/api/plans', {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.data;
};