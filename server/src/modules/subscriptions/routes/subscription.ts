import express from 'express';
import { protect, requireWorkspace, requireWorkspacePermission } from '@/common/middleware/auth';
import { subscriptionController } from '../controllers/controller';

const router = express.Router();

// GET /api/subscription/:workspaceId - Get workspace subscription info
router.get('/:workspaceId', 
  protect, 
  requireWorkspace, 
  requireWorkspacePermission('workspace:read'), 
  subscriptionController.getWorkspaceSubscription.bind(subscriptionController)
);

// POST /api/subscription/:workspaceId/preview - Preview subscription changes with pricing
router.post('/:workspaceId/preview', 
  protect, 
  requireWorkspace, 
  requireWorkspacePermission('workspace:read'), 
  subscriptionController.previewSubscriptionChanges.bind(subscriptionController)
);

// PUT /api/subscription/:workspaceId - Update/Create workspace subscription
router.put('/:workspaceId', 
  protect, 
  requireWorkspace, 
  requireWorkspacePermission('workspace:manage_subscription'), 
  subscriptionController.updateWorkspaceSubscription.bind(subscriptionController)
);

// DELETE /api/subscription/:workspaceId - Cancel workspace subscription
router.delete('/:workspaceId', 
  protect, 
  requireWorkspace, 
  requireWorkspacePermission('workspace:manage_subscription'), 
  subscriptionController.cancelWorkspaceSubscription.bind(subscriptionController)
);

export default router;