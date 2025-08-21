import { getCurrentUser } from "@/lib/auth"
import { Navigate } from "react-router-dom"

interface RequireSubscriptionProps {
  children: React.ReactNode
  fallback?: string
}

export function RequireSubscription({ children, fallback = "/subscription" }: RequireSubscriptionProps) {
  const user = getCurrentUser()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Check if user has an active subscription
  if (!user.subscriptionInfo || !user.subscriptionInfo.hasActiveSubscription) {
    return <Navigate to={fallback} replace />
  }

  return <>{children}</>
}