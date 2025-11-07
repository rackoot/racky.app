import { PaginationResponse } from './common'

// Product Video types
export type VideoStatus = 'processing' | 'pending' | 'completed' | 'failed'

export interface ProductVideo {
  _id?: string
  templateId: string
  templateName: string
  status: VideoStatus
  videoUrl?: string
  youtubeUrl?: string
  error?: string
  createdAt: string
  completedAt?: string
}

// Product types
export interface Product {
  id?: string
  _id?: string
  title: string
  description: string
  price: number
  compareAtPrice?: number
  inventory: number
  vendor: string
  productType: string
  tags: string[]
  images: Array<{
    url: string
    altText?: string
  }>
  status: string
  shopifyId: string
  handle: string
  createdAt: string
  updatedAt: string
  marketplace?: string
  isMarketplaceConnected?: boolean
  marketplaceUrl?: string
  variants?: Array<{
    id: string
    title: string
    price: number
    compareAtPrice?: number
    sku?: string
    inventory: number
    weight?: number
    weightUnit?: string
  }>
  videos?: ProductVideo[] // Marketplace videos (uploaded to VTEX, Shopify, etc.)
  aiGeneratedVideos?: ProductVideo[] // AI-generated videos from AIVideo collection
  hasAIDescription?: boolean
  aiDescriptionStatus?: 'pending' | 'accepted' | 'rejected' | null
}

export interface ProductsResponse {
  products: Product[]
  pagination: PaginationResponse
  filters: {
    marketplaces: Array<{
      marketplace: string
      count: number
    }>
  }
}

export interface ProductsQuery {
  page?: number
  limit?: number
  search?: string
  marketplace?: string
  store?: string // Store connection ID
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  status?: string
}
