import { Types } from "mongoose";
import Task, { ITask, TaskStatus } from "../models/Task";
import TaskType, { ITaskType } from "../models/TaskType";
import {
  ICreateTaskRequest,
  IUpdateTaskRequest,
  ITaskWithDetails,
  IWorkspaceUsageCalculation,
  ITaskExecutionCheck,
  ITaskAnalytics,
  ITaskTypeUsageBreakdown,
  ITaskQueryParams,
  IPaginatedTaskResponse,
  TaskErrorCode,
  ITaskError,
  TaskTypeSlug,
} from "../interfaces/task";

export class TaskService {
  /**
   * Create a new task
   */
  static async createTask(
    workspaceId: string,
    taskData: ICreateTaskRequest
  ): Promise<ITaskWithDetails> {
    // Validate TaskType exists and is active
    const taskType = await TaskType.findBySlug(taskData.taskTypeSlug);
    if (!taskType) {
      throw new Error(`Task type not found: ${taskData.taskTypeSlug}`);
    }
    if (!taskType.isActive) {
      throw new Error(`Task type is inactive: ${taskType.name}`);
    }

    // Create task
    const task = new Task({
      taskTypeSlug: taskData.taskTypeSlug,
      workspaceId: new Types.ObjectId(workspaceId),
      date: taskData.date || new Date(),
      duration: taskData.duration,
      description: taskData.description,
      status: taskData.status || "pending",
      userId: taskData.userId ? new Types.ObjectId(taskData.userId) : undefined,
      metadata: taskData.metadata || {},
    });

    await task.save();

    // Return task with populated details
    const populatedTask = await Task.findById(task._id)
      .populate("userId", "firstName lastName email");

    return this.transformTaskToWithDetails(populatedTask, taskType);
  }

