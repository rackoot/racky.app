import { Types } from 'mongoose';

// Workspace role types
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

// Workspace settings interface
export interface IWorkspaceSettings {
  timezone: string;
  currency: string;
  language: string;
}

// Workspace creation request interface
export interface ICreateWorkspaceRequest {
  name: string;
  description?: string;
  slug?: string;
  settings?: Partial<IWorkspaceSettings>;
}

// Workspace update request interface
export interface IUpdateWorkspaceRequest {
  name?: string;
  description?: string;
  settings?: Partial<IWorkspaceSettings>;
  isActive?: boolean;
}

// Workspace invitation request interface
export interface IWorkspaceInviteRequest {
  email: string;
  role: WorkspaceRole;
  message?: string;
}

// Workspace user response interface
export interface IWorkspaceUserResponse {
  _id: string;
  user: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  role: WorkspaceRole;
  joinedAt: Date;
  isActive: boolean;
}

// Workspace detailed response interface
export interface IWorkspaceResponse {
  _id: string;
  name: string;
  description?: string;
  slug: string;
  owner: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  settings: IWorkspaceSettings;
  isActive: boolean;
  userRole?: WorkspaceRole;
  memberCount?: number;
  subscription?: {
    status: string;
    plan: string;
    endsAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Role permissions mapping
export const WORKSPACE_PERMISSIONS = {
  OWNER: [
    'workspace:read',
    'workspace:update', 
    'workspace:delete',
    'workspace:invite',
    'workspace:remove_users',
    'workspace:manage_billing',
    'workspace:manage_subscription',
    'workspace:transfer_ownership',
    'stores:create',
    'stores:read',
    'stores:update', 
    'stores:delete',
    'products:create',
    'products:read',
    'products:update',
    'products:delete',
    'opportunities:read',
    'opportunities:update',
    'suggestions:read',
    'suggestions:update'
  ],
  ADMIN: [
    'workspace:read',
    'workspace:update',
    'workspace:invite',
    'stores:create',
    'stores:read', 
    'stores:update',
    'stores:delete',
    'products:create',
    'products:read',
    'products:update',
    'products:delete',
    'opportunities:read',
    'opportunities:update',
    'suggestions:read',
    'suggestions:update'
  ],
  OPERATOR: [
    'workspace:read',
    'stores:read',
    'stores:update',
    'products:create',
    'products:read',
    'products:update', 
    'products:delete',
    'opportunities:read',
    'opportunities:update',
    'suggestions:read',
    'suggestions:update'
  ],
  VIEWER: [
    'workspace:read',
    'stores:read',
    'products:read',
    'opportunities:read',
    'suggestions:read'
  ]
} as const;

// Helper function to check permissions
export const hasWorkspacePermission = (role: WorkspaceRole, permission: string): boolean => {
  return WORKSPACE_PERMISSIONS[role].includes(permission as any);
};