import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { PricingContent } from "@/components/pricing/pricing-content"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { getCurrentUser } from "@/lib/auth"
import { getAuthHeaders } from "@/lib/utils"

export function Pricing() {
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { currentWorkspace } = useWorkspace()
  const user = getCurrentUser()

  useEffect(() => {
    checkSubscriptionStatus()
  }, [currentWorkspace])

  const checkSubscriptionStatus = async () => {
    if (!user) {
      setIsLoading(false)
      return
    }

    // SUPERADMIN users don't need subscriptions - redirect to admin
    if (user.role === 'SUPERADMIN') {
      setHasSubscription(true)
      setIsLoading(false)
      return
    }

    // If no current workspace is selected, no subscription
    if (!currentWorkspace) {
      setHasSubscription(false)
      setIsLoading(false)
      return
    }

    try {
      // Check workspace subscription first (primary)
      if (currentWorkspace.subscription) {
        const { status } = currentWorkspace.subscription
        const isActive = status === 'ACTIVE'
        setHasSubscription(isActive)
        setIsLoading(false)
        return
      }

      // Fallback: Fetch fresh subscription data from API
      const response = await fetch('/api/plans/user/current', {
        headers: getAuthHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data.userSubscription) {
          setHasSubscription(data.data.userSubscription.hasActiveSubscription || false)
        } else {
          setHasSubscription(false)
        }
      } else {
        setHasSubscription(false)
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
      setHasSubscription(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading while checking subscription status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Redirect users with active subscription to stores
  if (hasSubscription) {
    return <Navigate to="/stores" replace />
  }

  // Show pricing page for users without subscription
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground">
          Unlock the full potential of your workspace with a subscription that fits your needs.
        </p>
      </div>

      {/* Pricing Content */}
      <PricingContent 
        showHeader={false}
      />
    </div>
  )
}