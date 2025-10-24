import { Router, Request, Response } from 'express'
import mongoose from 'mongoose'
import Joi from 'joi'

const router = Router()

// Validation schemas
const videoSuccessSchema = Joi.object({
  videoId: Joi.string().required().messages({
    'string.empty': 'videoId is required',
    'any.required': 'videoId is required'
  }),
  youtubeVideoId: Joi.string().optional().allow(null, ''),
  localFilename: Joi.string().optional().allow(null, ''),
  video_url: Joi.string().optional().allow(null, ''),
  id_product: Joi.string().optional() // Backward compatibility
})

const videoFailureSchema = Joi.object({
  videoId: Joi.string().required().messages({
    'string.empty': 'videoId is required',
    'any.required': 'videoId is required'
  }),
  error: Joi.string().optional().allow(null, ''),
  id_product: Joi.string().optional() // Backward compatibility
})

/**
 * POST /internal/videos/success
 * Webhook endpoint for RCK Description Server to notify video completion
 * NOT PROTECTED - Called by external service
 *
 * Payload:
 * - videoId: AIVideo MongoDB _id (required)
 * - youtubeVideoId: YouTube video ID (optional)
 * - localFilename: File path on external server (optional)
 * - video_url: Direct video URL (optional)
 * - id_product: Product ID for backward compatibility (optional)
 */
router.post('/videos/success', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error, value } = videoSuccessSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      })
    }

    const { videoId, youtubeVideoId, localFilename, video_url, id_product } = value

    // Validate videoId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid videoId format'
      })
    }

    console.log('[Internal Webhook] Video completed:', {
      videoId,
      youtubeVideoId,
      localFilename,
      video_url
    })

    // Import models
    const { AIVideo } = require('../models/AIVideo')
    const Product = require('../../products/models/Product').default

    // Find the AIVideo record
    const video = await AIVideo.findById(videoId)

    if (!video) {
      console.error('[Internal Webhook] AIVideo not found:', videoId)
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      })
    }

    // Update AIVideo record
    video.status = 'completed'
    video.metadata = {
      ...video.metadata,
      youtubeVideoId,
      localFilename,
      videoUrl: video_url || video.metadata?.videoUrl,
      completedAt: new Date()
    }
    await video.save()

    console.log('[Internal Webhook] AIVideo updated:', videoId)

    // Also update Product.videos array for dual storage
    const product = await Product.findById(video.productId)
    if (product) {
      const videos = product.videos || []
      const pendingVideoIndex = videos.findIndex((v: any) =>
        v.status === 'pending' || v.status === 'generating'
      )

      if (pendingVideoIndex !== -1) {
        videos[pendingVideoIndex].status = 'completed'
        videos[pendingVideoIndex].videoUrl = video_url
        videos[pendingVideoIndex].youtubeUrl = youtubeVideoId ? `https://www.youtube.com/watch?v=${youtubeVideoId}` : undefined
        videos[pendingVideoIndex].completedAt = new Date()
        product.videos = videos
        await product.save()
        console.log('[Internal Webhook] Product.videos array updated for product:', video.productId)
      }
    }

    res.json({
      success: true,
      message: 'Video status updated successfully',
      data: {
        videoId,
        youtubeVideoId,
        localFilename,
        videoUrl: video_url,
        productId: video.productId.toString()
      }
    })
  } catch (error: any) {
    console.error('[Internal Webhook] Error processing video completion:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process video completion'
    })
  }
})

/**
 * POST /internal/videos/failure
 * Webhook endpoint for RCK Description Server to notify video failure
 * NOT PROTECTED - Called by external service
 *
 * Payload:
 * - videoId: AIVideo MongoDB _id (required)
 * - error: Error message (optional)
 * - id_product: Product ID for backward compatibility (optional)
 */
router.post('/videos/failure', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { error: validationError, value } = videoFailureSchema.validate(req.body)
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.details[0].message
      })
    }

    const { videoId, error, id_product } = value

    // Validate videoId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid videoId format'
      })
    }

    console.log('[Internal Webhook] Video failed:', { videoId, error })

    // Import models
    const { AIVideo } = require('../models/AIVideo')
    const Product = require('../../products/models/Product').default

    // Find the AIVideo record
    const video = await AIVideo.findById(videoId)

    if (!video) {
      console.error('[Internal Webhook] AIVideo not found:', videoId)
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      })
    }

    // Update AIVideo record
    video.status = 'failed'
    video.error = error || 'Video generation failed'
    video.metadata = {
      ...video.metadata,
      failedAt: new Date()
    }
    await video.save()

    console.log('[Internal Webhook] AIVideo marked as failed:', videoId)

    // Also update Product.videos array for dual storage
    const product = await Product.findById(video.productId)
    if (product) {
      const videos = product.videos || []
      const pendingVideoIndex = videos.findIndex((v: any) =>
        v.status === 'pending' || v.status === 'generating'
      )

      if (pendingVideoIndex !== -1) {
        videos[pendingVideoIndex].status = 'failed'
        videos[pendingVideoIndex].error = error || 'Video generation failed'
        videos[pendingVideoIndex].completedAt = new Date()
        product.videos = videos
        await product.save()
        console.log('[Internal Webhook] Product.videos array updated for product:', video.productId)
      }
    }

    res.json({
      success: true,
      message: 'Video failure recorded successfully',
      data: {
        videoId,
        productId: video.productId.toString(),
        error
      }
    })
  } catch (error: any) {
    console.error('[Internal Webhook] Error processing video failure:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process video failure'
    })
  }
})

export default router
