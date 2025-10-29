import { useState, useEffect, useCallback, useRef } from 'react'
import { productsApi } from '@/api/resources/products'
import type { SyncJobStatusResponse, SyncJobStatus } from '@/types/sync'

interface UseSyncPollingOptions {
  jobId: string | null
  interval?: number // Poll interval in milliseconds (default: 5000)
  onComplete?: (data: SyncJobStatusResponse['data']) => void
  onError?: (error: string) => void
  onProgress?: (data: SyncJobStatusResponse['data']) => void
  enabled?: boolean // Whether polling is enabled (default: true)
}

interface UseSyncPollingReturn {
  status: SyncJobStatusResponse | null
  isPolling: boolean
  error: string | null
  startPolling: () => void
  stopPolling: () => void
  refetch: () => Promise<void>
}

/**
 * Custom hook for polling sync job status
 *
 * @example
 * const { status, isPolling, startPolling, stopPolling } = useSyncPolling({
 *   jobId: 'abc123',
 *   interval: 5000,
 *   onComplete: (data) => console.log('Sync completed!', data),
 *   onError: (error) => console.error('Sync failed:', error)
 * })
 */
export function useSyncPolling({
  jobId,
  interval = 5000,
  onComplete,
  onError,
  onProgress,
  enabled = true
}: UseSyncPollingOptions): UseSyncPollingReturn {
  const [status, setStatus] = useState<SyncJobStatusResponse | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const previousStatusRef = useRef<SyncJobStatus | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!jobId) {
      return
    }

    try {
      const response = await productsApi.getSyncStatus(jobId)
      setStatus(response)
      setError(null)

      const currentStatus = response.data.status

      // Call onProgress if status is processing and data changed
      if (currentStatus === 'processing' && onProgress) {
        onProgress(response.data)
      }

      // Check if status changed to completed or failed
      if (previousStatusRef.current !== currentStatus) {
        if (currentStatus === 'completed') {
          setIsPolling(false)
          if (onComplete) {
            onComplete(response.data)
          }
        } else if (currentStatus === 'failed') {
          setIsPolling(false)
          const errorMsg = response.data.error || 'Sync failed'
          setError(errorMsg)
          if (onError) {
            onError(errorMsg)
          }
        }
      }

      previousStatusRef.current = currentStatus

      // Stop polling if job completed or failed
      if (currentStatus === 'completed' || currentStatus === 'failed') {
        stopPolling()
      }
    } catch (err) {
      console.error('Error fetching sync status:', err)
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch sync status'
      setError(errorMsg)
      // Don't stop polling on error - continue trying
    }
  }, [jobId, onComplete, onError, onProgress])

  const startPolling = useCallback(() => {
    if (!jobId || isPolling) {
      return
    }

    setIsPolling(true)

    // Fetch immediately
    fetchStatus()

    // Then poll at interval
    intervalRef.current = setInterval(fetchStatus, interval)
  }, [jobId, isPolling, fetchStatus, interval])

  const stopPolling = useCallback(() => {
    setIsPolling(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const refetch = useCallback(async () => {
    await fetchStatus()
  }, [fetchStatus])

  // Auto-start polling when jobId changes and enabled is true
  useEffect(() => {
    if (jobId && enabled && !isPolling) {
      startPolling()
    }

    return () => {
      stopPolling()
    }
  }, [jobId, enabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [])

  return {
    status,
    isPolling,
    error,
    startPolling,
    stopPolling,
    refetch
  }
}
