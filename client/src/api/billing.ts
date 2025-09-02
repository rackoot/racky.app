import { apiPost } from './client'
import { ENDPOINTS } from './config'

export interface CheckoutSessionRequest {
  planName: string
  contributorCount?: number
  billingCycle?: 'monthly' | 'yearly'
  successUrl?: string
  cancelUrl?: string
}

export interface CheckoutSessionResponse {
  url?: string
  sessionId: string
  clientSecret?: string
  isProduction?: boolean
  embedded?: boolean
  // Additional fields from mock mode
  planName?: string
  planDisplayName?: string
  contributorType?: string
  contributorCount?: number
  totalAmount?: number
  totalActions?: number | string
  billingCycle?: string
  pricePerContributor?: number
}

export interface BillingPortalResponse {
  url: string
}

export const billingApi = {
  /**
   * Create Stripe checkout session
   */
  async createCheckoutSession(data: CheckoutSessionRequest): Promise<CheckoutSessionResponse> {
    return apiPost<CheckoutSessionResponse>(ENDPOINTS.BILLING.CHECKOUT_SESSION, data)
  },

  /**
   * Create billing portal session
   */
  async createBillingPortal(): Promise<BillingPortalResponse> {
    return apiPost<BillingPortalResponse>(ENDPOINTS.BILLING.PORTAL)
  },
}