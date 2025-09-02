import { opportunitiesApi, apiClient } from '@/api'

const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  const workspaceId = localStorage.getItem('currentWorkspaceId')
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    'X-Workspace-ID': workspaceId || ''
  }
  console.log('Auth headers:', { 
    hasToken: !!token, 
    hasWorkspace: !!workspaceId, 
    workspaceId: workspaceId?.substring(0, 8) + '...' 
  })
  return headers
}

export interface OptimizationSuggestion {
  id: string;
  originalContent: string;
  suggestedContent: string;
  status: 'pending' | 'accepted' | 'rejected';
  metadata: {
    model: string;
    tokens: number;
    confidence: number;
    keywords: string[];
    prompt?: string;
  };
  createdAt: string;
}

export interface SuggestionHistory {
  id: string;
  platform: string;
  type: string;
  title: string;
  description: string;
  originalContent: string;
  suggestedContent: string;
  status: 'pending' | 'accepted' | 'rejected';
  metadata: {
    model: string;
    tokens: number;
    confidence: number;
    keywords: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export const optimizationsService = {
  // Get or generate description optimization for a platform
  async getDescriptionOptimization(productId: string, platform: string, retryCount = 0): Promise<{
    suggestion?: OptimizationSuggestion;
    queueStatus?: any;
    cached: boolean;
  }> {
    const url = `/api/optimizations/products/${productId}/description/${platform}`
    console.log('getDescriptionOptimization - fetching:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    
    console.log('getDescriptionOptimization - response status:', response.status)

    if (!response.ok) {
      if (response.status >= 500 && retryCount < 3) {
        // Retry server errors with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
        return this.getDescriptionOptimization(productId, platform, retryCount + 1)
      }
      throw new Error(`HTTP ${response.status}: Failed to fetch optimization`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch optimization');
    }

    return data.data;
  },

  // Force regenerate description optimization
  async regenerateDescriptionOptimization(productId: string, platform: string): Promise<{
    suggestion: OptimizationSuggestion;
    cached: boolean;
  }> {
    const response = await fetch(`/api/optimizations/products/${productId}/description/${platform}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to regenerate optimization');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to regenerate optimization');
    }

    return data.data;
  },

  // Update suggestion status (accept/reject)
  async updateSuggestionStatus(
    productId: string, 
    platform: string, 
    suggestionId: string, 
    status: 'accepted' | 'rejected'
  ): Promise<void> {
    const response = await fetch(`/api/optimizations/products/${productId}/description/${platform}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, suggestionId }),
    });

    if (!response.ok) {
      throw new Error('Failed to update suggestion status');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to update suggestion status');
    }
  },

  // Apply accepted description to connected store
  async applyDescriptionToStore(
    productId: string, 
    platform: string, 
    suggestionId: string
  ): Promise<{ success: boolean; message: string; storeUpdateResult?: any }> {
    const response = await fetch(`/api/optimizations/products/${productId}/description/${platform}/apply`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ suggestionId }),
    });

    if (!response.ok) {
      throw new Error('Failed to apply description to store');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to apply description to store');
    }

    return data.data;
  },

  // Get suggestion history for a product
  async getSuggestionHistory(
    productId: string, 
    platform?: string, 
    type?: string
  ): Promise<SuggestionHistory[]> {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    if (type) params.append('type', type);

    const response = await fetch(
      `/api/optimizations/products/${productId}/suggestions?${params.toString()}`,
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch suggestion history');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch suggestion history');
    }

    return data.data;
  },

  // Start individual product AI optimization
  async startIndividualOptimization(productId: string, platform?: string): Promise<{
    jobId: string;
    status: string;
    estimatedTime: string;
  }> {
    const response = await fetch('/api/opportunities/ai/scan', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        productId, // Individual product optimization
        marketplace: platform,
        priority: 'high' // Individual optimizations get higher priority
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to start individual optimization');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to start individual optimization');
    }

    return {
      jobId: data.data.jobId,
      status: data.data.status,
      estimatedTime: '2-5 minutes'
    };
  },

  // Check optimization job status
  async getOptimizationJobStatus(jobId: string): Promise<{
    status: string;
    progress: {
      current: number;
      total: number;
      percentage: number;
    };
    eta: string;
    result?: any;
  }> {
    const response = await fetch(`/api/opportunities/ai/status/${jobId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get job status');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to get job status');
    }

    return data.data;
  },

  // Get AI optimization status for a product across all platforms
  async getProductOptimizationStatus(productId: string): Promise<{
    productId: string;
    platforms: Record<string, {
      inQueue: boolean;
      queueStatus: {
        status: 'queued' | 'processing' | 'recently_optimized';
        jobId?: string;
        batchNumber?: number;
        totalBatches?: number;
        marketplace?: string;
        optimizedAt?: string;
      } | null;
      hasOptimization: boolean;
      optimization: {
        id: string;
        content: string;
        status: 'pending' | 'accepted' | 'rejected';
        confidence: number;
        createdAt: string;
      } | null;
    }>;
    availablePlatforms: string[];
  }> {
    const response = await fetch(`/api/optimizations/products/${productId}/status`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Product optimization status not found (HTTP ${response.status})`);
      }
      throw new Error(`Failed to get optimization status (HTTP ${response.status})`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to get optimization status');
    }

    return data.data;
  }
};