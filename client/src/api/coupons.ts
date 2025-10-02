import { apiPost } from './client'
import { ENDPOINTS } from './config'

export interface ValidateCouponRequest {
  couponCode: string
}

export interface CouponData {
  id: string
  type: 'percent' | 'amount'
  value: number
  duration: 'once' | 'repeating' | 'forever'
  durationInMonths?: number
  currency?: string
  name?: string
  maxRedemptions?: number
  timesRedeemed?: number
  redeemBy?: string | null
}

export interface ValidateCouponResponse {
  success: boolean
  message: string
  valid: boolean
  data?: CouponData
  error?: string
}

export const couponsApi = {
  /**
   * Validate a coupon code with Stripe
   */
  async validateCoupon(couponCode: string): Promise<ValidateCouponResponse> {
    return apiPost<ValidateCouponResponse>(ENDPOINTS.COUPONS.VALIDATE, { couponCode })
  },
}
