import { apiGet } from './client'
import { ENDPOINTS } from './config'

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

export const workspaceUsageApi = {
  /**
   * Get workspace usage statistics
   */
  async getWorkspaceUsage(workspaceId: string): Promise<WorkspaceUsage> {
    return apiGet<WorkspaceUsage>(ENDPOINTS.USAGE.WORKSPACE(workspaceId))
  },
}