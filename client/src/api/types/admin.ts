// Admin types
export interface AdminUser {
  _id: string
  email: string
  name?: string
  role: 'USER' | 'SUPERADMIN'
  isActive: boolean
  createdAt: string
  subscription?: {
    status: string
    plan: string
    trialEndsAt?: string
  }
}

export interface AdminAnalytics {
  totalUsers: number
  activeUsers: number
  totalRevenue: number
  revenueGrowth: number
  newUsersThisMonth: number
  churnRate: number
}

export interface UpdateUserStatusRequest {
  isActive: boolean
}

export interface UpdateUserRoleRequest {
  role: 'USER' | 'SUPERADMIN'
}
