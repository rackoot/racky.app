import { Router, Response } from 'express'
import { AuthenticatedRequest } from '../../../common/types/express'
import { VideoService } from '../services/videoService'
import { CreateVideoDTO, UpdateVideoDTO, VideoQuery } from '../interfaces/video.interface'
import Usage from '../../subscriptions/models/Usage'
import { rckDescriptionService } from '../../../common/services/rckDescriptionService'

const router = Router()

/**
 * GET /api/videos
 * Get all videos for the current workspace
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.user!._id)
    const workspaceId = String(req.workspace!._id)

    const query: VideoQuery = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string,
      productId: req.query.productId as string,
      search: req.query.search as string,
      sortBy: req.query.sortBy as any || 'createdAt',
      sortOrder: req.query.sortOrder as any || 'desc'
    }

    const result = await VideoService.getVideos(userId, workspaceId, query)

    res.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch videos'
    })
  }
})

/**
 * GET /api/videos/templates
 * Get available video templates from RCK Description Server
 */
router.get('/templates', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if RCK Description Server is configured
    if (!rckDescriptionService.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'RCK Description Server is not configured',
        templates: [],
        error: 'Service unavailable'
      })
    }

    // Fetch templates from external service
    const result = await rckDescriptionService.getVideoTemplates()

    console.log('[Video Templates] Result from RCK service:', JSON.stringify(result, null, 2))

    // Return in standardized API format
    res.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error('Error fetching video templates:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch video templates',
      templates: [],
      error: error.message
    })
  }
})

/**
 * GET /api/videos/usage/stats
 * Get video usage statistics for current workspace
 */
router.get('/usage/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = String(req.workspace!._id)

    // Get plan limits from workspace
    const workspacePlan = await (req.workspace as any).getCurrentPlan()
    const videoLimit = workspacePlan?.limits?.videoGenerations || 30

    const currentUsage = await Usage.getCurrentMonthUsage(workspaceId)
    const videoCount = currentUsage?.videoGenerations || 0

    const stats = {
      used: videoCount,
      limit: videoLimit,
      remaining: Math.max(0, videoLimit - videoCount),
      percentage: videoLimit > 0 ? Math.round((videoCount / videoLimit) * 100) : 0
    }

    res.json({
      success: true,
      data: stats
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch video usage stats'
    })
  }
})

/**
 * GET /api/videos/:id
 * Get a single video by ID
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.user!._id)
    const workspaceId = String(req.workspace!._id)
    const { id } = req.params

    const video = await VideoService.getVideoById(userId, workspaceId, id)

    res.json({
      success: true,
      data: video
    })
  } catch (error: any) {
    res.status(error.message === 'Video not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to fetch video'
    })
  }
})

/**
 * POST /api/videos
 * Create a new video
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.user!._id)
    const workspaceId = String(req.workspace!._id)
    const data: CreateVideoDTO = req.body

    if (!data.productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      })
    }

    const video = await VideoService.createVideo(userId, workspaceId, data)

    res.status(201).json({
      success: true,
      data: video
    })
  } catch (error: any) {
    res.status(error.message === 'Product not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to create video'
    })
  }
})

/**
 * POST /api/videos/generate-for-product
 * Generate video for a single product
 */
