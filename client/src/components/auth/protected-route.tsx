import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    
    if (!token) {
      setIsAuthenticated(false)
      navigate('/login')
      return
    }

    // TODO: Validate token with backend
    setIsAuthenticated(true)
  }, [navigate])

  if (isAuthenticated === null) {
    // Loading state
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  return <>{children}</>
}