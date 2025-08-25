import { useEffect } from "react"
import { Navigate } from "react-router-dom"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { getCurrentUser } from "@/lib/auth"

interface SubscriptionRedirectProps {
  children: React.ReactNode
}

export function SubscriptionRedirect({ children }: SubscriptionRedirectProps) {
  const { currentWorkspace } = useWorkspace()
  const user = getCurrentUser()

  // Helper function to check if user has active subscription
  const hasActiveSubscription = (): boolean => {
    // SUPERADMIN users bypass subscription requirements
    if (user?.role === 'SUPERADMIN') {
      return true
    }

    // Check workspace subscription first (primary)
    if (currentWorkspace?.subscription) {
      const { status } = currentWorkspace.subscription
      return status === 'ACTIVE'
    }

    // Fallback to user subscription info (legacy/backup)
    if (user?.subscriptionInfo) {
      return user.subscriptionInfo.hasActiveSubscription && 
             user.subscriptionInfo.status === 'ACTIVE'
    }

    return false
  }

  // Redirect based on subscription status
  if (hasActiveSubscription()) {
    // Has subscription - redirect to management page
    return <Navigate to="/subscription-manage" replace />
  } else {
    // No subscription - redirect to pricing
    return <Navigate to="/pricing-internal" replace />
  }
}