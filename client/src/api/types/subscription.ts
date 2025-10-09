// Subscription request types
export interface UpdateSubscriptionRequest {
  contributorType: 'JUNIOR' | 'SENIOR'
  billingCycle?: 'monthly'
  contributorCount?: number
}

export interface SubscriptionPreviewRequest {
  contributorType: 'JUNIOR' | 'SENIOR'
  billingCycle: 'monthly'
  contributorCount: number
}

// Subscription response types
export interface SubscriptionPreview {
  workspaceId: string
  changes: {
    planChange: boolean
    contributorChange: boolean
    billingCycleChange: boolean
  }
  current: {
    contributorType: string
    contributorCount: number
    billingCycle: string
    monthlyPrice: number
    totalActions: number
  }
  new: {
    contributorType: string
    contributorCount: number
    billingCycle: string
    monthlyPrice: number
    totalActions: number
  }
  pricing: {
    priceDifference: number
    isUpgrade: boolean
    isDowngrade: boolean
    changeType: 'upgrade' | 'downgrade' | 'no_change'
    timing: 'immediate' | 'next_billing_period'
    message: string
  }
}
