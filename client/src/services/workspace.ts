import { workspacesApi } from '@/api'

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
}

export const getWorkspaceSubscription = async (workspaceId: string): Promise<WorkspaceSubscription> => {
  return workspacesApi.getWorkspaceSubscription(workspaceId) as Promise<WorkspaceSubscription>
};

export const updateWorkspaceSubscription = async (
  workspaceId: string, 
  subscriptionData: UpdateSubscriptionRequest
): Promise<any> => {
  return workspacesApi.updateWorkspaceSubscription(workspaceId, subscriptionData)
};

export const cancelWorkspaceSubscription = async (workspaceId: string): Promise<any> => {
  // Using the generic delete method - this might need adjustment based on actual API
  return workspacesApi.deleteWorkspace(workspaceId)
};

export const getWorkspaceUsage = async (workspaceId: string): Promise<WorkspaceUsage> => {
  return workspacesApi.getWorkspaceUsage(workspaceId) as Promise<WorkspaceUsage>
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