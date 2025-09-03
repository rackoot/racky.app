import { apiGet } from './client'
import { ENDPOINTS } from './config'

export interface Plan {
  _id: string
  displayName: string
  description: string
  contributorType: 'JUNIOR' | 'SENIOR' | 'EXECUTIVE'
  price: {
    monthly: number
    yearly?: number
  }
  limits: {
    apiCalls: number
    productSyncs: number
    storeConnections: number
    contributors?: number
    aiAssistance?: boolean
  }
  features: string[]
  isPopular?: boolean
  trialDays: number
  stripePriceId: string
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

export const plansApi = {
  /**
   * Get all available plans
   */
  async getAllPlans(): Promise<Plan[]> {
    return apiGet<Plan[]>(ENDPOINTS.PLANS.LIST)
  },

  /**
   * Get specific plan by name
   */
  async getPlan(contributorType: string): Promise<Plan> {
    return apiGet<Plan>(ENDPOINTS.PLANS.GET(contributorType))
  },

  /**
   * Get current user's plan information
   */
  async getUserCurrentPlan(): Promise<UserPlan> {
    return apiGet<UserPlan>(ENDPOINTS.PLANS.USER_CURRENT)
  },
}