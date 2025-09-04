import express, { Response } from 'express';
import Joi from 'joi';
import { Types } from 'mongoose';
import { AuthenticatedRequest } from '@/common/types/express';
import { protect, requireWorkspace, requireWorkspacePermission, requireWorkspaceRole } from '@/common/middleware/auth';
import { WorkspaceService } from '../services/workspaceService';
import { ICreateWorkspaceRequest, IUpdateWorkspaceRequest, IWorkspaceInviteRequest } from '../interfaces/workspace';

const router = express.Router();

// Validation schemas
const createWorkspaceSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(500).optional(),
  slug: Joi.string().regex(/^[a-z0-9-]+$/).max(50).optional(),
  settings: Joi.object({
    timezone: Joi.string().optional(),
    currency: Joi.string().length(3).optional(),
    language: Joi.string().length(2).optional()
  }).optional()
});

const updateWorkspaceSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(500).optional().allow(''),
  settings: Joi.object({
    timezone: Joi.string().optional(),
    currency: Joi.string().length(3).optional(),
    language: Joi.string().length(2).optional()
  }).optional(),
  isActive: Joi.boolean().optional()
});

const inviteUserSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('ADMIN', 'OPERATOR', 'VIEWER').required(),
  message: Joi.string().max(500).optional()
});

const updateRoleSchema = Joi.object({
  role: Joi.string().valid('ADMIN', 'OPERATOR', 'VIEWER').required()
});


// Get all workspaces for authenticated user
router.get('/', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaces = await WorkspaceService.getUserWorkspaces(req.user!._id as Types.ObjectId);
    
    res.json({
      success: true,
      message: 'Workspaces retrieved successfully',
      data: workspaces
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving workspaces',
      error: (error as Error).message
    });
  }
});

// Create new workspace
router.post('/', protect, async (req: AuthenticatedRequest<ICreateWorkspaceRequest>, res: Response) => {
  try {
    const { error } = createWorkspaceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    // TODO: Check workspace limits based on user's plan
    // For now, allow unlimited workspaces for all users

    const workspace = await WorkspaceService.createWorkspace(req.user!._id as Types.ObjectId, req.body);
    
    res.status(201).json({
      success: true,
      message: 'Workspace created successfully',
      data: workspace
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating workspace',
      error: (error as Error).message
    });
  }
});

// Get specific workspace
router.get('/:workspaceId', protect, requireWorkspace, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const workspace = await WorkspaceService.getWorkspaceById(workspaceId, req.user!._id as Types.ObjectId);
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    res.json({
      success: true,
      message: 'Workspace retrieved successfully',
      data: workspace
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving workspace',
      error: (error as Error).message
    });
  }
});

// Update workspace
router.put('/:workspaceId', protect, requireWorkspace, requireWorkspacePermission('workspace:update'), async (req: AuthenticatedRequest<IUpdateWorkspaceRequest>, res: Response) => {
  try {
    const { error } = updateWorkspaceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const workspace = await WorkspaceService.updateWorkspace(workspaceId, req.user!._id as Types.ObjectId, req.body);
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    res.json({
      success: true,
      message: 'Workspace updated successfully',
      data: workspace
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating workspace',
      error: (error as Error).message
    });
  }
});

// Delete workspace
router.delete('/:workspaceId', protect, requireWorkspace, requireWorkspaceRole('OWNER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const deleted = await WorkspaceService.deleteWorkspace(workspaceId, req.user!._id as Types.ObjectId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    res.json({
      success: true,
      message: 'Workspace deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting workspace',
      error: (error as Error).message
    });
  }
});

// Get workspace members
router.get('/:workspaceId/members', protect, requireWorkspace, requireWorkspacePermission('workspace:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const members = await WorkspaceService.getWorkspaceMembers(workspaceId);
    
    res.json({
      success: true,
      message: 'Workspace members retrieved successfully',
      data: members
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving workspace members',
      error: (error as Error).message
    });
  }
});

// Invite user to workspace
router.post('/:workspaceId/invite', protect, requireWorkspace, requireWorkspacePermission('workspace:invite'), async (req: AuthenticatedRequest<IWorkspaceInviteRequest>, res: Response) => {
  try {
    const { error } = inviteUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const member = await WorkspaceService.inviteUser(workspaceId, req.user!._id as Types.ObjectId, req.body);
    
    res.status(201).json({
      success: true,
      message: 'User invited successfully',
      data: member
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error inviting user',
      error: (error as Error).message
    });
  }
});

// Update member role
router.put('/:workspaceId/members/:userId/role', protect, requireWorkspace, requireWorkspacePermission('workspace:invite'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error } = updateRoleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const targetUserId = new Types.ObjectId(req.params.userId);
    
    const member = await WorkspaceService.updateMemberRole(
      workspaceId,
      req.user!._id as Types.ObjectId,
      targetUserId,
      req.body.role
    );
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.json({
      success: true,
      message: 'Member role updated successfully',
      data: member
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating member role',
      error: (error as Error).message
    });
  }
});

// Remove member from workspace
router.delete('/:workspaceId/members/:userId', protect, requireWorkspace, requireWorkspacePermission('workspace:remove_users'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const targetUserId = new Types.ObjectId(req.params.userId);
    
    const removed = await WorkspaceService.removeMember(workspaceId, req.user!._id as Types.ObjectId, targetUserId);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Member not found or cannot be removed'
      });
    }

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error removing member',
      error: (error as Error).message
    });
  }
});

// Transfer ownership
router.post('/:workspaceId/transfer-ownership', protect, requireWorkspace, requireWorkspaceRole('OWNER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newOwnerId } = req.body;
    
    if (!newOwnerId) {
      return res.status(400).json({
        success: false,
        message: 'New owner ID is required'
      });
    }

    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const newOwnerObjectId = new Types.ObjectId(newOwnerId);
    
    const transferred = await WorkspaceService.transferOwnership(
      workspaceId,
      req.user!._id as Types.ObjectId,
      newOwnerObjectId
    );
    
    if (!transferred) {
      return res.status(400).json({
        success: false,
        message: 'Could not transfer ownership'
      });
    }

    res.json({
      success: true,
      message: 'Ownership transferred successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error transferring ownership',
      error: (error as Error).message
    });
  }
});

// Leave workspace
router.post('/:workspaceId/leave', protect, requireWorkspace, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const left = await WorkspaceService.leaveWorkspace(workspaceId, req.user!._id as Types.ObjectId);
    
    if (!left) {
      return res.status(400).json({
        success: false,
        message: 'Could not leave workspace'
      });
    }

    res.json({
      success: true,
      message: 'Left workspace successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error leaving workspace',
      error: (error as Error).message
    });
  }
});

// Note: Subscription management routes moved to /modules/subscriptions/routes/subscription.ts




// Note: Usage statistics routes moved to /modules/subscriptions/routes/usage.ts

export default router;