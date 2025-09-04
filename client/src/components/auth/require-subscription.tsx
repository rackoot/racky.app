import { useEffect, useState, useCallback } from "react"
import { getCurrentUser } from "@/lib/auth"
import { Navigate } from "react-router-dom"
import { getAuthHeaders } from "@/lib/utils"
import { useWorkspace } from "@/components/workspace/workspace-context"

interface RequireSubscriptionProps {
  children: React.ReactNode
  fallback?: string
}

export function RequireSubscription({ children, fallback = "/pricing-internal" }: RequireSubscriptionProps) {
  const [checking, setChecking] = useState(true)
  const [hasSubscription, setHasSubscription] = useState(false)
  const user = getCurrentUser()
  const { currentWorkspace, isLoading: workspaceLoading, workspaces } = useWorkspace()


  const checkSubscription = useCallback(async () => {
    if (!user) {
      setLoading(false)
      
      return
    }

  useEffect(() => {
    console.log('RequireSubscription: State change', { 
      workspaceLoading, 
      currentWorkspace: currentWorkspace?._id,
      workspacesCount: workspaces.length,
      user: user?.email
    }
                
    // Don't do anything until workspaces are loaded and user is available
    if (workspaceLoading || !user) {
      setChecking(true)
      return
    }

    // SUPERADMIN users don't need subscriptions
    if (user.role === 'SUPERADMIN') {
      console.log('User is SUPERADMIN, allowing access')
      setHasSubscription(true)
      setChecking(false)
      return
    }

    // If no workspaces exist at all, deny access
    if (workspaces.length === 0) {
      console.log('No workspaces available, denying access')
      setHasSubscription(false)
      setChecking(false)
      return
    }

    // If workspace is selected, check its subscription
    if (currentWorkspace) {
      console.log('Checking workspace subscription:', {
        workspaceId: currentWorkspace._id,
        subscription: currentWorkspace.subscription
      })

      if (currentWorkspace.subscription && currentWorkspace.subscription.status === 'ACTIVE') {
        console.log('Workspace has active subscription, allowing access')
        setHasSubscription(true)
        setChecking(false)
        return
      }

      // No workspace subscription, fallback to API check
      checkSubscriptionAPI()
    } else {
      // Workspaces exist but no current workspace selected yet - keep checking
      // This handles the race condition where workspaces load before currentWorkspace is set
      console.log('Workspaces loaded but currentWorkspace still being selected, continuing to wait...')
      setChecking(true)
      return
    }

  }, [workspaceLoading, currentWorkspace, workspaces, user])

  const checkSubscriptionAPI = async () => {
    try {
      console.log('Fallback API subscription check')
      const response = await fetch('/api/plans/user/current', {
        headers: getAuthHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        console.log('API subscription response:', data)
        if (data.success && data.data.userSubscription) {
          setHasSubscription(data.data.userSubscription.hasActiveSubscription || false)
        } else {
          setHasSubscription(false)
        }
      } else {
        console.log('API subscription response failed:', response.status)
        setHasSubscription(false)
      }
    } catch (error) {
      console.error('Error checking subscription via API:', error)
      setHasSubscription(false)
    } finally {
      setChecking(false)
    }
  }, [currentWorkspace, user])

  useEffect(() => {
    checkSubscription()
  }, [checkSubscription, currentWorkspace?.subscription])

  // Redirect unauthenticated users to login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // SUPERADMIN users bypass subscription checks entirely
  if (user.role === 'SUPERADMIN') {
    return <Navigate to="/admin" replace />
  }

  // Show loading spinner while checking
  if (checking) {
    console.log('Still checking subscription...')
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Redirect to pricing if no subscription
  if (!hasSubscription) {
    console.log('No subscription found, redirecting to:', fallback)
    return <Navigate to={fallback} replace />
  }

  console.log('Subscription check passed, rendering children')
  return <>{children}</>
}