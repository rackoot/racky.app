import { Types } from 'mongoose';
import Workspace from '../models/Workspace';
import WorkspaceUser from '../models/WorkspaceUser';
import User from '../../auth/models/User';
import { 
  ICreateWorkspaceRequest, 
  IUpdateWorkspaceRequest, 
  IWorkspaceInviteRequest, 
  IWorkspaceResponse,
  IWorkspaceUserResponse,
  WorkspaceRole 
} from '../interfaces/workspace';

export class WorkspaceService {
  // Get user's workspaces
  static async getUserWorkspaces(userId: Types.ObjectId): Promise<IWorkspaceResponse[]> {
    const workspaceUsers = await WorkspaceUser.findUserWorkspaces(userId);
    
    const workspaces = await Promise.all(
      workspaceUsers.map(async (wu) => {
        const workspace = wu.workspaceId as any;
        const memberCount = await workspace.getMemberCount();
        const subscription = await workspace.getActiveSubscription();
        
        return {
          _id: workspace._id.toString(),
          name: workspace.name,
          description: workspace.description,
          slug: workspace.slug,
          owner: {
            _id: workspace.ownerId._id?.toString() || workspace.ownerId.toString(),
            email: workspace.ownerId.email || 'Unknown',
            firstName: workspace.ownerId.firstName || 'Unknown',
            lastName: workspace.ownerId.lastName || 'User'
          },
          settings: workspace.settings,
          isActive: workspace.isActive,
          userRole: wu.role,
          memberCount,
          subscription: subscription ? {
            status: subscription.status,
            plan: subscription.planId?.contributorType || 'Unknown',
            endsAt: subscription.endsAt
          } : undefined,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt
        } as IWorkspaceResponse;
      })
    );

    return workspaces;
  }

  // Get workspace by ID
  static async getWorkspaceById(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<IWorkspaceResponse | null> {
    const workspace = await Workspace.findById(workspaceId).populate('ownerId', 'email firstName lastName');
    if (!workspace) return null;

    // Check if user has access
    const workspaceUser = await WorkspaceUser.findUserWorkspaceRole(userId, workspaceId);
    if (!workspaceUser) return null;

    const [memberCount, subscription] = await Promise.all([
      workspace.getMemberCount(),
      workspace.getActiveSubscription()
    ]);

    return {
      _id: workspace._id.toString(),
      name: workspace.name,
      description: workspace.description,
      slug: workspace.slug,
      owner: {
        _id: (workspace.ownerId as any)._id.toString(),
        email: (workspace.ownerId as any).email,
        firstName: (workspace.ownerId as any).firstName,
        lastName: (workspace.ownerId as any).lastName
      },
      settings: workspace.settings,
      isActive: workspace.isActive,
      userRole: workspaceUser.role,
      memberCount,
      subscription: subscription ? {
        status: subscription.status,
        plan: subscription.planId?.contributorType || 'Unknown',
        endsAt: subscription.endsAt
      } : undefined,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt
    };
  }

  // Create workspace
  static async createWorkspace(ownerId: Types.ObjectId, data: ICreateWorkspaceRequest): Promise<IWorkspaceResponse> {
    const workspace = await Workspace.createWorkspace(ownerId, data);
    const owner = await User.findById(ownerId).select('email firstName lastName');
    if (!owner) {
      throw new Error('Owner not found');
    }
    
    return {
      _id: workspace._id.toString(),
      name: workspace.name,
      description: workspace.description,
      slug: workspace.slug,
      owner: {
        _id: owner._id.toString(),
        email: owner.email,
        firstName: owner.firstName,
        lastName: owner.lastName
      },
      settings: workspace.settings,
      isActive: workspace.isActive,
      userRole: 'OWNER',
      memberCount: 1,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt
    };
  }

  // Update workspace
  static async updateWorkspace(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    data: IUpdateWorkspaceRequest
  ): Promise<IWorkspaceResponse | null> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return null;

    // Check if user has permission to update
    const workspaceUser = await WorkspaceUser.findUserWorkspaceRole(userId, workspaceId);
    if (!workspaceUser || !workspaceUser.hasPermission('workspace:update')) {
      throw new Error('Permission denied');
    }

    // Update workspace
    if (data.name) workspace.name = data.name;
    if (data.description !== undefined) workspace.description = data.description;
    if (data.settings) {
      workspace.settings = { ...workspace.settings, ...data.settings };
    }
    if (data.isActive !== undefined) workspace.isActive = data.isActive;

    await workspace.save();

    return this.getWorkspaceById(workspaceId, userId);
  }

