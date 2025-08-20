const API_BASE = 'http://localhost:5000/api';

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json',
});

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
  async getDescriptionOptimization(productId: string, platform: string): Promise<{
    suggestion: OptimizationSuggestion;
    cached: boolean;
  }> {
    const response = await fetch(`${API_BASE}/optimizations/products/${productId}/description/${platform}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch optimization');
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
    const response = await fetch(`${API_BASE}/optimizations/products/${productId}/description/${platform}`, {
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
    const response = await fetch(`${API_BASE}/optimizations/products/${productId}/description/${platform}`, {
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
      `${API_BASE}/optimizations/products/${productId}/suggestions?${params.toString()}`,
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
  }
};