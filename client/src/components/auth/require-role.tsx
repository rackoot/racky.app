import { getCurrentUser } from "@/lib/auth"
import { Navigate } from "react-router-dom"

interface RequireRoleProps {
  children: React.ReactNode
  role: 'SUPERADMIN' | 'USER'
  fallback?: string
  requireSubscription?: boolean
}

export function RequireRole({ children, role, fallback = "/dashboard", requireSubscription = true }: RequireRoleProps) {
  const user = getCurrentUser()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== role) {
    return <Navigate to={fallback} replace />
  }

  // Check if user needs an active subscription (SUPERADMIN users are exempt)
  if (requireSubscription && user.role !== 'SUPERADMIN' && (!user.subscriptionInfo || !user.subscriptionInfo.hasActiveSubscription)) {
    return <Navigate to="/subscription" replace />
  }

  return <>{children}</>
}

export function RequireSuperAdmin({ children, fallback, requireSubscription }: Omit<RequireRoleProps, 'role'>) {
  return (
    <RequireRole role="SUPERADMIN" fallback={fallback} requireSubscription={requireSubscription}>
      {children}
    </RequireRole>
  )
}