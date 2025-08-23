import { Types } from 'mongoose';

export const testUsers = {
  validUser: {
    email: 'testuser@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
  },
  
  adminUser: {
    email: 'admin@example.com',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'User',
    role: 'SUPERADMIN' as const,
  },

  invalidUser: {
    email: 'invalid-email',
    password: '123', // Too short
    firstName: '',
    lastName: '',
  },
};

export const testWorkspaces = {
  validWorkspace: {
    name: 'Test Workspace',
    description: 'A test workspace for testing purposes',
    settings: {
      timezone: 'UTC',
      currency: 'USD',
      language: 'en',
    },
  },

  invalidWorkspace: {
    name: '', // Empty name should fail validation
    description: 'Invalid workspace',
  },
};

export const testPlans = {
  basicPlan: {
    name: 'BASIC',
    displayName: 'Basic Plan',
    description: 'Basic plan for small businesses',
    monthlyPrice: 2900, // $29.00 in cents
    yearlyPrice: 29000, // $290.00 in cents (12 months * $29 - 2 months discount)
    stripeMonthlyPriceId: 'price_test_basic_monthly',
    stripeYearlyPriceId: 'price_test_basic_yearly',
    limits: {
      maxStores: 1,
      maxProducts: 100,
      maxMarketplaces: 2,
      maxSyncFrequency: 24, // hours
      apiCallsPerMonth: 1000,
    },
    features: [
      {
        name: 'Product Management',
        description: 'Manage your products across marketplaces',
        enabled: true,
      },
      {
        name: 'Basic Analytics',
        description: 'View basic sales and performance metrics',
        enabled: true,
      },
    ],
    isActive: true,
  },

  proPlan: {
    name: 'PRO',
    displayName: 'Pro Plan',
    description: 'Professional plan for growing businesses',
    monthlyPrice: 7900, // $79.00 in cents
    yearlyPrice: 79000, // $790.00 in cents
    stripeMonthlyPriceId: 'price_test_pro_monthly',
    stripeYearlyPriceId: 'price_test_pro_yearly',
    limits: {
      maxStores: 5,
      maxProducts: 1000,
      maxMarketplaces: 5,
      maxSyncFrequency: 12, // hours
      apiCallsPerMonth: 10000,
    },
    features: [
      {
        name: 'Product Management',
        description: 'Manage your products across marketplaces',
        enabled: true,
      },
      {
        name: 'Advanced Analytics',
        description: 'Detailed analytics and reporting',
        enabled: true,
      },
      {
        name: 'AI Suggestions',
        description: 'AI-powered optimization suggestions',
        enabled: true,
      },
    ],
    isActive: true,
  },
};

export const testStoreConnections = {
  shopifyStore: {
    name: 'Test Shopify Store',
    platform: 'shopify' as const,
    status: 'active' as const,
    isActive: true,
    marketplaces: {
      shopify: {
        isActive: true,
        credentials: {
          storeDomain: 'test-store.myshopify.com',
          accessToken: 'test-access-token',
        },
        lastSync: new Date(),
        status: 'connected' as const,
      },
    },
  },
};

export const testProducts = {
  basicProduct: {
    title: 'Test Product',
    description: 'A test product for testing purposes',
    price: 19.99,
    marketplace: 'shopify' as const,
    externalId: 'test-product-123',
    sku: 'TEST-SKU-001',
    status: 'active' as const,
    images: ['https://example.com/image1.jpg'],
    categories: ['Electronics', 'Gadgets'],
  },
};

export const testSubscriptions = {
  activeSubscription: {
    status: 'ACTIVE' as const,
    startedAt: new Date(),
    endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    billingCycle: 'monthly' as const,
    isDemo: false,
  },
};

export const mockStripeCustomer = {
  id: 'cus_test123',
  email: 'testuser@example.com',
  created: Math.floor(Date.now() / 1000),
  metadata: {},
};

export const mockStripeSubscription = {
  id: 'sub_test123',
  customer: 'cus_test123',
  status: 'active',
  current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
  items: {
    data: [{
      price: {
        id: 'price_test123',
        recurring: { interval: 'month' },
      },
    }],
  },
};

// Helper to create test ObjectIds consistently
export const createTestObjectId = (): Types.ObjectId => new Types.ObjectId();

// Helper to create multiple test users data
export const createTestUsersData = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    email: `testuser${index + 1}@example.com`,
    password: 'password123',
    firstName: `Test${index + 1}`,
    lastName: 'User',
  }));
};