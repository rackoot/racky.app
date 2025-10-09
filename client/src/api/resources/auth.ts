import { apiPost } from '../client'
import { ENDPOINTS } from '../config'
import type { LoginRequest, RegisterRequest, AuthResponse } from '../types/auth'

export const authApi = {
  /**
   * Login user
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return apiPost<AuthResponse>(ENDPOINTS.AUTH.LOGIN, credentials)
  },

  /**
   * Register new user
   */
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    return apiPost<AuthResponse>(ENDPOINTS.AUTH.REGISTER, userData)
  },
}