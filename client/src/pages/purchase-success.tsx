import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { getCurrentUser } from "@/lib/auth"
import { getAuthHeaders } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PurchaseSuccess() {
  const [verificationState, setVerificationState] = useState<'loading' | 'success' | 'error' | 'timeout'>('loading')
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const { currentWorkspace, refreshWorkspaces } = useWorkspace()
  const user = getCurrentUser()

  // Maximum time to wait for subscription verification (2 minutes)
  const MAX_VERIFICATION_TIME = 120
  const POLLING_INTERVAL = 3000 // 3 seconds

  useEffect(() => {
    if (!user) return

    let pollInterval: NodeJS.Timeout
    let timeoutTimer: NodeJS.Timeout
    let secondsTimer: NodeJS.Timeout

    const verifySubscription = async () => {
      try {
        // Refresh workspace data to get latest subscription info
        await refreshWorkspaces()

        // Check if current workspace now has active subscription
        if (currentWorkspace?.subscription?.status === 'ACTIVE') {
          setVerificationState('success')
          // Redirect after a brief success display
          setTimeout(() => {
            // Redirect handled by component render
          }, 2000)
          return true
        }

        // Fallback API check
        const response = await fetch('/api/plans/user/current', {
          headers: getAuthHeaders()
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data.userSubscription?.hasActiveSubscription) {
            setVerificationState('success')
            return true
          }
        }

        return false
      } catch (error) {
        console.error('Error verifying subscription:', error)
        return false
      }
    }

    const startVerification = async () => {
      // Initial check
      if (await verifySubscription()) return

      // Start polling
      pollInterval = setInterval(async () => {
        if (await verifySubscription()) {
          clearInterval(pollInterval)
        }
      }, POLLING_INTERVAL)

      // Seconds counter
      secondsTimer = setInterval(() => {
        setSecondsElapsed(prev => prev + 1)
      }, 1000)

      // Timeout handler
      timeoutTimer = setTimeout(() => {
        setVerificationState('timeout')
        clearInterval(pollInterval)
        clearInterval(secondsTimer)
      }, MAX_VERIFICATION_TIME * 1000)
    }

    startVerification()

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (secondsTimer) clearInterval(secondsTimer)
    }
  }, [currentWorkspace, refreshWorkspaces, user])

  // Redirect to login if no user
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Redirect to stores when subscription is confirmed
  if (verificationState === 'success') {
    return <Navigate to="/stores" replace />
  }

  const handleRetry = () => {
    setVerificationState('loading')
    setSecondsElapsed(0)
    // Trigger useEffect again by forcing a refresh
    window.location.reload()
  }

  const handleManualNavigation = () => {
    window.location.href = '/stores'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {verificationState === 'loading' && (
            <>
              <div className="mb-6">
                <div className="relative inline-flex">
                  <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin absolute -top-1 -right-1 bg-white rounded-full" />
                </div>
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                ¡Compra Exitosa!
              </h1>
              
              <p className="text-gray-600 mb-6">
                Tu suscripción está siendo activada. Estamos configurando tu workspace 
                y en unos segundos te redirigiremos para comenzar a conectar tus tiendas.
              </p>

              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verificando suscripción... ({secondsElapsed}s)</span>
              </div>

              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                    style={{ 
                      width: `${Math.min((secondsElapsed / MAX_VERIFICATION_TIME) * 100, 100)}%` 
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {verificationState === 'timeout' && (
            <>
              <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Activación en Progreso
              </h1>
              
              <p className="text-gray-600 mb-6">
                Tu compra fue exitosa, pero la activación está tomando más tiempo del esperado. 
                Puedes continuar manualmente o intentar verificar nuevamente.
              </p>

              <div className="space-y-3">
                <Button onClick={handleRetry} variant="outline" className="w-full">
                  <Loader2 className="w-4 h-4 mr-2" />
                  Verificar Nuevamente
                </Button>
                
                <Button onClick={handleManualNavigation} className="w-full">
                  Continuar a Tiendas
                </Button>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                Si el problema persiste, contacta a soporte. Tu suscripción ha sido procesada correctamente.
              </p>
            </>
          )}

          {verificationState === 'error' && (
            <>
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Error de Verificación
              </h1>
              
              <p className="text-gray-600 mb-6">
                Hubo un problema verificando tu suscripción. Tu compra fue procesada,
                pero necesitamos verificar el estado manualmente.
              </p>

              <div className="space-y-3">
                <Button onClick={handleRetry} variant="outline" className="w-full">
                  <Loader2 className="w-4 h-4 mr-2" />
                  Intentar Nuevamente
                </Button>
                
                <Button onClick={handleManualNavigation} className="w-full">
                  Continuar a Tiendas
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}