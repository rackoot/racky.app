function getAuthHeaders() {
  const token = localStorage.getItem('token');
  const workspaceId = localStorage.getItem('currentWorkspaceId');
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...(workspaceId && { 'X-Workspace-ID': workspaceId })
  };
}

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
  const response = await fetch(`/api/workspaces/${workspaceId}/subscription`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.data;
};

export const updateWorkspaceSubscription = async (
  workspaceId: string, 
  subscriptionData: UpdateSubscriptionRequest
): Promise<any> => {
  const response = await fetch(`/api/workspaces/${workspaceId}/subscription`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(subscriptionData)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const cancelWorkspaceSubscription = async (workspaceId: string): Promise<any> => {
  const response = await fetch(`/api/workspaces/${workspaceId}/subscription`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export const getWorkspaceUsage = async (workspaceId: string): Promise<WorkspaceUsage> => {
  const response = await fetch(`/api/workspaces/${workspaceId}/usage`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.data;
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