  /**
   * Calculate total units consumed by workspace in date range
   */
  static async calculateWorkspaceTotalUnits(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<IWorkspaceUsageCalculation> {
    const workspaceObjectId = new Types.ObjectId(workspaceId);

    // Get total units consumed
    const totalUnitsConsumed = await Task.getTotalUnitsConsumed(
      workspaceObjectId,
      startDate,
      endDate
    );

    // Get breakdown by task type
    const taskTypeBreakdown = await Task.getTaskTypeUsage(
      workspaceObjectId,
      startDate,
      endDate
    );

    return {
      workspaceId,
      startDate,
      endDate,
      totalUnitsConsumed,
      taskTypeBreakdown: taskTypeBreakdown.map((item) => ({
        slug: item._id as TaskTypeSlug,
        taskTypeName: item.taskTypeName,
        unitCost: item.unitCost,
        unitType: item.unitType,
        totalTasks: item.totalTasks,
        totalUnits: item.totalUnits,
      })),
    };
  }

  /**
   * Check if a task can be executed based on subscription limits
   */
  static async canExecuteTask(
    workspaceId: string,
    taskTypeSlug: TaskTypeSlug,
    subscriptionLimit: number
  ): Promise<ITaskExecutionCheck> {
    // Get task type
    const taskType = await TaskType.findBySlug(taskTypeSlug);
    if (!taskType) {
      return {
        canExecute: false,
        unitsUsed: 0,
        unitsRequired: 0,
        unitsRemaining: 0,
        subscriptionLimit,
        message: "Task type not found",
      };
    }

    if (!taskType.isActive) {
      return {
        canExecute: false,
        unitsUsed: 0,
        unitsRequired: 0,
        unitsRemaining: 0,
        subscriptionLimit,
        message: "Task type is inactive",
      };
    }

    // Calculate current period (current month by default)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    // Get units consumed in current period
    const unitsUsed = await Task.getTotalUnitsConsumed(
      new Types.ObjectId(workspaceId),
      startOfMonth,
      endOfMonth
    );

    // Calculate units required for new task (always 1 since tasks are unitary)
    const unitsRequired = taskType.unitCost;

    // Check if execution would exceed limit
    const totalAfterExecution = unitsUsed + unitsRequired;
    const canExecute = totalAfterExecution <= subscriptionLimit;
    const unitsRemaining = Math.max(0, subscriptionLimit - unitsUsed);

    return {
      canExecute,
      unitsUsed,
      unitsRequired,
      unitsRemaining,
      subscriptionLimit,
      message: canExecute
        ? "Task can be executed"
        : `Insufficient units. Required: ${unitsRequired}, Available: ${unitsRemaining}`,
    };
  }

  /**
   * Update an existing task
   */
  static async updateTask(
    taskId: string,
    workspaceId: string,
    updateData: IUpdateTaskRequest
  ): Promise<ITaskWithDetails | null> {
    const task = await Task.findOne({
      _id: taskId,
      workspaceId: new Types.ObjectId(workspaceId),
    });

    if (!task) {
      return null;
    }

    let taskType: ITaskType | null = null;
    
    // If taskTypeSlug is being updated, validate it
    if (updateData.taskTypeSlug) {
      taskType = await TaskType.findBySlug(updateData.taskTypeSlug);
      if (!taskType || !taskType.isActive) {
        throw new Error("Invalid or inactive task type");
      }
    } else {
      // Get current task type for transform
      taskType = await TaskType.findBySlug(task.taskTypeSlug);
    }

    // Update task fields
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof IUpdateTaskRequest] !== undefined) {
        (task as any)[key] = updateData[key as keyof IUpdateTaskRequest];
      }
    });

    await task.save();

    // Return updated task with populated details
    const populatedTask = await Task.findById(task._id)
      .populate("userId", "firstName lastName email");

    return this.transformTaskToWithDetails(populatedTask, taskType!);
  }

  /**
   * Get task by ID (workspace-scoped)
   */
  static async getTaskById(
    taskId: string,
    workspaceId: string
  ): Promise<ITaskWithDetails | null> {
    const task = await Task.findOne({
      _id: taskId,
      workspaceId: new Types.ObjectId(workspaceId),
    })
      .populate("userId", "firstName lastName email");

    if (!task) return null;

    const taskType = await TaskType.findBySlug(task.taskTypeSlug);
    if (!taskType) {
      throw new Error(`Task type not found: ${task.taskTypeSlug}`);
    }

    return this.transformTaskToWithDetails(task, taskType);
  }

  /**
   * Get paginated tasks for workspace
   */
  static async getWorkspaceTasks(
    workspaceId: string,
    params: ITaskQueryParams = {}
  ): Promise<IPaginatedTaskResponse> {
    const {
      page = 1,
      limit = 20,
      status,
      taskTypeSlug,
      userId,
      startDate,
      endDate,
      search,
    } = params;

    // Build query
    const query: any = { workspaceId: new Types.ObjectId(workspaceId) };

    if (status) query.status = status;
    if (taskTypeSlug) query.taskTypeSlug = taskTypeSlug;
    if (userId) query.userId = new Types.ObjectId(userId);

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    if (search) {
      query.description = { $regex: search, $options: "i" };
    }

    // Execute paginated query
    const skip = (page - 1) * limit;
    const [tasks, totalItems] = await Promise.all([
      Task.find(query)
        .populate("userId", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Task.countDocuments(query),
    ]);

    // Get unique task type slugs to fetch task types
    const uniqueTaskTypeSlugs = [...new Set(tasks.map(task => task.taskTypeSlug))];
    const taskTypes = await TaskType.find({ 
      slug: { $in: uniqueTaskTypeSlugs },
      isActive: true 
    });
    
    // Create a map for quick lookup
    const taskTypeMap = new Map(taskTypes.map(tt => [tt.slug, tt]));

    // Transform tasks
    const transformedTasks = tasks.map((task) => {
      const taskType = taskTypeMap.get(task.taskTypeSlug);
      if (!taskType) {
        throw new Error(`Task type not found: ${task.taskTypeSlug}`);
      }
      return this.transformTaskToWithDetails(task, taskType);
    });

    // Calculate pagination
    const totalPages = Math.ceil(totalItems / limit);

    return {
      tasks: transformedTasks,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Delete a task (workspace-scoped)
   */
  static async deleteTask(
    taskId: string,
    workspaceId: string
  ): Promise<boolean> {
    const result = await Task.deleteOne({
      _id: taskId,
      workspaceId: new Types.ObjectId(workspaceId),
    });

    return result.deletedCount > 0;
  }

  /**
   * Get task analytics for workspace
   */
  static async getTaskAnalytics(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ITaskAnalytics> {
    const workspaceObjectId = new Types.ObjectId(workspaceId);

    const [
      totalTasks,
      completedTasks,
      pendingTasks,
      totalUnitsConsumed,
      tasksByStatus,
      tasksByType,
    ] = await Promise.all([
      // Total tasks
      Task.countDocuments({
        workspaceId: workspaceObjectId,
        date: { $gte: startDate, $lte: endDate },
      }),

      // Completed tasks
      Task.countDocuments({
        workspaceId: workspaceObjectId,
        status: "completed",
        date: { $gte: startDate, $lte: endDate },
      }),

      // Pending tasks
      Task.countDocuments({
        workspaceId: workspaceObjectId,
        status: "pending",
        date: { $gte: startDate, $lte: endDate },
      }),

      // Total units consumed
      Task.getTotalUnitsConsumed(workspaceObjectId, startDate, endDate),

      // Tasks by status
      Task.aggregate([
        {
          $match: {
            workspaceId: workspaceObjectId,
            date: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      // Tasks by type with units
      Task.getTaskTypeUsage(workspaceObjectId, startDate, endDate),
    ]);

    // Generate usage by day
    const usageByDay = await this.getUsageByDay(
      workspaceId,
      startDate,
      endDate
    );

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      totalUnitsConsumed,
      tasksByStatus: tasksByStatus.map((item) => ({
        status: item._id as TaskStatus,
        count: item.count,
      })),
      tasksByType: tasksByType.map((item) => ({
        taskTypeSlug: item._id as TaskTypeSlug,
        taskTypeName: item.taskTypeName,
        count: item.totalTasks,
        totalUnits: item.totalUnits,
      })),
      usageByDay,
    };
  }

  /**
   * Get usage breakdown by day
   */
  static async getUsageByDay(
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: string; taskCount: number; unitsConsumed: number }[]> {
    const result = await Task.aggregate([
      {
        $match: {
          workspaceId: new Types.ObjectId(workspaceId),
          status: "completed",
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $lookup: {
          from: "tasktypes",
          localField: "taskTypeId",
          foreignField: "_id",
          as: "taskType",
        },
      },
      {
        $unwind: "$taskType",
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            day: { $dayOfMonth: "$date" },
          },
          taskCount: { $sum: 1 },
          unitsConsumed: {
            $sum: "$taskType.unitCost",
          },
        },
      },
      {
        $project: {
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: {
                $dateFromParts: {
                  year: "$_id.year",
                  month: "$_id.month",
                  day: "$_id.day",
                },
              },
            },
          },
          taskCount: 1,
          unitsConsumed: 1,
        },
      },
      {
        $sort: { date: 1 },
      },
    ]);

    return result;
  }

  /**
   * Transform Task model to TaskWithDetails interface
   */
  private static transformTaskToWithDetails(task: any, taskType: ITaskType): ITaskWithDetails {
    const user = task.userId;
    const totalUnits = taskType.unitCost;

    return {
      _id: task._id.toString(),
      workspaceId: task.workspaceId.toString(),
      date: task.date,
      duration: task.duration,
      description: task.description,
      status: task.status,
      metadata: task.metadata,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      taskType: {
        _id: taskType._id.toString(),
        name: taskType.name,
        slug: taskType.slug,
        description: taskType.description,
        unitCost: taskType.unitCost,
        unitType: taskType.unitType,
      },
      user: user
        ? {
            _id: user._id.toString(),
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          }
        : undefined,
      totalUnits,
    };
  }

  // TaskType management methods
  static async createTaskType(data: any): Promise<ITaskType> {
    const taskType = new TaskType(data);
    await taskType.save();
    return taskType;
  }

  static async getAllTaskTypes(): Promise<ITaskType[]> {
    return TaskType.findActive();
  }

  static async getTaskTypeById(id: string): Promise<ITaskType | null> {
    return TaskType.findById(id);
  }

  static async updateTaskType(
    id: string,
    data: any
  ): Promise<ITaskType | null> {
    return TaskType.findByIdAndUpdate(id, data, { new: true });
  }

  static async deleteTaskType(id: string): Promise<boolean> {
    const result = await TaskType.findByIdAndUpdate(id, { isActive: false });
    return result !== null;
  }

  static async getTaskTypeBySlug(slug: TaskTypeSlug): Promise<ITaskType | null> {
    return TaskType.findBySlug(slug);
  }
}
