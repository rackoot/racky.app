// TEMPORARY BILLING ROUTES - NEEDS COMPLETE REWRITE FOR WORKSPACE-BASED SUBSCRIPTIONS
// This is a temporary implementation to prevent compilation errors
// The full billing system needs to be rewritten to work with workspace subscriptions

import express, { Response } from 'express';
import { AuthenticatedRequest } from '@/common/types/express';

const router = express.Router();

// Temporary implementation - all billing endpoints return "under maintenance"
router.post('/create-checkout-session', (req: AuthenticatedRequest, res: Response) => {
  res.status(503).json({
    success: false,
    message: 'Billing system is under maintenance',
    maintenanceInfo: {
      reason: 'Migration to workspace-based subscriptions in progress',
      status: 'TEMPORARILY_DISABLED',
      alternativeAction: 'Please contact support for subscription management'
    }
  });
});

router.post('/stripe/webhook', (req: express.Request, res: Response) => {
  // Acknowledge webhook but don't process during migration
  res.status(200).send('Webhook acknowledged - system under maintenance');
});

router.get('/subscription', (req: AuthenticatedRequest, res: Response) => {
  res.status(503).json({
    success: false,
    message: 'Subscription information temporarily unavailable',
    maintenanceInfo: {
      reason: 'Migration to workspace-based subscriptions in progress',
      status: 'TEMPORARILY_DISABLED'
    }
  });
});

router.post('/cancel-subscription', (req: AuthenticatedRequest, res: Response) => {
  res.status(503).json({
    success: false,
    message: 'Subscription management temporarily unavailable',
    maintenanceInfo: {
      reason: 'Migration to workspace-based subscriptions in progress',
      status: 'TEMPORARILY_DISABLED',
      alternativeAction: 'Please contact support for cancellation requests'
    }
  });
});

router.get('/invoices', (req: AuthenticatedRequest, res: Response) => {
  res.status(503).json({
    success: false,
    message: 'Invoice access temporarily unavailable',
    maintenanceInfo: {
      reason: 'Migration to workspace-based subscriptions in progress',
      status: 'TEMPORARILY_DISABLED'
    }
  });
});

export default router;