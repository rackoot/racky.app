import { apiPost } from '../client'
import { ENDPOINTS } from '../config'

export interface CheckoutSessionRequest {
  contributorType: string
  contributorCount?: number
  couponCode?: string
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
  contributorType?: string
  planDisplayName?: string
  contributorCount?: number
  totalAmount?: number
  totalActions?: number | string
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