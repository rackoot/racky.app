const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  const workspaceId = localStorage.getItem('currentWorkspaceId');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    ...(workspaceId && { 'X-Workspace-ID': workspaceId })
  };
};

export interface OpportunityCategory {
  _id: string;
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isMarketplace: boolean;
  isActive: boolean;
}

export interface Opportunity {
  _id: string;
  userId: string;
  productId: string;
  category: string;
  marketplace?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'completed' | 'dismissed';
  potentialImpact: {
    revenue: number;
    percentage: number;
  };
  actionRequired?: string;
  dueDate?: string;
  cachedAt: string;
  expiresAt: string;
  aiMetadata?: {
    model: string;
    prompt: string;
    tokens: number;
    confidence: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityResponse {
  opportunities: Record<string, Opportunity[]>;
  categoryCounts: Record<string, number>;
  availableMarketplaceTabs: string[];
  totalCount: number;
  productMarketplace: string;
  cached: boolean;
  lastGenerated?: string;
}

export interface GenerateOpportunitiesResponse {
  opportunities: Record<string, Opportunity[]>;
  categoryCounts: Record<string, number>;
  totalCount: number;
  cached: boolean;
  generatedAt: string;
  message: string;
}

export interface OpportunitySummary {
  total: number;
  byPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byStatus: {
    open: number;
    in_progress: number;
    completed: number;
  };
  totalPotentialImpact: number;
}

class OpportunitiesService {
  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${`/api/opportunities`}${endpoint}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }
    
    return data;
  }

  /**
   * Get all available opportunity categories
   */
  async getCategories(): Promise<OpportunityCategory[]> {
    const response = await this.makeRequest('/categories');
    return response.data;
  }

  /**
   * Get cached opportunities for a product
   */
  async getProductOpportunities(productId: string, category?: string): Promise<OpportunityResponse> {
    const params = new URLSearchParams();
    if (category) {
      params.append('category', category);
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await this.makeRequest(`/products/${productId}${query}`);
    return response.data;
  }

  /**
   * Generate new AI opportunities for a product
   */
  async generateOpportunities(productId: string, forceRefresh: boolean = false): Promise<GenerateOpportunitiesResponse> {
    const response = await this.makeRequest(`/products/${productId}/generate`, {
      method: 'POST',
      body: JSON.stringify({ forceRefresh }),
    });
    return response.data;
  }

  /**
   * Update opportunity status
   */
  async updateOpportunityStatus(opportunityId: string, status: Opportunity['status']): Promise<Opportunity> {
    const response = await this.makeRequest(`/${opportunityId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return response.data.opportunity;
  }

  /**
   * Get opportunity summary for a product
   */
  async getOpportunitySummary(productId: string): Promise<OpportunitySummary> {
    const response = await this.makeRequest(`/products/${productId}/summary`);
    return response.data;
  }

  /**
   * Get opportunities by specific category
   */
  async getOpportunitiesByCategory(productId: string, category: string): Promise<Opportunity[]> {
    const response = await this.getProductOpportunities(productId, category);
    return response.opportunities[category] || [];
  }

  /**
   * Dismiss an opportunity (mark as dismissed)
   */
  async dismissOpportunity(opportunityId: string): Promise<Opportunity> {
    return this.updateOpportunityStatus(opportunityId, 'dismissed');
  }

  /**
   * Mark opportunity as completed
   */
  async completeOpportunity(opportunityId: string): Promise<Opportunity> {
    return this.updateOpportunityStatus(opportunityId, 'completed');
  }

  /**
   * Start working on an opportunity (mark as in_progress)
   */
  async startOpportunity(opportunityId: string): Promise<Opportunity> {
    return this.updateOpportunityStatus(opportunityId, 'in_progress');
  }

  /**
   * Get priority color class for UI
   */
  getPriorityColor(priority: Opportunity['priority']): string {
    switch (priority) {
      case 'critical':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'low':
        return 'text-gray-600 bg-gray-100 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  }

  /**
   * Get status color class for UI
   */
  getStatusColor(status: Opportunity['status']): string {
    switch (status) {
      case 'open':
        return 'text-blue-600 bg-blue-100';
      case 'in_progress':
        return 'text-yellow-600 bg-yellow-100';
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'dismissed':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }

  /**
   * Format category name for display
   */
  formatCategoryName(categoryId: string): string {
    // Convert snake_case to Title Case
    return categoryId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export const opportunitiesService = new OpportunitiesService();