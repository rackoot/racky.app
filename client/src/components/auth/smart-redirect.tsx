import { Navigate } from "react-router-dom"
import { getCurrentUser } from "@/lib/auth"

export function SmartRedirect() {
  const user = getCurrentUser()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Redirect SUPERADMIN users to admin panel, regular users to dashboard
  if (user.role === 'SUPERADMIN') {
    return <Navigate to="/admin" replace />
  } else {
    return <Navigate to="/dashboard" replace />
  }
}