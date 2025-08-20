import { getCurrentUser } from "@/lib/auth"
import { Navigate } from "react-router-dom"

interface RequireRoleProps {
  children: React.ReactNode
  role: 'SUPERADMIN' | 'USER'
  fallback?: string
}

export function RequireRole({ children, role, fallback = "/dashboard" }: RequireRoleProps) {
  const user = getCurrentUser()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== role) {
    return <Navigate to={fallback} replace />
  }

  return <>{children}</>
}

export function RequireSuperAdmin({ children, fallback }: Omit<RequireRoleProps, 'role'>) {
  return (
    <RequireRole role="SUPERADMIN" fallback={fallback}>
      {children}
    </RequireRole>
  )
}