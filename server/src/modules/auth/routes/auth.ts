import express, { Response } from 'express';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '@/common/types/express';
import User from '../models/User';
import Usage from '@/subscriptions/models/Usage';
import { generateToken, protect } from '@/common/middleware/auth';
import getEnv from '@/common/config/env';
import { WorkspaceService } from '../../workspaces/services/workspaceService';
import { Types } from 'mongoose';

const router = express.Router();

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  // Subscription plans are now managed at workspace level
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const updateProfileSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required()
});

const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

interface RegisterRequestBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  // subscriptionPlan removed - handled at workspace level
}

interface LoginRequestBody {
  email: string;
  password: string;
}

interface UpdateProfileRequestBody {
  firstName: string;
  lastName: string;
  email: string;
}

interface UpdatePasswordRequestBody {
  currentPassword: string;
  newPassword: string;
}

router.post('/register', async (req: express.Request<{}, {}, RegisterRequestBody>, res: Response) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { email, password, firstName, lastName } = req.body;

            
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ 
        success: false,
        message: 'User already exists' 
      });
    }

    // Create user - subscriptions are handled at workspace level
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: 'USER' // New users are regular users by default
    });

    // Create default workspace for the new user
    let defaultWorkspace;
    try {
      const workspaceName = `${firstName}'s Workspace`;
      defaultWorkspace = await WorkspaceService.createWorkspace(
        user._id as Types.ObjectId,
        {
          name: workspaceName,
          description: 'Default workspace for managing your e-commerce operations',
          settings: {
            timezone: 'UTC',
            currency: 'USD',
            language: 'en'
          }
        }
      );
      console.log(`✅ Created default workspace "${workspaceName}" for user ${email}`);
    } catch (workspaceError) {
      console.error('Error creating default workspace:', workspaceError);
      // Don't fail registration if workspace creation fails, but log the error
    }

    // Create initial usage record for the user
    try {
      await Usage.getCurrentMonthUsage(user._id.toString());
    } catch (usageError) {
      console.error('Error creating initial usage record:', usageError);
      // Don't fail registration if usage creation fails
    }

    const token = generateToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        token,
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        defaultWorkspace: defaultWorkspace ? {
          _id: defaultWorkspace._id,
          name: defaultWorkspace.name,
          slug: defaultWorkspace.slug
        } : null
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during registration', 
      error: error.message 
    });
  }
});

router.post('/login', async (req: express.Request<{}, {}, LoginRequestBody>, res: Response) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { email, password } = req.body;

        
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'Account is deactivated' 
      });
    }

    const token = generateToken(user._id.toString());

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// GET /api/auth/me - Get current user profile (with token validation)
router.get('/me', async (req: express.Request, res: Response) => {
  try {
    let token: string | undefined;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    try {
      const decoded = jwt.verify(token, getEnv().JWT_SECRET) as any;
            const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      res.json({
        success: true,
        data: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          // subscriptionInfo removed - handled at workspace level
        }
      });
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error: any) {
    console.error('Error in /me endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// PUT /api/auth/profile - Update user profile
router.put('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await protect(req, res, async () => {
      const { error } = updateProfileSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details[0].message
        });
      }

      const { firstName, lastName, email } = req.body;
      
            
      // Check if email is already taken by another user
      if (email !== req.user!.email) {
        const existingUser = await User.findOne({ email, _id: { $ne: req.user!._id } });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Email is already taken by another user'
          });
        }
      }

      // Update user profile
      const updatedUser = await User.findByIdAndUpdate(
        req.user!._id,
        { firstName, lastName, email },
        { new: true, select: '-password' }
      );

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          _id: updatedUser!._id,
          email: updatedUser!.email,
          firstName: updatedUser!.firstName,
          lastName: updatedUser!.lastName,
          role: updatedUser!.role,
          // subscriptionInfo removed - handled at workspace level
        }
      });
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile',
      error: error.message
    });
  }
});

// PUT /api/auth/password - Update user password
router.put('/password', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await protect(req, res, async () => {
      const { error } = updatePasswordSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details[0].message
        });
      }

      const { currentPassword, newPassword } = req.body;
      
            
      // Get user with password for verification
      const user = await User.findById(req.user!._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await user.matchPassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password (will be hashed by pre-save middleware)
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    });
  } catch (error: any) {
    console.error('Error updating password:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating password',
      error: error.message
    });
  }
});

export default router;
