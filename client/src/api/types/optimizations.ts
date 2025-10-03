// Optimization types
export interface OptimizationSuggestion {
  id: string
  originalContent: string
  suggestedContent: string
  status: 'pending' | 'accepted' | 'rejected'
  metadata: {
    model: string
    tokens: number
    confidence: number
    keywords: string[]
    prompt?: string
  }
  createdAt: string
}

export interface SuggestionHistory {
  id: string
  platform: string
  type: string
  title: string
  description: string
  originalContent: string
  suggestedContent: string
  status: 'pending' | 'accepted' | 'rejected'
  metadata: {
    model: string
    tokens: number
    confidence: number
    keywords: string[]
  }
  createdAt: string
  updatedAt: string
}

export interface OptimizationJobStatus {
  jobId: string
  status: string
  estimatedTime: string
}

export interface ProductOptimizationStatus {
  productId: string
  platforms: Record<string, {
    inQueue: boolean
    queueStatus: {
      status: 'queued' | 'processing' | 'recently_optimized'
      jobId?: string
      batchNumber?: number
      totalBatches?: number
      marketplace?: string
      optimizedAt?: string
    } | null
    hasOptimization: boolean
    optimization: {
      id: string
      content: string
      status: 'pending' | 'accepted' | 'rejected'
      confidence: number
      createdAt: string
    } | null
  }>
  availablePlatforms: string[]
}
