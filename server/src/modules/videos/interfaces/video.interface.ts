import { Types } from 'mongoose'

export interface CreateVideoDTO {
  productId: string
  template: string // Template name from external RCK Description Server
  customInstructions?: string
  metadata?: Record<string, any>
}

export interface UpdateVideoDTO {
  template?: string
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
  template: string // Template name from external RCK Description Server
  customInstructions: string
  generatedDate: Date
  status: 'pending' | 'generating' | 'completed' | 'failed'
  metadata: Record<string, any> & {
    templateId?: string // Template UUID from external service
    title?: string // Will come from external service
    description?: string // Will come from external service
    externalJobId?: string
    youtubeVideoId?: string // YouTube video ID from external service
    localFilename?: string // File path on external server
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