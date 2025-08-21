import { Request } from 'express';
import { IUser } from '../../modules/auth/models/User';

export interface AuthenticatedRequest<T = any> extends Request {
  user?: IUser;
  body: T;
  apiUsage?: {
    current: number;
    limit: number;
    remaining: number;
  };
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