  // Delete workspace
  static async deleteWorkspace(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<boolean> {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return false;

    // Only owner can delete workspace
    if (!workspace.isOwner(userId)) {
      throw new Error('Only workspace owner can delete the workspace');
    }

    // Deactivate workspace (soft delete)
    workspace.isActive = false;
    await workspace.save();

    // Deactivate all workspace users
    await WorkspaceUser.updateMany(
      { workspaceId },
      { isActive: false }
    );

    return true;
  }

  // Get workspace members
  static async getWorkspaceMembers(workspaceId: Types.ObjectId): Promise<IWorkspaceUserResponse[]> {
    const members = await WorkspaceUser.findWorkspaceMembers(workspaceId);
    
    return members.map(member => ({
      _id: member._id.toString(),
      user: {
        _id: (member.userId as any)._id.toString(),
        email: (member.userId as any).email,
        firstName: (member.userId as any).firstName,
        lastName: (member.userId as any).lastName
      },
      role: member.role,
      joinedAt: member.joinedAt,
      isActive: member.isActive
    }));
  }

  // Invite user to workspace
  static async inviteUser(
    workspaceId: Types.ObjectId,
    inviterId: Types.ObjectId,
    data: IWorkspaceInviteRequest
  ): Promise<IWorkspaceUserResponse> {
    // Check if inviter has permission
    const inviterWorkspaceUser = await WorkspaceUser.findUserWorkspaceRole(inviterId, workspaceId);
    if (!inviterWorkspaceUser || !inviterWorkspaceUser.hasPermission('workspace:invite')) {
      throw new Error('Permission denied');
    }

    // Find user by email
    const user = await User.findOne({ email: data.email.toLowerCase() });
    if (!user) {
      throw new Error('User not found');
    }

    // Create membership
    const workspaceUser = await WorkspaceUser.createMembership(
      workspaceId,
      user._id as Types.ObjectId,
      data.role,
      inviterId
    );

    return {
      _id: workspaceUser._id.toString(),
      user: {
        _id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      role: workspaceUser.role,
      joinedAt: workspaceUser.joinedAt,
      isActive: workspaceUser.isActive
    };
  }

  // Update member role
  static async updateMemberRole(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    targetUserId: Types.ObjectId,
    newRole: WorkspaceRole
  ): Promise<IWorkspaceUserResponse | null> {
    // Check if user has permission
    const userWorkspaceUser = await WorkspaceUser.findUserWorkspaceRole(userId, workspaceId);
    if (!userWorkspaceUser || !userWorkspaceUser.hasPermission('workspace:invite')) {
      throw new Error('Permission denied');
    }

    // Update role
    const updatedMember = await WorkspaceUser.updateMemberRole(workspaceId, targetUserId, newRole);
    if (!updatedMember) return null;

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return null;
    }

    return {
      _id: updatedMember._id.toString(),
      user: {
        _id: (targetUser._id as Types.ObjectId).toString(),
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName
      },
      role: updatedMember.role,
      joinedAt: updatedMember.joinedAt,
      isActive: updatedMember.isActive
    };
  }

  // Remove member from workspace
  static async removeMember(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    targetUserId: Types.ObjectId
  ): Promise<boolean> {
    // Check if user has permission
    const userWorkspaceUser = await WorkspaceUser.findUserWorkspaceRole(userId, workspaceId);
    if (!userWorkspaceUser || !userWorkspaceUser.hasPermission('workspace:remove_users')) {
      throw new Error('Permission denied');
    }

    return await WorkspaceUser.removeMember(workspaceId, targetUserId);
  }

  // Transfer ownership
  static async transferOwnership(
    workspaceId: Types.ObjectId,
    currentOwnerId: Types.ObjectId,
    newOwnerId: Types.ObjectId
  ): Promise<boolean> {
    // Only current owner can transfer ownership
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace || !workspace.isOwner(currentOwnerId)) {
      throw new Error('Only workspace owner can transfer ownership');
    }

    return await WorkspaceUser.transferOwnership(workspaceId, currentOwnerId, newOwnerId);
  }

  // Leave workspace
  static async leaveWorkspace(workspaceId: Types.ObjectId, userId: Types.ObjectId): Promise<boolean> {
    const workspaceUser = await WorkspaceUser.findUserWorkspaceRole(userId, workspaceId);
    if (!workspaceUser) return false;

    // Owner cannot leave, must transfer ownership first
    if (workspaceUser.role === 'OWNER') {
      throw new Error('Workspace owner cannot leave. Transfer ownership first.');
    }

    return await WorkspaceUser.removeMember(workspaceId, userId);
  }
}