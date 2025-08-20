const API_BASE_URL = 'http://localhost:5000/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

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
    const response = await fetch(`${API_BASE_URL}/dashboard/analytics`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch dashboard analytics');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch dashboard analytics');
    }

    return data.data;
  },

  async getAISuggestions(forceRefresh = false): Promise<AISuggestionsResponse> {
    const url = new URL(`${API_BASE_URL}/dashboard/suggestions`);
    if (forceRefresh) {
      url.searchParams.set('refresh', 'true');
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch AI suggestions');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch AI suggestions');
    }

    return data.data;
  }
};