router.post('/generate-for-product', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.user!._id)
    const workspaceId = String(req.workspace!._id)
    const { productId, templateId, templateName, aspect_ratio } = req.body

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      })
    }

    if (!templateId || !templateName) {
      return res.status(400).json({
        success: false,
        message: 'Template ID and name are required'
      })
    }

    if (!aspect_ratio) {
      return res.status(400).json({
        success: false,
        message: 'Aspect ratio is required'
      })
    }

    // Check if RCK Description Server is configured
    if (!rckDescriptionService.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'RCK Description Server is not configured'
      })
    }

    // Import required models
    const Product = require('../../products/models/Product').default
    const { AIVideo } = require('../models/AIVideo')
    const Usage = require('../../subscriptions/models/Usage').default
    const { getEnv } = require('../../../common/config/env')

    // Fetch product
    const product = await Product.findOne({
      _id: productId,
      userId,
      workspaceId
    })

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      })
    }

    // Check video generation limits from workspace plan
    const workspacePlan = await (req.workspace as any).getCurrentPlan()
    if (!workspacePlan) {
      return res.status(402).json({
        success: false,
        message: 'Active subscription required to generate videos'
      })
    }

    const videoLimit = workspacePlan.limits.videoGenerations
    const currentUsage = await Usage.getCurrentMonthUsage(workspaceId)
    const videoCount = currentUsage?.videoGenerations || 0

    if (videoCount + 1 > videoLimit) {
      return res.status(403).json({
        success: false,
        message: `Video generation limit exceeded. You have ${videoLimit - videoCount} remaining out of ${videoLimit} for this billing period.`
      })
    }

    // Create AIVideo record BEFORE calling external API
    const video = await AIVideo.create({
      userId,
      workspaceId,
      productId: product._id,
      template: templateName,
      metadata: {
        templateId,
        aspect_ratio
      },
      status: 'generating',
      generatedDate: new Date()
    })

    // Increment video generation usage
    await Usage.incrementWorkspaceUsage(workspaceId, 'videoGenerations', 1)

    // Get environment configuration for callback URL
    const env = getEnv()
    const callbackUrl = `${env.SERVER_URL}/internal/videos/success`

    // Convert MongoDB ObjectId to integer for external API compatibility
    const objectIdToInt = (objectId: string): number => {
      return parseInt(objectId.substring(0, 8), 16)
    }

    // Prepare video request for external API
    const videoRequest = [{
      id_product: objectIdToInt(product._id.toString()),
      title: product.title,
      img_urls: product.images && product.images.length > 0
        ? product.images.map((img: any) => img.url)
        : [],
      user_id: userId,
      sku: product.sku || product._id.toString(),
      template_name: templateName,
      videoId: video._id.toString(),
      aspect_ratio
    }]

    // Call external video generation API
    try {
      const result = await rckDescriptionService.bulkGenerateVideos(videoRequest)

      console.log('[Single Video Generation] External API response:', {
        productId: product._id,
        response: result
      })

      // Check if the request was successful
      if (!result.success) {
        throw new Error(result.message || 'Video generation failed')
      }

      // Update video with external job ID if provided
      const jobIds = result.job_ids || []
      const externalJobId = jobIds[0] || `single_job_${Date.now()}`
      await AIVideo.findByIdAndUpdate(video._id, {
        $set: {
          'metadata.externalJobId': externalJobId,
          'metadata.queuedAt': new Date()
        }
      })
    } catch (error) {
      // If external API call fails, mark video as failed
      console.error('[Single Video Generation] External API error:', error)

      await AIVideo.findByIdAndUpdate(video._id, {
        $set: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Failed to start video generation'
        }
      })

      throw error
    }

    res.json({
      success: true,
      message: 'Video generation started. We\'ll notify you when it\'s ready!',
      data: {
        productId: product._id,
        productTitle: product.title,
        templateId,
        templateName,
        videoId: video._id.toString()
      }
    })
  } catch (error: any) {
    console.error('Error generating product video:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate video'
    })
  }
})

/**
 * POST /api/videos/bulk-generate
 * Generate videos for multiple products
 */
