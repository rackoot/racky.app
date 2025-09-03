// Shared Plan interfaces for the entire application
export interface Plan {
  _id: string
  displayName: string
  description: string
  contributorType: 'JUNIOR' | 'SENIOR' | 'EXECUTIVE'
  actionsPerContributor: number
  maxContributorsPerWorkspace: number
  isContactSalesOnly: boolean
  monthlyPrice: number // in cents
  yearlyPrice: number // in cents
  stripeMonthlyPriceId: string
  stripeYearlyPriceId: string
  limits: {
    maxStores: number
    maxProducts: number
    maxMarketplaces: number
    maxSyncFrequency: number
    apiCallsPerMonth: number
  }
  features: Array<{
    name: string
    description: string
    enabled: boolean
  }>
  trialDays: number
  createdAt: string
  updatedAt: string
}

export interface UserPlan {
  currentPlan: Plan
  subscription?: {
    status: string
    currentPeriodEnd: string
    trialEndsAt?: string
  }
  usage: {
    apiCalls: number
    productSyncs: number
    storeConnections: number
  }
}

// Type for contributor types
export type ContributorType = 'JUNIOR' | 'SENIOR' | 'EXECUTIVE'

// Type for billing cycles
export type BillingCycle = 'monthly' | 'yearly'