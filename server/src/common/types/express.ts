import { Request } from 'express';
import { Types } from 'mongoose';
import { IUser } from '../../modules/auth/models/User';
import { IWorkspace } from '../../modules/workspaces/models/Workspace';
import { IWorkspaceUser } from '../../modules/workspaces/models/WorkspaceUser';
import { WorkspaceRole } from '../../modules/workspaces/interfaces/workspace';

export interface AuthenticatedRequest<T = any> extends Request {
  user?: IUser;
  workspace?: IWorkspace;
  workspaceUser?: IWorkspaceUser;
  workspaceRole?: WorkspaceRole;
  body: T;
  apiUsage?: {
    current: number;
    limit: number;
    remaining: number;
  };
}

// JWT Payload interface
export interface JWTPayload {
  id: string; // userId
  workspaceId?: string;
  role?: WorkspaceRole;
  iat?: number;
  exp?: number;
}

export interface ApiUsageInfo {
  current: number;
  limit: number;
  remaining: number;
}

export interface SyncLimits {
  minInterval: number;
  hoursRemaining: number;
}