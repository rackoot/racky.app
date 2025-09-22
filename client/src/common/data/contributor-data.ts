import { Plan } from "@/types/plan";

export const contributorPlans: Plan[] = [
  {
    _id: "junior-plan",
    displayName: "Junior Contributor",
    description:
      "Perfect for small teams getting started with marketplace automation",
    contributorType: "JUNIOR",
    actionsPerContributor: 1000,
    maxContributorsPerWorkspace: 5,
    isContactSalesOnly: false,
    monthlyPrice: 9900, // $100.00 per contributor
    stripeMonthlyPriceId: "",
    limits: {
      maxStores: 5,
      maxProducts: 1000,
      maxMarketplaces: 2,
      maxSyncFrequency: 24,
      apiCallsPerMonth: 1000,
    },
    features: [
      {
        name: "WhatsApp Connection",
        description: "1 line per contributor",
        enabled: true,
      },
      { name: "AI Models", description: "4.1mini models", enabled: true },
      {
        name: "eCommerce Integration",
        description: "Shopify + VTEX (up to 1,000 products)",
        enabled: true,
      },
      { name: "Profiles", description: "Up to 3 profiles", enabled: true },
      { name: "File Storage", description: "20 maximum files", enabled: true },
      {
        name: "File Formats",
        description: "PDF, TXT, Word, PPT",
        enabled: true,
      },
      { name: "Human Operators", description: "1 operator", enabled: true },
      {
        name: "Max Contributors",
        description: "Up to 5 contributors",
        enabled: true,
      },
      { name: "Analytics", description: "Basic metrics", enabled: true },
      { name: "Support", description: "Tickets, Chat, Email", enabled: true },
      {
        name: "Basic Product Optimization",
        description: "1 per task",
        enabled: true,
      },
      {
        name: "Chatbot",
        description: "1 conversation per task",
        enabled: true,
      },
      { name: "Widget", description: "Branded", enabled: true },
      { name: "Internal Chat", description: "5 users", enabled: true },
      {
        name: "Basic Video Generation",
        description: "1 per 25 tasks",
        enabled: true,
      },
    ],
    trialDays: 14,
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "senior-plan",
    displayName: "Senior Contributor",
    description:
      "Advanced contributors with AI assistance for growing businesses",
    contributorType: "SENIOR",
    actionsPerContributor: 1000,
    maxContributorsPerWorkspace: 5,
    isContactSalesOnly: false,
    monthlyPrice: 19900, // $200.00 per contributor
    stripeMonthlyPriceId: "",
    limits: {
      maxStores: 25,
      maxProducts: 10000,
      maxMarketplaces: 5,
      maxSyncFrequency: 6,
      apiCallsPerMonth: 1000,
    },
    features: [
      {
        name: "WhatsApp Connection",
        description: "5 lines per contributor",
        enabled: true,
      },
      { name: "AI Models", description: "4.1 models", enabled: true },
      {
        name: "eCommerce Integration",
        description: "Shopify + VTEX (up to 10,000 products)",
        enabled: true,
      },
      { name: "Profiles", description: "Up to 10 profiles", enabled: true },
      { name: "File Storage", description: "50 maximum files", enabled: true },
      {
        name: "File Formats",
        description: "PDF, TXT, Word, PPT, Excel",
        enabled: true,
      },
      {
        name: "Human Operators",
        description: "5 per contributor",
        enabled: true,
      },
      {
        name: "Max Contributors",
        description: "Up to 50 contributors",
        enabled: true,
      },
      { name: "Analytics", description: "Professional metrics", enabled: true },
      {
        name: "Integrations",
        description: "Store integrations",
        enabled: true,
      },
      { name: "API Access", description: "Full API access", enabled: true },
      { name: "Support", description: "Tickets, Chat, Email", enabled: true },
      {
        name: "Basic Product Optimization",
        description: "1 per task",
        enabled: true,
      },
      {
        name: "Premium Product Optimization",
        description: "1 per task",
        enabled: true,
      },
      {
        name: "Chatbot",
        description: "1 conversation per task",
        enabled: true,
      },
      { name: "Widget", description: "White label", enabled: true },
      {
        name: "Batch Price Modifier",
        description: "2 per task",
        enabled: true,
      },
      { name: "Internal Chat", description: "20 users", enabled: true },
      {
        name: "Basic Video Generation",
        description: "1 per 25 tasks",
        enabled: true,
      },
      {
        name: "Professional Video Generation",
        description: "1 per 50 tasks",
        enabled: true,
      },
    ],
    trialDays: 14,
    createdAt: "",
    updatedAt: "",
  },
  {
    _id: "executive-plan",
    displayName: "Executive Contributor",
    description:
      "Premium contributors with unlimited capabilities and dedicated support",
    contributorType: "EXECUTIVE",
    actionsPerContributor: -1, // Unlimited
    maxContributorsPerWorkspace: 50,
    isContactSalesOnly: true,
    monthlyPrice: 19900, // Contact for pricing
    stripeMonthlyPriceId: "",
    limits: {
      maxStores: -1, // Unlimited
      maxProducts: -1,
      maxMarketplaces: -1,
      maxSyncFrequency: 1,
      apiCallsPerMonth: -1,
    },
    features: [
      {
        name: "Unlimited Operations",
        description: "No limits on actions or complexity",
        enabled: true,
      },
      {
        name: "Custom AI Models",
        description: "Tailored AI solutions for your business",
        enabled: true,
      },
      {
        name: "Dedicated Support",
        description: "24/7 dedicated account manager",
        enabled: true,
      },
      {
        name: "Unlimited Actions",
        description: "No monthly action limits",
        enabled: true,
      },
      {
        name: "Custom Integrations",
        description: "Bespoke marketplace and tool integrations",
        enabled: true,
      },
      {
        name: "White-label Solution",
        description: "Branded interface and API access",
        enabled: true,
      },
    ],
    trialDays: 30,
    createdAt: "",
    updatedAt: "",
  },
];

// Helper functions for working with contributor data
export const getContributorPlanById = (id: string): Plan | undefined => {
  return contributorPlans.find((plan) => plan._id === id);
};

export const getContributorPlanByType = (
  type: "JUNIOR" | "SENIOR" | "EXECUTIVE"
): Plan | undefined => {
  return contributorPlans.find((plan) => plan.contributorType === type);
};

export const getAvailablePlans = (): Plan[] => {
  return contributorPlans.filter((plan) => !plan.isContactSalesOnly);
};

export const getContactSalesPlans = (): Plan[] => {
  return contributorPlans.filter((plan) => plan.isContactSalesOnly);
};

// Formatting utilities
export const formatPrice = (cents: number): string => {
  return (cents / 100).toFixed(0);
};

export const formatPriceWithCurrency = (cents: number): string => {
  return `$${formatPrice(cents)}`;
};

export const calculateTotalPrice = (plan: Plan, count: number) => {
  const pricePerContributor = formatPrice(plan.monthlyPrice);
  const totalPrice = (plan.monthlyPrice * count) / 100;

  return {
    perContributor: pricePerContributor,
    total: totalPrice.toFixed(0),
  };
};

export const calculateTotalActions = (plan: Plan, count: number): string => {
  if (plan.actionsPerContributor === -1) return "Unlimited";
  return (plan.actionsPerContributor * count).toLocaleString();
};
