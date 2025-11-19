import { Router, Request, Response } from 'express';
import WebhookEvent from '../models/WebhookEvent';
import { protect, requireSuperAdmin } from '@/common/middleware/auth';

const router = Router();

/**
 * GET /api/webhook-events
 * List all webhook events with pagination
 * PROTECTED - SUPERADMIN only
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - endpoint: string (optional filter)
 */
router.get('/', protect, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {};
    if (req.query.endpoint) {
      filter.endpoint = req.query.endpoint;
    }

    // Get events with pagination
    const [events, total] = await Promise.all([
      WebhookEvent.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WebhookEvent.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('[WebhookEvents] Error listing events:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to list webhook events'
    });
  }
});

/**
 * GET /api/webhook-events/:id
 * Get specific webhook event by ID
 * PROTECTED - SUPERADMIN only
 */
router.get('/:id', protect, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const event = await WebhookEvent.findById(req.params.id).lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Webhook event not found'
      });
    }

    res.json({
      success: true,
      data: event
    });
  } catch (error: any) {
    console.error('[WebhookEvents] Error getting event:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get webhook event'
    });
  }
});

export default router;
