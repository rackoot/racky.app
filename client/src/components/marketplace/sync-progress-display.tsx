import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { productsApi } from '@/api/resources/products'
import { clearSyncJob } from '@/lib/sync-storage'
import type { SyncJobStatusResponse, SyncJobStatus } from '@/types/sync'

interface SyncProgressDisplayProps {
  jobId: string
  connectionId: string
  onComplete?: () => void
  onError?: (error: string) => void
  autoClose?: boolean
  autoCloseDelay?: number // milliseconds
}

export function SyncProgressDisplay({
  jobId,
  connectionId,
  onComplete,
  onError,
  autoClose = true,
  autoCloseDelay = 3000
}: SyncProgressDisplayProps) {
  const [status, setStatus] = useState<SyncJobStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [startTime] = useState(Date.now())
  const [elapsedTime, setElapsedTime] = useState(0)
  const [polling, setPolling] = useState(true)

  // Poll for status every 5 seconds
  useEffect(() => {
    if (!jobId || !polling) return

    const fetchStatus = async () => {
      try {
        const response = await productsApi.getSyncStatus(jobId)
        setStatus(response)

        // Stop polling if completed or failed (but not processing_batches)
        if (response.status === 'completed' || response.status === 'failed') {
          setPolling(false)

          if (response.status === 'completed') {
            // Clear from localStorage on success
            clearSyncJob(connectionId)

            if (onComplete) {
              onComplete()
            }

            // Auto close after delay if enabled
            if (autoClose) {
              setTimeout(() => {
                // Could emit an event or use a callback here to close the display
              }, autoCloseDelay)
            }
          } else if (response.status === 'failed') {
            // Clear from localStorage on failure
            clearSyncJob(connectionId)

            const errorMsg = response.error || 'Synchronization failed'
            setError(errorMsg)
            if (onError) {
              onError(errorMsg)
            }
          }
        }
      } catch (err) {
        console.error('Error polling sync status:', err)
        // Don't stop polling on error, continue trying
      }
    }

    // Fetch immediately
    fetchStatus()

    // Then poll every 5 seconds
    const interval = setInterval(fetchStatus, 5000)

    return () => clearInterval(interval)
  }, [jobId, connectionId, polling, onComplete, onError, autoClose, autoCloseDelay])

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime)
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime])

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${seconds}s`
  }

  const getStatusIcon = (jobStatus?: SyncJobStatus) => {
    switch (jobStatus) {
      case 'pending':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      case 'processing':
      case 'processing_batches':
        return <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
    }
  }

  const getStatusText = (jobStatus?: SyncJobStatus) => {
    switch (jobStatus) {
      case 'pending':
        return 'Starting synchronization...'
      case 'processing':
        return 'Preparing product list...'
      case 'processing_batches':
        return 'Synchronizing products...'
      case 'completed':
        return 'Synchronization completed!'
      case 'failed':
        return 'Synchronization error'
      default:
        return 'Loading...'
    }
  }

  const getStatusColor = (jobStatus?: SyncJobStatus) => {
    switch (jobStatus) {
      case 'completed':
        return 'text-green-600 dark:text-green-400'
      case 'failed':
        return 'text-red-600 dark:text-red-400'
      case 'processing':
      case 'processing_batches':
        return 'text-blue-600 dark:text-blue-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  if (!status) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading synchronization status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const progress = status.progress?.percentage || 0
  const jobStatus = status.status

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center space-x-3">
          {getStatusIcon(jobStatus)}
          <div className="flex-1">
            <CardTitle className={`text-lg ${getStatusColor(jobStatus)}`}>
              {getStatusText(jobStatus)}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Job ID: {jobId}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {(jobStatus === 'pending' || jobStatus === 'processing' || jobStatus === 'processing_batches') && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Product Count Display */}
        {status.progress && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Products Synced</p>
              <p className="text-2xl font-bold">
                {status.progress.syncedProducts || 0}
                <span className="text-sm text-muted-foreground font-normal ml-1">
                  / {status.progress.totalProducts || status.progress.estimatedTotal || '?'}
                </span>
              </p>
              {status.progress.estimatedTotal > 0 && !status.progress.totalProducts && (
                <p className="text-xs text-muted-foreground italic">~{status.progress.estimatedTotal} estimated</p>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Estimated Time</p>
              <p className="text-lg font-bold">
                {status.eta || 'Calculating...'}
              </p>
            </div>
          </div>
        )}

        {/* Time Information */}
        <div className="flex justify-between text-sm pt-2 border-t">
          <div>
            <span className="text-muted-foreground">Elapsed Time:</span>
            <span className="ml-2 font-medium">{formatTime(elapsedTime)}</span>
          </div>

          {jobStatus === 'completed' && status.completedAt && (
            <div>
              <span className="text-muted-foreground">Completed:</span>
              <span className="ml-2 font-medium">
                {new Date(status.completedAt).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {jobStatus === 'completed' && !error && (
          <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Products synchronized successfully.
              {autoClose && (
                <span className="block text-xs mt-1 text-green-600 dark:text-green-400">
                  This message will close automatically...
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        {jobStatus === 'completed' && (
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              View Products
            </Button>
          </div>
        )}

        {jobStatus === 'failed' && (
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Close
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
