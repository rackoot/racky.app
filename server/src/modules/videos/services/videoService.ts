import { AIVideo, IAIVideo } from '../models/AIVideo'
import Product from '../../products/models/Product'
import Usage from '../../subscriptions/models/Usage'
import { CreateVideoDTO, UpdateVideoDTO, VideoQuery, VideoResponse, VideosListResponse } from '../interfaces/video.interface'
import { Types } from 'mongoose'
import { rckDescriptionService } from '@/common/services/rckDescriptionService'
import { getEnv } from '@/common/config/env'

export class VideoService {
  /**
   * Create a new AI video
   */
  static async createVideo(
    userId: string,
    workspaceId: string,
    data: CreateVideoDTO
  ): Promise<VideoResponse> {
    // Check video generation limits first
    const currentUsage = await Usage.getCurrentMonthUsage(workspaceId)
    if (currentUsage) {
      const videoLimit = currentUsage.monthlyLimits.videoGenerations
      const videoCount = currentUsage.videoGenerations

      if (videoCount >= videoLimit) {
        throw new Error(`Video generation limit reached. You have used ${videoCount}/${videoLimit} videos for this billing period. Please wait for your subscription to renew.`)
      }
    }

    // Verify product exists and belongs to user's workspace
    const product = await Product.findOne({
      _id: data.productId,
      userId,
      workspaceId
    })

    if (!product) {
      throw new Error('Product not found')
    }

    // Create video with template and custom instructions
    const video = await AIVideo.create({
      userId,
      workspaceId,
      productId: data.productId,
      template: data.template,
      customInstructions: data.customInstructions,
      metadata: data.metadata || {},
      status: 'pending'
    })

    // Increment video generation usage
    await Usage.incrementWorkspaceUsage(workspaceId, 'videoGenerations', 1)

    return this.formatVideoResponse(video, product)
  }

  /**
   * Get all videos for a workspace
   */
  static async getVideos(
    userId: string,
    workspaceId: string,
    query: VideoQuery
  ): Promise<VideosListResponse> {
    const {
      page = 1,
      limit = 20,
      status,
      productId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query

    // Build query
    const filter: any = {
      userId,
      workspaceId
    }

    if (status) {
      filter.status = status
    }

    if (productId) {
      filter.productId = productId
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    }

    // Execute query with pagination
    const skip = (page - 1) * limit
    const sortOptions: Record<string, 1 | -1> = {}
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1

    const [videos, total] = await Promise.all([
      AIVideo.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      AIVideo.countDocuments(filter)
    ])

    // Get all product IDs
    const productIds = videos.map(v => v.productId)

    // Fetch all products
    const products = await Product.find({
      _id: { $in: productIds }
    }).lean()

    // Create product map
    const productMap = new Map(products.map(p => [p._id.toString(), p]))

    // Format videos with product data
    const formattedVideos = videos.map(video => {
      const product = productMap.get(video.productId.toString())
      return this.formatVideoResponse(video as IAIVideo, product)
    })

    return {
      videos: formattedVideos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }

  /**
   * Get a single video by ID
   */
  static async getVideoById(
    userId: string,
    workspaceId: string,
    videoId: string
  ): Promise<VideoResponse> {
    const video = await AIVideo.findOne({
      _id: videoId,
      userId,
      workspaceId
    })

    if (!video) {
      throw new Error('Video not found')
    }

    const product = await Product.findById(video.productId)
    return this.formatVideoResponse(video, product)
  }

  /**
   * Update a video
   */
  static async updateVideo(
    userId: string,
    workspaceId: string,
    videoId: string,
    data: UpdateVideoDTO
  ): Promise<VideoResponse> {
    const video = await AIVideo.findOneAndUpdate(
      { _id: videoId, userId, workspaceId },
      { $set: data },
      { new: true }
    )

    if (!video) {
      throw new Error('Video not found')
    }

    const product = await Product.findById(video.productId)
    return this.formatVideoResponse(video, product)
  }

  /**
   * Delete a video
   */
  static async deleteVideo(
    userId: string,
    workspaceId: string,
    videoId: string
  ): Promise<void> {
    const result = await AIVideo.deleteOne({
      _id: videoId,
      userId,
      workspaceId
    })

    if (result.deletedCount === 0) {
      throw new Error('Video not found')
    }
  }

  /**
   * Start video generation process
   */
  static async generateVideo(
    userId: string,
    workspaceId: string,
    videoId: string
  ): Promise<VideoResponse> {
    const video = await AIVideo.findOneAndUpdate(
      {
        _id: videoId,
        userId,
        workspaceId,
        status: 'pending'
      },
      {
        $set: {
          status: 'generating',
          generatedDate: new Date()
        }
      },
      { new: true }
    )

    if (!video) {
      throw new Error('Video not found or already generating')
    }

    // Get product data for API call
    const product = await Product.findById(video.productId)
    if (!product) {
      throw new Error('Product not found')
    }

    try {
      // Convert MongoDB ObjectId to integer for external API compatibility
      const objectIdToInt = (objectId: string): number => {
        // Take first 8 characters of ObjectId hex and convert to integer
        return parseInt(objectId.substring(0, 8), 16)
      }

      // Call external video generation API
      const response = await rckDescriptionService.generateVideo({
        id_product: objectIdToInt(product._id.toString()),
        title: product.title,
        img_url: product.images && product.images.length > 0 ? product.images[0].url : '',
        user_id: userId,
        sku: product.sku || product._id.toString(),
        template_name: video.template,
        videoId: videoId // AIVideo MongoDB _id for webhook callback (camelCase as per API spec)
      })

      // Update video with external job ID for tracking (if provided by external API)
      const externalJobId = response.job_id || response.externalJobId || `job_${Date.now()}`
      await AIVideo.findByIdAndUpdate(videoId, {
        $set: {
          'metadata.externalJobId': externalJobId
        }
      })

      console.log('[VideoService] Video generation started:', {
        videoId,
        externalJobId,
        productId: product._id.toString()
      })
    } catch (error) {
      // If external API call fails, mark video as failed
      await AIVideo.findByIdAndUpdate(videoId, {
        $set: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Failed to start video generation'
        }
      })
      throw error
    }

    return this.formatVideoResponse(video, product)
  }

  /**
   * Format video response with product data
   */
  private static formatVideoResponse(video: IAIVideo | any, product: any): VideoResponse {
    return {
      _id: video._id.toString(),
      userId: video.userId.toString(),
      workspaceId: video.workspaceId.toString(),
      productId: video.productId.toString(),
      product: product ? {
        _id: product._id.toString(),
        title: product.title,
        imageUrl: product.images && product.images.length > 0 ? product.images[0].url : undefined,
        marketplace: product.marketplace,
        price: product.price,
        currency: product.currency
      } : undefined,
      template: video.template,
      customInstructions: video.customInstructions,
      generatedDate: video.generatedDate,
      status: video.status,
      metadata: video.metadata,
      error: video.error,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt
    }
  }
}