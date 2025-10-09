import { apiGet, apiPost, apiPut, apiDelete } from '../client'
import { ENDPOINTS } from '../config'
import type { Workspace, CreateWorkspaceRequest } from '../types/workspace'

export const workspacesApi = {
  /**
   * Get all workspaces for the current user
   */
  async getWorkspaces(): Promise<Workspace[]> {
    return apiGet<Workspace[]>(ENDPOINTS.WORKSPACES.LIST)
  },

  /**
   * Create a new workspace
   */
  async createWorkspace(data: CreateWorkspaceRequest): Promise<Workspace> {
    return apiPost<Workspace>(ENDPOINTS.WORKSPACES.CREATE, data)
  },

  /**
   * Get workspace by ID
   */
  async getWorkspace(id: string): Promise<Workspace> {
    return apiGet<Workspace>(ENDPOINTS.WORKSPACES.GET(id))
  },

  /**
   * Update workspace
   */
  async updateWorkspace(id: string, data: Partial<CreateWorkspaceRequest>): Promise<Workspace> {
    return apiPut<Workspace>(ENDPOINTS.WORKSPACES.UPDATE(id), data)
  },

  /**
   * Delete workspace
   */
  async deleteWorkspace(id: string): Promise<void> {
    return apiDelete<void>(ENDPOINTS.WORKSPACES.DELETE(id))
  },

  // Note: Subscription and usage methods moved to dedicated API modules:
  // - subscriptionApi: for subscription management
  // - workspaceUsageApi: for usage statistics
}