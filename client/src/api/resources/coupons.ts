import apiClient from '../client'
import { ENDPOINTS } from '../config'
import axios from 'axios'

export interface ValidateCouponRequest {
  couponCode: string
}

export interface CouponData {
  // Promotion code info (if user entered a promotion code)
  promotionCodeId?: string
  promotionCode?: string
  // Coupon details
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
    try {
      const response = await apiClient.post<ValidateCouponResponse>(
        ENDPOINTS.COUPONS.VALIDATE,
        { couponCode }
      )
      return response.data
    } catch (error) {
      // Handle axios errors
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data as ValidateCouponResponse
      }
      // Handle unexpected errors
      throw error
    }
  },
}
