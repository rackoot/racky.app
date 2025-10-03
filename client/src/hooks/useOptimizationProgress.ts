import { useState, useEffect, useCallback } from 'react'
import { optimizationsApi } from '@/api'

interface OptimizationProgress {
  status: 'idle' | 'processing' | 'completed' | 'failed'
  progress: number
  eta: string
  jobId?: string
}

export function useOptimizationProgress(productId: string, platform: string) {
  const [progress, setProgress] = useState<OptimizationProgress>({
    status: 'idle',
    progress: 0,
    eta: ''
  })

  const startOptimization = useCallback(async () => {
    try {
      setProgress({ status: 'processing', progress: 0, eta: 'Starting...' })
      
      const result = await optimizationsApi.startIndividualOptimization(productId, platform)
      
      setProgress({
        status: 'processing',
        progress: 10,
        eta: result.estimatedTime,
        jobId: result.jobId
      })

      // Simulate progress updates
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev.progress >= 90) {
            clearInterval(interval)
            return { ...prev, status: 'completed', progress: 100, eta: 'Complete!' }
          }
          return {
            ...prev,
            progress: Math.min(prev.progress + Math.random() * 15, 90),
            eta: `${Math.max(1, Math.floor((100 - prev.progress) / 20))} minutes remaining`
          }
        })
      }, 2000)

      return () => clearInterval(interval)
    } catch (error) {
      setProgress({ status: 'failed', progress: 0, eta: 'Failed to start optimization' })
    }
  }, [productId, platform])

  const reset = useCallback(() => {
    setProgress({ status: 'idle', progress: 0, eta: '' })
  }, [])

  return {
    progress,
    startOptimization,
    reset,
    isProcessing: progress.status === 'processing'
  }
}