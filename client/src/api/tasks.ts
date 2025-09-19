import { apiGet, apiPost, apiPut, apiDelete } from './client'
import { ENDPOINTS } from './config'

// Import types from backend to ensure consistency
export type {
  TaskStatus,
  TaskTypeSlug,
  ITaskType as TaskType,
  ICreateTaskTypeRequest as CreateTaskTypeRequest,
  IUpdateTaskTypeRequest as UpdateTaskTypeRequest,
  ITask as Task,
  ITaskWithDetails as TaskWithDetails,
  ICreateTaskRequest as CreateTaskRequest,
  IUpdateTaskRequest as UpdateTaskRequest,
  ITaskQueryParams as TaskQueryParams,
  IPaginatedTaskResponse as PaginatedTaskResponse,
  ITaskTypeUsageBreakdown as TaskTypeUsageBreakdown,
  IWorkspaceUsageCalculation as WorkspaceUsageCalculation,
  ITaskExecutionCheck as TaskExecutionCheck,
  ITaskAnalytics as TaskAnalytics
} from '../../../server/src/modules/task/interfaces/task'

// Frontend-specific interfaces for date strings (API response format)
export interface TaskFrontend extends Omit<Task, 'date' | 'createdAt' | 'updatedAt'> {
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskWithDetailsFrontend extends Omit<TaskWithDetails, 'date' | 'createdAt' | 'updatedAt'> {
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTypeFrontend extends Omit<TaskType, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedTaskResponseFrontend {
  tasks: TaskWithDetailsFrontend[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Frontend-specific usage calculation interfaces
export interface WorkspaceUsageCalculationFrontend {
  workspaceId: string;
  startDate: string;
  endDate: string;
  totalUnitsConsumed: number;
  taskTypeBreakdown: TaskTypeUsageBreakdown[];
}

export interface UsageCalculationRequest {
  startDate: string;
  endDate: string;
}

export interface ExecutionCheckRequest {
  taskTypeSlug: TaskTypeSlug;
  subscriptionLimit: number;
}

// API Client
export const tasksApi = {
  // Task Management
  /**
   * Get paginated tasks for current workspace
   */
  async getTasks(params: TaskQueryParams = {}): Promise<PaginatedTaskResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const url = queryParams.toString()
      ? `${ENDPOINTS.TASKS.LIST}?${queryParams.toString()}`
      : ENDPOINTS.TASKS.LIST;

    return apiGet<PaginatedTaskResponse>(url);
  },

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<TaskWithDetails> {
    return apiGet<TaskWithDetails>(ENDPOINTS.TASKS.GET(taskId));
  },

  /**
   * Create a new task
   */
  async createTask(data: CreateTaskRequest): Promise<TaskWithDetails> {
    return apiPost<TaskWithDetails>(ENDPOINTS.TASKS.CREATE, data);
  },

  /**
   * Update task by ID
   */
  async updateTask(taskId: string, data: UpdateTaskRequest): Promise<TaskWithDetails> {
    return apiPut<TaskWithDetails>(ENDPOINTS.TASKS.UPDATE(taskId), data);
  },

  /**
   * Delete task by ID
   */
  async deleteTask(taskId: string): Promise<void> {
    return apiDelete<void>(ENDPOINTS.TASKS.DELETE(taskId));
  },

  // Task Types Management
  /**
   * Get all active task types
   */
  async getTaskTypes(): Promise<TaskType[]> {
    return apiGet<TaskType[]>(ENDPOINTS.TASKS.TYPES.LIST);
  },

  /**
   * Get task type by ID
   */
  async getTaskType(taskTypeId: string): Promise<TaskType> {
    return apiGet<TaskType>(ENDPOINTS.TASKS.TYPES.GET(taskTypeId));
  },

  /**
   * Create a new task type
   */
  async createTaskType(data: CreateTaskTypeRequest): Promise<TaskType> {
    return apiPost<TaskType>(ENDPOINTS.TASKS.TYPES.CREATE, data);
  },

  /**
   * Update task type by ID
   */
  async updateTaskType(taskTypeId: string, data: UpdateTaskTypeRequest): Promise<TaskType> {
    return apiPut<TaskType>(ENDPOINTS.TASKS.TYPES.UPDATE(taskTypeId), data);
  },

  /**
   * Delete (deactivate) task type by ID
   */
  async deleteTaskType(taskTypeId: string): Promise<void> {
    return apiDelete<void>(ENDPOINTS.TASKS.TYPES.DELETE(taskTypeId));
  },

  // Usage and Analytics
  /**
   * Calculate workspace total units consumed in date range
   */
  async calculateWorkspaceUsage(data: UsageCalculationRequest): Promise<WorkspaceUsageCalculation> {
    return apiPost<WorkspaceUsageCalculation>(ENDPOINTS.TASKS.USAGE.CALCULATE, data);
  },

  /**
   * Check if a task can be executed based on subscription limits
   */
  async checkTaskExecution(data: ExecutionCheckRequest): Promise<TaskExecutionCheck> {
    return apiPost<TaskExecutionCheck>(ENDPOINTS.TASKS.USAGE.CAN_EXECUTE, data);
  },

  /**
   * Get task analytics for workspace in date range
   */
  async getTaskAnalytics(startDate: string, endDate: string): Promise<TaskAnalytics> {
    const queryParams = new URLSearchParams({
      startDate,
      endDate
    });

    return apiGet<TaskAnalytics>(`${ENDPOINTS.TASKS.ANALYTICS.SUMMARY}?${queryParams.toString()}`);
  },

  // Helper methods for common operations
  /**
   * Get current month usage for workspace
   */
  async getCurrentMonthUsage(): Promise<WorkspaceUsageCalculation> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return this.calculateWorkspaceUsage({
      startDate: startOfMonth.toISOString(),
      endDate: endOfMonth.toISOString()
    });
  },

  /**
   * Get tasks for current month
   */
  async getCurrentMonthTasks(page: number = 1, limit: number = 20): Promise<PaginatedTaskResponse> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return this.getTasks({
      page,
      limit,
      startDate: startOfMonth.toISOString().split('T')[0],
      endDate: endOfMonth.toISOString().split('T')[0]
    });
  },

  /**
   * Get current month analytics
   */
  async getCurrentMonthAnalytics(): Promise<TaskAnalytics> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return this.getTaskAnalytics(
      startOfMonth.toISOString(),
      endOfMonth.toISOString()
    );
  }
};

// Export types for use in other components
export type {
  TaskType,
  Task,
  TaskWithDetails,
  TaskStatus,
  TaskQueryParams,
  PaginatedTaskResponse,
  TaskTypeUsageBreakdown,
  WorkspaceUsageCalculation,
  TaskExecutionCheck,
  TaskAnalytics
};