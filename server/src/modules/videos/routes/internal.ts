import { Router, Request, Response } from 'express'

const router = Router()

/**
 * POST /internal/videos/success
 * Webhook endpoint for RCK Description Server to notify video completion
 * NOT PROTECTED - Called by external service
 */
router.post('/videos/success', async (req: Request, res: Response) => {
  try {
    const { id_product, video_url } = req.body

    if (!id_product || !video_url) {
      return res.status(400).json({
        success: false,
        message: 'id_product and video_url are required'
      })
    }

    console.log('[Internal Webhook] Video completed:', { id_product, video_url })

    // Import Product model
    const Product = require('../../products/models/Product').default

    // Find the product
    const product = await Product.findById(id_product)

    if (!product) {
      console.error('[Internal Webhook] Product not found:', id_product)
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      })
    }

    // Find the most recent pending video for this product
    const videos = product.videos || []
    const pendingVideoIndex = videos.findIndex((v: any) => v.status === 'pending')

    if (pendingVideoIndex === -1) {
      console.warn('[Internal Webhook] No pending video found for product:', id_product)
      // Still return success to prevent retries from RCK server
      return res.json({
        success: true,
        message: 'No pending video found, but request acknowledged'
      })
    }

    // Update the pending video to completed
    videos[pendingVideoIndex].status = 'completed'
    videos[pendingVideoIndex].videoUrl = video_url
    videos[pendingVideoIndex].completedAt = new Date()

    product.videos = videos
    await product.save()

    console.log('[Internal Webhook] Video marked as completed for product:', id_product)

    res.json({
      success: true,
      message: 'Video status updated successfully',
      data: {
        productId: id_product,
        videoUrl: video_url
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
 */
router.post('/videos/failure', async (req: Request, res: Response) => {
  try {
    const { id_product, error } = req.body

    if (!id_product) {
      return res.status(400).json({
        success: false,
        message: 'id_product is required'
      })
    }

    console.log('[Internal Webhook] Video failed:', { id_product, error })

    // Import Product model
    const Product = require('../../products/models/Product').default

    // Find the product
    const product = await Product.findById(id_product)

    if (!product) {
      console.error('[Internal Webhook] Product not found:', id_product)
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      })
    }

    // Find the most recent pending video for this product
    const videos = product.videos || []
    const pendingVideoIndex = videos.findIndex((v: any) => v.status === 'pending')

    if (pendingVideoIndex === -1) {
      console.warn('[Internal Webhook] No pending video found for product:', id_product)
      return res.json({
        success: true,
        message: 'No pending video found, but request acknowledged'
      })
    }

    // Update the pending video to failed
    videos[pendingVideoIndex].status = 'failed'
    videos[pendingVideoIndex].error = error || 'Video generation failed'
    videos[pendingVideoIndex].completedAt = new Date()

    product.videos = videos
    await product.save()

    console.log('[Internal Webhook] Video marked as failed for product:', id_product)

    res.json({
      success: true,
      message: 'Video failure recorded successfully',
      data: {
        productId: id_product,
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