router.post('/bulk-generate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.user!._id)
    const workspaceId = String(req.workspace!._id)
    const { productIds, templateId, templateName, aspect_ratio } = req.body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs array is required'
      })
    }

    if (!templateId || !templateName) {
      return res.status(400).json({
        success: false,
        message: 'Template ID and name are required'
      })
    }

    if (!aspect_ratio) {
      return res.status(400).json({
        success: false,
        message: 'Aspect ratio is required'
      })
    }

    // Check if RCK Description Server is configured
    if (!rckDescriptionService.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'RCK Description Server is not configured'
      })
    }

    // Import required models
    const Product = require('../../products/models/Product').default
    const { AIVideo } = require('../models/AIVideo')
    const Usage = require('../../subscriptions/models/Usage').default
    const { getEnv } = require('../../../common/config/env')

    // Fetch all products
    const products = await Product.find({
      _id: { $in: productIds },
      userId,
      workspaceId
    })

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No products found'
      })
    }

    // Check video generation limits from workspace plan
    const workspacePlan = await (req.workspace as any).getCurrentPlan()
    if (!workspacePlan) {
      return res.status(402).json({
        success: false,
        message: 'Active subscription required to generate videos'
      })
    }

    const videoLimit = workspacePlan.limits.videoGenerations
    const currentUsage = await Usage.getCurrentMonthUsage(workspaceId)
    const videoCount = currentUsage?.videoGenerations || 0
    const videosNeeded = products.length

    if (videoCount + videosNeeded > videoLimit) {
      return res.status(403).json({
        success: false,
        message: `Video generation limit exceeded. You need ${videosNeeded} videos but only have ${videoLimit - videoCount} remaining out of ${videoLimit} for this billing period.`
      })
    }

    // Create AIVideo records for each product BEFORE calling external API
    const videoRecords = await Promise.all(
      products.map(async (product: any) => {
        const video = await AIVideo.create({
          userId,
          workspaceId,
          productId: product._id,
          template: templateName,
          metadata: {
            templateId
          },
          status: 'generating',
          generatedDate: new Date()
        })
        return {
          video,
          product
        }
      })
    )

    // Increment video generation usage
    await Usage.incrementWorkspaceUsage(workspaceId, 'videoGenerations', products.length)

    // Get environment configuration for callback URL
    const env = getEnv()
    const callbackUrl = `${env.SERVER_URL}/internal/videos/success`

    // Prepare video requests with videoId for external API
    // Convert MongoDB ObjectId to integer for external API compatibility
    const objectIdToInt = (objectId: string): number => {
      // Take first 8 characters of ObjectId hex and convert to integer
      // This gives us a unique integer for each product
      return parseInt(objectId.substring(0, 8), 16)
    }

    const videoRequests = videoRecords.map(({ video, product }) => ({
      id_product: objectIdToInt(product._id.toString()),
      title: product.title,
      img_urls: product.images && product.images.length > 0
        ? product.images.map((img: any) => img.url)
        : [],
      user_id: userId,
      sku: product.sku || product._id.toString(),
      template_name: templateName,
      videoId: video._id.toString(), // AIVideo MongoDB _id for webhook callback (camelCase as per API spec)
      aspect_ratio
    }))

    // Call external video generation API
    try {
      const result = await rckDescriptionService.bulkGenerateVideos(videoRequests)

      console.log('[Bulk Video Generation] External API response:', {
        productCount: products.length,
        response: result
      })

      // Check if the request was successful
      if (!result.success) {
        throw new Error(result.message || 'Video generation failed')
      }

      // Update each video with external job IDs if provided
      // The API returns job_ids array - one per product
      const jobIds = result.job_ids || []
      await Promise.all(
        videoRecords.map(({ video }, index) => {
          const externalJobId = jobIds[index] || `batch_job_${Date.now()}_${index}`
          return AIVideo.findByIdAndUpdate(video._id, {
            $set: {
              'metadata.externalJobId': externalJobId,
              'metadata.queuedAt': new Date()
            }
          })
        })
      )
    } catch (error) {
      // If external API call fails, mark all videos as failed
      console.error('[Bulk Video Generation] External API error:', error)

      await Promise.all(
        videoRecords.map(({ video }) =>
          AIVideo.findByIdAndUpdate(video._id, {
            $set: {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Failed to start video generation'
            }
          })
        )
      )

      throw error
    }

    res.json({
      success: true,
      message: `Video generation started for ${products.length} product(s). We'll notify you when they're ready!`,
      data: {
        productCount: products.length,
        templateId,
        templateName,
        videoIds: videoRecords.map(({ video }) => video._id.toString())
      }
    })
  } catch (error: any) {
    console.error('Error generating bulk videos:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate videos'
    })
  }
})

/**
 * POST /api/videos/:id/generate
 * Start video generation process
 */
router.post('/:id/generate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.user!._id)
    const workspaceId = String(req.workspace!._id)
    const { id } = req.params

    const video = await VideoService.generateVideo(userId, workspaceId, id)

    res.json({
      success: true,
      data: video,
      message: 'Video generation started'
    })
  } catch (error: any) {
    res.status(error.message === 'Video not found or already generating' ? 400 : 500).json({
      success: false,
      message: error.message || 'Failed to start video generation'
    })
  }
})

/**
 * PUT /api/videos/:id
 * Update a video
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.user!._id)
    const workspaceId = String(req.workspace!._id)
    const { id } = req.params
    const data: UpdateVideoDTO = req.body

    const video = await VideoService.updateVideo(userId, workspaceId, id, data)

    res.json({
      success: true,
      data: video
    })
  } catch (error: any) {
    res.status(error.message === 'Video not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to update video'
    })
  }
})

/**
 * DELETE /api/videos/:id
 * Delete a video
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.user!._id)
    const workspaceId = String(req.workspace!._id)
    const { id } = req.params

    await VideoService.deleteVideo(userId, workspaceId, id)

    res.json({
      success: true,
      message: 'Video deleted successfully'
    })
  } catch (error: any) {
    res.status(error.message === 'Video not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to delete video'
    })
  }
})

export default router