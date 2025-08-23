import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import User from '../../modules/auth/models/User';
import Workspace from '../../modules/workspaces/models/Workspace';
import WorkspaceUser from '../../modules/workspaces/models/WorkspaceUser';

// Test JWT secret (matches .env.test)
const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

export interface TestUser {
  _id: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'SUPERADMIN';
  token: string;
}

export interface TestWorkspace {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  ownerId: Types.ObjectId;
}

export const createTestUser = async (userData: Partial<{
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: 'USER' | 'SUPERADMIN';
}> = {}): Promise<TestUser> => {
  const defaultData = {
    email: `test${Date.now()}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    password: 'password123',
    role: 'USER' as const,
    ...userData,
  };

  const user = await User.create(defaultData);
  const token = generateTestToken(user._id.toString());

  return {
    _id: user._id as Types.ObjectId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    token,
  };
};

export const createTestSuperAdmin = async (): Promise<TestUser> => {
  return createTestUser({
    email: `admin${Date.now()}@example.com`,
    role: 'SUPERADMIN',
  });
};

export const createTestWorkspace = async (
  ownerId: Types.ObjectId,
  workspaceData: Partial<{
    name: string;
    description: string;
  }> = {}
): Promise<TestWorkspace> => {
  const defaultData = {
    name: `Test Workspace ${Date.now()}`,
    description: 'Test workspace for testing purposes',
    ...workspaceData,
  };

  const workspace = await Workspace.createWorkspace(ownerId, defaultData);

  return {
    _id: workspace._id as Types.ObjectId,
    name: workspace.name,
    slug: workspace.slug,
    ownerId: workspace.ownerId as Types.ObjectId,
  };
};

export const createTestUserWithWorkspace = async (userData: Parameters<typeof createTestUser>[0] = {}): Promise<{
  user: TestUser;
  workspace: TestWorkspace;
  workspaceToken: string;
}> => {
  const user = await createTestUser(userData);
  const workspace = await createTestWorkspace(user._id);
  const workspaceToken = generateTestToken(user._id.toString(), workspace._id.toString());

  return {
    user,
    workspace,
    workspaceToken,
  };
};

export const generateTestToken = (userId: string, workspaceId?: string, role?: string): string => {
  const payload: any = { id: userId };
  
  if (workspaceId) {
    payload.workspaceId = workspaceId;
  }
  
  if (role) {
    payload.role = role;
  }

  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });
};

export const addUserToWorkspace = async (
  userId: Types.ObjectId,
  workspaceId: Types.ObjectId,
  role: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER' = 'OPERATOR'
): Promise<void> => {
  await WorkspaceUser.create({
    userId,
    workspaceId,
    role,
    joinedAt: new Date(),
    isActive: true,
  });
};

export const getAuthHeaders = (token: string, workspaceId?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (workspaceId) {
    headers['X-Workspace-ID'] = workspaceId;
  }

  return headers;
};