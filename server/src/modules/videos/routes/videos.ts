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

    const currentUsage = await Usage.getCurrentMonthUsage(workspaceId)

    const stats = {
      used: currentUsage?.videoGenerations || 0,
      limit: currentUsage?.monthlyLimits?.videoGenerations || 30,
      remaining: Math.max(0, (currentUsage?.monthlyLimits?.videoGenerations || 30) - (currentUsage?.videoGenerations || 0)),
      percentage: currentUsage?.monthlyLimits?.videoGenerations
        ? Math.round(((currentUsage?.videoGenerations || 0) / currentUsage.monthlyLimits.videoGenerations) * 100)
        : 0
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
 * Generate video for a single product (simulated - no external API call)
 */
router.post('/generate-for-product', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.user!._id)
    const workspaceId = String(req.workspace!._id)
    const { productId, templateId, templateName } = req.body

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

    // COMMENTED OUT: External API check - we're simulating
    // if (!rckDescriptionService.isConfigured()) {
    //   return res.status(503).json({
    //     success: false,
    //     message: 'RCK Description Server is not configured'
    //   })
    // }

    // Import Product model to fetch product details
    const Product = require('../../products/models/Product').default

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

    // COMMENTED OUT: External API call - we're just simulating
    // const videoRequest = {
    //   id_product: product._id.toString(),
    //   title: product.title,
    //   img_url: product.images && product.images.length > 0 ? product.images[0].url : '',
    //   user_id: userId,
    //   sku: product.handle || product.sku || product.externalId || '',
    //   template_name: templateName
    // }
    // const result = await rckDescriptionService.generateVideo(videoRequest)

    // Add new video entry with processing status (simulated)
    product.videos.push({
      templateId,
      templateName,
      status: 'processing', // Start with processing status
      createdAt: new Date()
    } as any)
    await product.save()

    res.json({
      success: true,
      message: 'Video will process, we\'ll let you know when it\'s ready!',
      data: {
        productId: product._id,
        productTitle: product.title,
        templateId,
        templateName
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
 * Generate videos for multiple products (simulated - no external API call)
 */
router.post('/bulk-generate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = String(req.user!._id)
    const workspaceId = String(req.workspace!._id)
    const { productIds, templateId, templateName } = req.body

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

    // COMMENTED OUT: External API check - we're simulating
    // if (!rckDescriptionService.isConfigured()) {
    //   return res.status(503).json({
    //     success: false,
    //     message: 'RCK Description Server is not configured'
    //   })
    // }

    // Import Product model to fetch product details
    const Product = require('../../products/models/Product').default

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

    // COMMENTED OUT: External API call - we're just simulating
    // const videoRequests = products.map((product: any) => ({
    //   id_product: product._id.toString(),
    //   title: product.title,
    //   img_url: product.images && product.images.length > 0 ? product.images[0].url : '',
    //   user_id: userId,
    //   sku: product.handle || product.sku || product.externalId || '',
    //   template_name: templateName
    // }))
    // const result = await rckDescriptionService.bulkGenerateVideos(videoRequests)

    // Add new video entry to each product with processing status (simulated)
    for (const productId of productIds) {
      await Product.updateOne(
        { _id: productId, userId, workspaceId },
        {
          $push: {
            videos: {
              templateId,
              templateName,
              status: 'processing', // Start with processing status
              createdAt: new Date()
            }
          }
        }
      )
    }

    res.json({
      success: true,
      message: `Video will process for ${products.length} product(s), we'll let you know when they're ready!`,
      data: {
        productCount: products.length,
        templateId,
        templateName
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