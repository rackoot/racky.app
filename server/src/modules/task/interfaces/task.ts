import { Types } from 'mongoose';

// Task Status Types
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

// TaskType Slug Enum
export enum TaskTypeSlug {
  PRODUCT_OPTIMIZATION = 'product-optimization'
}

// TaskType Interfaces
export interface ITaskType {
  _id: string;
  name: string;
  slug: TaskTypeSlug;
  description?: string;
  unitCost: number;
  unitType?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateTaskTypeRequest {
  name: string;
  slug: TaskTypeSlug;
  description?: string;
  unitCost: number;
  unitType?: string;
  isActive?: boolean;
}

export interface IUpdateTaskTypeRequest {
  name?: string;
  slug?: TaskTypeSlug;
  description?: string;
  unitCost?: number;
  unitType?: string;
  isActive?: boolean;
}

// Task Interfaces
export interface ITask {
  _id: string;
  taskTypeSlug: TaskTypeSlug;
  workspaceId: string;
  date: Date;
  duration?: number;
  description?: string;
  status: TaskStatus;
  userId?: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaskWithDetails extends Omit<ITask, 'taskTypeSlug' | 'userId'> {
  taskType: {
    _id: string;
    name: string;
    slug: TaskTypeSlug;
    description?: string;
    unitCost: number;
    unitType?: string;
  };
  user?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  totalUnits: number;
}

export interface ICreateTaskRequest {
  taskTypeSlug: TaskTypeSlug;
  date?: Date;
  duration?: number;
  description?: string;
  status?: TaskStatus;
  userId?: string;
  metadata?: any;
}

export interface IUpdateTaskRequest {
  taskTypeSlug?: TaskTypeSlug;
  date?: Date;
  duration?: number;
  description?: string;
  status?: TaskStatus;
  userId?: string;
  metadata?: any;
}

// Query and Filter Interfaces
export interface ITaskQueryParams {
  page?: number;
  limit?: number;
  status?: TaskStatus;
  taskTypeSlug?: TaskTypeSlug;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface ITaskTypeUsageBreakdown {
  slug: TaskTypeSlug;
  taskTypeName: string;
  unitCost: number;
  unitType?: string;
  totalTasks: number;
  totalUnits: number;
}

export interface IWorkspaceUsageCalculation {
  workspaceId: string;
  startDate: Date;
  endDate: Date;
  totalUnitsConsumed: number;
  taskTypeBreakdown: ITaskTypeUsageBreakdown[];
}

export interface ITaskExecutionCheck {
  canExecute: boolean;
  unitsUsed: number;
  unitsRequired: number;
  unitsRemaining: number;
  subscriptionLimit: number;
  message?: string;
}

// Service Response Interfaces
export interface ITaskServiceResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface IPaginatedTaskResponse {
  tasks: ITaskWithDetails[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Dashboard and Analytics Interfaces
export interface ITaskAnalytics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  totalUnitsConsumed: number;
  averageTaskDuration?: number;
  tasksByStatus: {
    status: TaskStatus;
    count: number;
  }[];
  tasksByType: {
    taskTypeSlug: TaskTypeSlug;
    taskTypeName: string;
    count: number;
    totalUnits: number;
  }[];
  usageByDay: {
    date: string;
    taskCount: number;
    unitsConsumed: number;
  }[];
}

export interface ITaskDateRangeQuery {
  workspaceId: string;
  startDate: Date;
  endDate: Date;
}

// Error Types
export enum TaskErrorCode {
  TASK_TYPE_NOT_FOUND = 'TASK_TYPE_NOT_FOUND',
  TASK_TYPE_INACTIVE = 'TASK_TYPE_INACTIVE',
  INSUFFICIENT_UNITS = 'INSUFFICIENT_UNITS',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  INVALID_STATUS_TRANSITION = 'INVALID_STATUS_TRANSITION',
  WORKSPACE_LIMIT_EXCEEDED = 'WORKSPACE_LIMIT_EXCEEDED',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE'
}

export interface ITaskError {
  code: TaskErrorCode;
  message: string;
  details?: any;
}