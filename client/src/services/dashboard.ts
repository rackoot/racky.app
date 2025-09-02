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
  }
};