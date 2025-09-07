import { dashboardApi } from '@/api'

export interface DashboardMetrics {
  totalProducts: number;
  connectedStores: number;
  monthlyRevenue: number;
  avgOrderValue: number;
  productGrowth: string;
}

export interface ProductDistribution {
  name: string;
  value: number;
  count: number;
  color: string;
}

export interface ProductTrend {
  month: string;
  count: number;
}

export interface DashboardAnalytics {
  metrics: DashboardMetrics;
  charts: {
    productDistribution: ProductDistribution[];
    productsTrend: ProductTrend[];
  };
}

export interface AISuggestion {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'marketing' | 'inventory' | 'pricing' | 'expansion';
  impact: string;
}

export interface AISuggestionsResponse {
  suggestions: AISuggestion[];
  generatedAt: string;
  cached?: boolean;
  expiresAt?: string;
}

export interface AIScanMetrics {
  totalScans: number;
  completedScans: number;
  activeScans: number;
  totalProductsProcessed: number;
  successRate: number;
  lastScanAt: string | null;
  lastScanStatus: string | null;
}

export interface ScanStatusDistribution {
  name: string;
  value: number;
  color: string;
}

export interface ScanTrend {
  month: string;
  count: number;
}

export interface AIScanStatistics {
  metrics: AIScanMetrics;
  charts: {
    statusDistribution: ScanStatusDistribution[];
    scanTrend: ScanTrend[];
  };
}

export const dashboardService = {
  async getAnalytics(): Promise<DashboardAnalytics> {
    return dashboardApi.getAnalytics() as Promise<DashboardAnalytics>
  },

  async getAISuggestions(forceRefresh = false): Promise<AISuggestionsResponse> {
    const params = forceRefresh ? { refresh: 'true' } : undefined
    const suggestions = await dashboardApi.getSuggestions(params)
    
    return {
      suggestions: suggestions as AISuggestion[],
      generatedAt: new Date().toISOString(),
      cached: !forceRefresh
    }
  },

  async getAIScanStatistics(workspaceId: string): Promise<AIScanStatistics> {
    const response = await fetch('/api/opportunities/ai/statistics', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'X-Workspace-ID': workspaceId,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch AI scan statistics: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data as AIScanStatistics;
  }
};