import { apiGet, apiPost, apiPut, apiDelete } from './client'
import { ENDPOINTS } from './config'
import { Workspace, CreateWorkspaceRequest, UsageData } from './types'

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

  /**
   * Get workspace subscription info
   */
  async getWorkspaceSubscription(id: string): Promise<any> {
    return apiGet<any>(ENDPOINTS.WORKSPACES.SUBSCRIPTION(id))
  },

  /**
   * Update workspace subscription
   */
  async updateWorkspaceSubscription(id: string, data: any): Promise<any> {
    return apiPut<any>(ENDPOINTS.WORKSPACES.SUBSCRIPTION(id), data)
  },

  /**
   * Get workspace usage data
   */
  async getWorkspaceUsage(id: string): Promise<UsageData> {
    return apiGet<UsageData>(ENDPOINTS.WORKSPACES.USAGE(id))
  },
}