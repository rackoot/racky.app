// Environment-based API configuration

console.log(import.meta.env);
export const API_CONFIG = {
  // In development, we rely on Vite's proxy configuration
  // In production, this should be set via environment variables
  BASE_URL: import.meta.env.VITE_API_BASE_URL || "/api",

  // Timeout configurations
  TIMEOUT: 30000, // 30 seconds

  // Environment detection
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,
} as const;

// API endpoints configuration
export const ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    PROFILE: "/auth/profile",
  },

  // Workspaces
  WORKSPACES: {
    LIST: "/workspaces",
    CREATE: "/workspaces",
    GET: (id: string) => `/workspaces/${id}`,
    UPDATE: (id: string) => `/workspaces/${id}`,
    DELETE: (id: string) => `/workspaces/${id}`,
    // Note: Subscription and usage moved to dedicated endpoints
    // SUBSCRIPTION: (id: string) => `/workspaces/${id}/subscription`, // DEPRECATED
    // USAGE: (id: string) => `/workspaces/${id}/usage`, // DEPRECATED
  },

  // Marketplaces
  MARKETPLACES: {
    LIST: "/marketplaces",
    STATUS: "/marketplaces/status",
    TEST: "/marketplaces/test",
    CONNECT: "/marketplaces/connect",
    CREATE_STORE: "/marketplaces/create-store",
    TEST_CONNECTION: (connectionId: string) =>
      `/marketplaces/${connectionId}/test`,
    TOGGLE: (connectionId: string) => `/marketplaces/${connectionId}/toggle`,
  },

  // Products
  PRODUCTS: {
    BASE: "/products",
    LIST: "/products",
    GET: (id: string) => `/products/${id}`,
    STORE_PRODUCTS: (connectionId: string) => `/products/store/${connectionId}`,
    STORE_COUNT: (connectionId: string) =>
      `/products/store/${connectionId}/count`,
    SYNC: (connectionId: string) => `/products/sync/${connectionId}`,
  },

  // Orders
  ORDERS: {
    BASE: "/orders",
    LIST: "/orders",
    GET: (id: string) => `/orders/${id}`,
    SYNC_ALL: "/orders/sync",
    SYNC_STORE: (storeConnectionId: string) => `/orders/sync/${storeConnectionId}`,
    STATS: "/orders/stats/summary",
  },

  // Customers
  CUSTOMERS: {
    BASE: "/customers",
    LIST: "/customers",
    GET: (id: string) => `/customers/${id}`,
    SYNC_ALL: "/customers/sync",
    SYNC: "/customers/sync",
    STATS: "/customers/stats/summary",
  },

  // Store Connections
  CONNECTIONS: {
    LIST: "/connections",
    GET: (id: string) => `/connections/${id}`,
    DELETE: (id: string) => `/connections/${id}`,
  },

  // Dashboard
  DASHBOARD: {
    ANALYTICS: "/dashboard/analytics",
    SUGGESTIONS: "/dashboard/suggestions",
  },

  // Opportunities
  OPPORTUNITIES: {
    LIST: "/opportunities",
    GET: (id: string) => `/opportunities/${id}`,
    GENERATE: (id: string) => `/opportunities/products/${id}/generate`,
    OPTIMIZE: (id: string) => `/opportunities/${id}/optimize`,
  },

  // Subscriptions (workspace-based)
  SUBSCRIPTIONS: {
    GET: (workspaceId: string) => `/subscription/${workspaceId}`,
    PREVIEW: (workspaceId: string) => `/subscription/${workspaceId}/preview`,
    UPDATE: (workspaceId: string) => `/subscription/${workspaceId}`,
    CANCEL: (workspaceId: string) => `/subscription/${workspaceId}`,
    CANCEL_DOWNGRADE: (workspaceId: string) =>
      `/subscription/${workspaceId}/downgrade`,
  },

  // Usage (workspace-based)
  USAGE: {
    WORKSPACE: (workspaceId: string) => `/usage/${workspaceId}`,
    // Legacy user-based routes (kept for backward compatibility)
    CURRENT: "/usage/current",
    TRENDS: "/usage/trends",
    HISTORY: "/usage/history",
  },

  // Billing (payment processing only)
  BILLING: {
    CHECKOUT_SESSION: "/billing/create-checkout-session",
    PORTAL: "/billing/portal",
  },

  // Plans
  PLANS: {
    LIST: "/plans",
    GET: (name: string) => `/plans/${name}`,
    USER_CURRENT: "/plans/user/current",
  },

  // Admin
  ADMIN: {
    USERS: "/admin/users",
    USER: (id: string) => `/admin/users/${id}`,
    USER_STATUS: (id: string) => `/admin/users/${id}/status`,
    USER_ROLE: (id: string) => `/admin/users/${id}/role`,
    ANALYTICS: "/admin/analytics",
    SUBSCRIPTIONS: "/admin/subscriptions",
  },

  // Demo
  DEMO: {
    UPGRADE_SUBSCRIPTION: "/demo/upgrade-subscription",
  },
} as const;
