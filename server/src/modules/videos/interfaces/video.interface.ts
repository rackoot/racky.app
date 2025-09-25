import { Types } from 'mongoose'

export type VideoTemplate = 'product_showcase' | 'human_usage' | 'store_display' | 'lifestyle' | 'technical_demo' | 'unboxing'

export interface CreateVideoDTO {
  productId: string
  template: VideoTemplate
  customInstructions?: string
  metadata?: Record<string, any>
}

export interface UpdateVideoDTO {
  template?: VideoTemplate
  customInstructions?: string
  status?: 'pending' | 'generating' | 'completed' | 'failed'
  metadata?: Record<string, any>
  error?: string
}

export interface VideoQuery {
  page?: number
  limit?: number
  status?: string
  productId?: string
  search?: string
  sortBy?: 'createdAt' | 'generatedDate' | 'title'
  sortOrder?: 'asc' | 'desc'
}

export interface VideoResponse {
  _id: string
  userId: string
  workspaceId: string
  productId: string
  product?: {
    _id: string
    title: string
    imageUrl?: string
    marketplace: string
    price?: number
    currency?: string
  }
  template: VideoTemplate
  customInstructions: string
  generatedDate: Date
  status: 'pending' | 'generating' | 'completed' | 'failed'
  metadata: Record<string, any> & {
    title?: string // Will come from external service
    description?: string // Will come from external service
    externalJobId?: string
  }
  error?: string
  createdAt: Date
  updatedAt: Date
}

export interface VideosListResponse {
  videos: VideoResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}