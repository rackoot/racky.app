import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('token')
      
      if (!token) {
        setIsAuthenticated(false)
        navigate('/login')
        return
      }

      try {
        console.log('Validating token with backend...')
        // Validate token with backend by making an authenticated request
        const response = await fetch('http://localhost:5000/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        console.log('Token validation response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          console.log('Token validation response data:', data)
          if (data.success && data.data) {
            // Update localStorage with fresh user data from backend
            localStorage.setItem('user', JSON.stringify(data.data))
            console.log('Token validation successful, user authenticated')
            setIsAuthenticated(true)
          } else {
            console.error('Invalid response format:', data)
            throw new Error('Invalid response format')
          }
        } else {
          const errorData = await response.text()
          console.error('Token validation failed:', response.status, errorData)
          throw new Error('Token validation failed')
        }
      } catch (error) {
        console.error('Token validation error:', error)
        // Clear invalid token and user data
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setIsAuthenticated(false)
        navigate('/login')
      }
    }

    validateToken()
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