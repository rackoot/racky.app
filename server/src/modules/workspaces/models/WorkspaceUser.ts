import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { WorkspaceRole } from '../interfaces/workspace';

export interface IWorkspaceUser extends Document {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  role: WorkspaceRole;
  invitedBy?: Types.ObjectId;
  invitedAt?: Date;
  joinedAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  hasPermission(permission: string): boolean;
  canAccess(resource: string, action: string): boolean;
}

// Interface for WorkspaceUser model with static methods
export interface IWorkspaceUserModel extends Model<IWorkspaceUser> {
  findUserWorkspaceRole(userId: Types.ObjectId, workspaceId: Types.ObjectId): Promise<IWorkspaceUser | null>;
  findWorkspaceMembers(workspaceId: Types.ObjectId): Promise<IWorkspaceUser[]>;
  findUserWorkspaces(userId: Types.ObjectId): Promise<IWorkspaceUser[]>;
  createMembership(workspaceId: Types.ObjectId, userId: Types.ObjectId, role: WorkspaceRole, invitedBy?: Types.ObjectId): Promise<IWorkspaceUser>;
  updateMemberRole(workspaceId: Types.ObjectId, userId: Types.ObjectId, role: WorkspaceRole): Promise<IWorkspaceUser | null>;
  removeMember(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<boolean>;
  transferOwnership(workspaceId: Types.ObjectId, fromUserId: Types.ObjectId, toUserId: Types.ObjectId): Promise<boolean>;
}

const workspaceUserSchema = new Schema<IWorkspaceUser>({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['OWNER', 'ADMIN', 'OPERATOR', 'VIEWER'],
    required: true
  },
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  invitedAt: {
    type: Date
  },
  joinedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Instance Methods
workspaceUserSchema.methods.hasPermission = function(this: IWorkspaceUser, permission: string): boolean {
  const { hasWorkspacePermission } = require('../interfaces/workspace');
  return hasWorkspacePermission(this.role, permission);
};

workspaceUserSchema.methods.canAccess = function(this: IWorkspaceUser, resource: string, action: string): boolean {
  const permission = `${resource}:${action}`;
  return this.hasPermission(permission);
};

// Static Methods
workspaceUserSchema.statics.findUserWorkspaceRole = function(
  this: IWorkspaceUserModel,
  userId: Types.ObjectId,
  workspaceId: Types.ObjectId
): Promise<IWorkspaceUser | null> {
  return this.findOne({
    userId,
    workspaceId,
    isActive: true
  }).populate('workspaceId userId', 'name email firstName lastName');
};

workspaceUserSchema.statics.findWorkspaceMembers = function(
  this: IWorkspaceUserModel,
  workspaceId: Types.ObjectId
): Promise<IWorkspaceUser[]> {
  return this.find({
    workspaceId,
    isActive: true
  })
  .populate('userId', 'email firstName lastName')
  .populate('invitedBy', 'email firstName lastName')
  .sort({ role: 1, joinedAt: 1 }); // OWNER first, then by join date
};

workspaceUserSchema.statics.findUserWorkspaces = function(
  this: IWorkspaceUserModel,
  userId: Types.ObjectId
): Promise<IWorkspaceUser[]> {
  return this.find({
    userId,
    isActive: true
  })
  .populate('workspaceId', 'name description slug isActive settings')
  .sort({ joinedAt: -1 }); // Most recent first
};

workspaceUserSchema.statics.createMembership = async function(
  this: IWorkspaceUserModel,
  workspaceId: Types.ObjectId,
  userId: Types.ObjectId,
  role: WorkspaceRole,
  invitedBy?: Types.ObjectId
): Promise<IWorkspaceUser> {
  // Check if membership already exists
  const existingMembership = await this.findOne({
    workspaceId,
    userId
  });

  if (existingMembership) {
    if (existingMembership.isActive) {
      throw new Error('User is already a member of this workspace');
    } else {
      // Reactivate membership
      existingMembership.isActive = true;
      existingMembership.role = role;
      existingMembership.joinedAt = new Date();
      if (invitedBy) {
        existingMembership.invitedBy = invitedBy;
        existingMembership.invitedAt = new Date();
      }
      return await existingMembership.save();
    }
  }

  return await this.create({
    workspaceId,
    userId,
    role,
    invitedBy,
    invitedAt: invitedBy ? new Date() : undefined,
    joinedAt: new Date()
  });
};

workspaceUserSchema.statics.updateMemberRole = async function(
  this: IWorkspaceUserModel,
  workspaceId: Types.ObjectId,
  userId: Types.ObjectId,
  role: WorkspaceRole
): Promise<IWorkspaceUser | null> {
  const membership = await this.findOne({
    workspaceId,
    userId,
    isActive: true
  });

  if (!membership) {
    return null;
  }

  // Cannot change OWNER role unless transferring ownership
  if (membership.role === 'OWNER' && role !== 'OWNER') {
    throw new Error('Cannot change owner role. Use transfer ownership instead.');
  }

  membership.role = role;
  return await membership.save();
};

workspaceUserSchema.statics.removeMember = async function(
  this: IWorkspaceUserModel,
  workspaceId: Types.ObjectId,
  userId: Types.ObjectId
): Promise<boolean> {
  const membership = await this.findOne({
    workspaceId,
    userId,
    isActive: true
  });

  if (!membership) {
    return false;
  }

  // Cannot remove OWNER
  if (membership.role === 'OWNER') {
    throw new Error('Cannot remove workspace owner. Transfer ownership first.');
  }

  membership.isActive = false;
  await membership.save();
  return true;
};

workspaceUserSchema.statics.transferOwnership = async function(
  this: IWorkspaceUserModel,
  workspaceId: Types.ObjectId,
  fromUserId: Types.ObjectId,
  toUserId: Types.ObjectId
): Promise<boolean> {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Find current owner
      const currentOwner = await this.findOne({
        workspaceId,
        userId: fromUserId,
        role: 'OWNER',
        isActive: true
      }).session(session);

      if (!currentOwner) {
        throw new Error('Current user is not the owner of this workspace');
      }

      // Find target user
      const targetMember = await this.findOne({
        workspaceId,
        userId: toUserId,
        isActive: true
      }).session(session);

      if (!targetMember) {
        throw new Error('Target user is not a member of this workspace');
      }

      // Update roles
      currentOwner.role = 'ADMIN';
      targetMember.role = 'OWNER';

      await currentOwner.save({ session });
      await targetMember.save({ session });

      // Update workspace owner
      const { default: Workspace } = await import('./Workspace');
      await Workspace.updateOne(
        { _id: workspaceId },
        { ownerId: toUserId }
      ).session(session);
    });

    return true;
  } catch (error) {
    throw error;
  } finally {
    await session.endSession();
  }
};

// Indexes
workspaceUserSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
workspaceUserSchema.index({ userId: 1 });
workspaceUserSchema.index({ workspaceId: 1 });
workspaceUserSchema.index({ role: 1 });
workspaceUserSchema.index({ isActive: 1 });
workspaceUserSchema.index({ joinedAt: 1 });

// Compound indexes
workspaceUserSchema.index({ workspaceId: 1, isActive: 1 });
workspaceUserSchema.index({ userId: 1, isActive: 1 });
workspaceUserSchema.index({ workspaceId: 1, role: 1 });

export default mongoose.model<IWorkspaceUser, IWorkspaceUserModel>('WorkspaceUser', workspaceUserSchema);