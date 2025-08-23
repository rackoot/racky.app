import { useEffect, useState } from "react"
import { getCurrentUser } from "@/lib/auth"
import { Navigate } from "react-router-dom"
import { getAuthHeaders } from "@/lib/utils"

interface RequireSubscriptionProps {
  children: React.ReactNode
  fallback?: string
}

export function RequireSubscription({ children, fallback = "/subscription" }: RequireSubscriptionProps) {
  const [loading, setLoading] = useState(true)
  const [hasSubscription, setHasSubscription] = useState(false)
  const user = getCurrentUser()

  useEffect(() => {
    checkSubscription()
  }, [])

  const checkSubscription = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    // SUPERADMIN users don't need subscriptions
    if (user.role === 'SUPERADMIN') {
      setHasSubscription(true)
      setLoading(false)
      return
    }

    try {
      // Fetch fresh subscription data from API
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
      setLoading(false)
    }
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // SUPERADMIN users don't need subscriptions - redirect them to admin panel
  if (user.role === 'SUPERADMIN') {
    return <Navigate to="/admin" replace />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Check if user has an active subscription
  if (!hasSubscription) {
    return <Navigate to={fallback} replace />
  }

  return <>{children}</>
}