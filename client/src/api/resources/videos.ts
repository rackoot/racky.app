import { apiGet, apiPost, apiPut, apiDelete } from '../client'

export type VideoTemplate = 'product_showcase' | 'human_usage' | 'store_display' | 'lifestyle' | 'technical_demo' | 'unboxing'

export interface AIVideo {
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
  customInstructions?: string
  generatedDate: string
  status: 'pending' | 'generating' | 'completed' | 'failed'
  metadata: {
    title?: string // Will come from external service
    description?: string // Will come from external service
    duration?: number
    format?: string
    resolution?: string
    fileSize?: number
    videoUrl?: string
    thumbnailUrl?: string
    generationTime?: number
    aiModel?: string
    externalJobId?: string
    [key: string]: any
  }
  error?: string
  createdAt: string
  updatedAt: string
}

export interface VideosQuery {
  page?: number
  limit?: number
  status?: string
  productId?: string
  search?: string
  sortBy?: 'createdAt' | 'generatedDate' | 'title'
  sortOrder?: 'asc' | 'desc'
}

export interface VideosResponse {
  videos: AIVideo[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

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

export interface VideoUsageStats {
  used: number
  limit: number
  remaining: number
  percentage: number
}

// Videos API endpoints configuration
const VIDEOS_ENDPOINTS = {
  LIST: '/videos',
  GET: (id: string) => `/videos/${id}`,
  CREATE: '/videos',
  UPDATE: (id: string) => `/videos/${id}`,
  DELETE: (id: string) => `/videos/${id}`,
  GENERATE: (id: string) => `/videos/${id}/generate`,
  USAGE_STATS: '/videos/usage/stats'
}

export const videosApi = {
  /**
   * Get all videos with optional filters and pagination
   */
  async getVideos(query: VideosQuery = {}): Promise<VideosResponse> {
    const searchParams = new URLSearchParams()

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, value.toString())
      }
    })

    const url = `${VIDEOS_ENDPOINTS.LIST}?${searchParams.toString()}`
    return apiGet<VideosResponse>(url)
  },

  /**
   * Get a single video by ID
   */
  async getVideoById(id: string): Promise<AIVideo> {
    return apiGet<AIVideo>(VIDEOS_ENDPOINTS.GET(id))
  },

  /**
   * Create a new video
   */
  async createVideo(data: CreateVideoDTO): Promise<AIVideo> {
    return apiPost<AIVideo>(VIDEOS_ENDPOINTS.CREATE, data)
  },

  /**
   * Update a video
   */
  async updateVideo(id: string, data: UpdateVideoDTO): Promise<AIVideo> {
    return apiPut<AIVideo>(VIDEOS_ENDPOINTS.UPDATE(id), data)
  },

  /**
   * Delete a video
   */
  async deleteVideo(id: string): Promise<void> {
    return apiDelete(VIDEOS_ENDPOINTS.DELETE(id))
  },

  /**
   * Start video generation process
   */
  async generateVideo(id: string): Promise<AIVideo> {
    return apiPost<AIVideo>(VIDEOS_ENDPOINTS.GENERATE(id))
  },

  /**
   * Get video usage statistics for current workspace
   */
  async getUsageStats(): Promise<VideoUsageStats> {
    return apiGet<VideoUsageStats>(VIDEOS_ENDPOINTS.USAGE_STATS)
  }
}