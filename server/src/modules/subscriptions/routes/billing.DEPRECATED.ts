// DEPRECATED FILE - BILLING MOVED TO WORKSPACE LEVEL
// This file contains the old user-based billing implementation
// It needs to be completely rewritten for workspace-based subscriptions

import express, { Response } from 'express';
import { AuthenticatedRequest } from '@/common/types/express';

const router = express.Router();

// All billing endpoints are deprecated and need workspace-based implementation
router.all('*', (req: AuthenticatedRequest, res: Response) => {
  res.status(501).json({
    success: false,
    message: 'Billing system is under migration to workspace-based subscriptions',
    deprecated: true,
    migrationInfo: {
      status: 'IN_PROGRESS',
      message: 'Billing functionality has been temporarily disabled during the migration from user-based to workspace-based subscriptions.',
      expectedCompletion: 'To be implemented',
      contactSupport: 'Please contact support for subscription management during this transition'
    }
  });
});

export default router;