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

    res.json(result)
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

export default router