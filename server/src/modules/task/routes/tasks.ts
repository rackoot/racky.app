import express, { Request, Response } from 'express';
import Joi from 'joi';
import { TaskService } from '../services/TaskService';
import { ICreateTaskRequest, IUpdateTaskRequest, TaskStatus } from '../interfaces/task';

const router = express.Router();

// Validation schemas
const createTaskSchema = Joi.object({
  taskTypeId: Joi.string().required(),
  date: Joi.date().optional(),
  quantity: Joi.number().integer().min(1).optional(),
  duration: Joi.number().min(0).optional(),
  description: Joi.string().max(1000).optional(),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'failed', 'cancelled').optional(),
  userId: Joi.string().optional(),
  metadata: Joi.object().optional()
});

const updateTaskSchema = Joi.object({
  taskTypeId: Joi.string().optional(),
  date: Joi.date().optional(),
  quantity: Joi.number().integer().min(1).optional(),
  duration: Joi.number().min(0).optional(),
  description: Joi.string().max(1000).optional(),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'failed', 'cancelled').optional(),
  userId: Joi.string().optional(),
  metadata: Joi.object().optional()
}).min(1);

const createTaskTypeSchema = Joi.object({
  name: Joi.string().required().trim().max(100),
  description: Joi.string().max(500).optional(),
  unitCost: Joi.number().min(0).required(),
  unitType: Joi.string().max(50).optional(),
  isActive: Joi.boolean().optional()
});

const updateTaskTypeSchema = Joi.object({
  name: Joi.string().trim().max(100).optional(),
  description: Joi.string().max(500).optional(),
  unitCost: Joi.number().min(0).optional(),
  unitType: Joi.string().max(50).optional(),
  isActive: Joi.boolean().optional()
}).min(1);

const queryParamsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'failed', 'cancelled').optional(),
  taskTypeId: Joi.string().optional(),
  userId: Joi.string().optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  search: Joi.string().max(100).optional()
});

const usageCalculationSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required()
});

const executionCheckSchema = Joi.object({
  taskTypeId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).optional(),
  subscriptionLimit: Joi.number().min(0).required()
});

// TASK TYPE ROUTES (must be before /:id routes to avoid conflicts)

/**
 * GET /api/tasks/types
 * Get all active task types
 */
router.get('/types', async (req: Request, res: Response) => {
  try {
    const taskTypes = await TaskService.getAllTaskTypes();

    res.json({
      success: true,
      data: taskTypes
    });
  } catch (error: any) {
    console.error('Error fetching task types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task types',
      error: error.message
    });
  }
});

/**
 * POST /api/tasks/types
 * Create a new task type
 */
router.post('/types', async (req: Request, res: Response) => {
  try {
    const { error, value } = createTaskTypeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task type data',
        error: error.details[0].message
      });
    }

    const taskType = await TaskService.createTaskType(value);

    res.status(201).json({
      success: true,
      message: 'Task type created successfully',
      data: taskType
    });
  } catch (error: any) {
    console.error('Error creating task type:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to create task type',
      error: error.message
    });
  }
});

/**
 * GET /api/tasks/types/:id
 * Get task type by ID
 */
router.get('/types/:id', async (req: Request, res: Response) => {
  try {
    const taskType = await TaskService.getTaskTypeById(req.params.id);

    if (!taskType) {
      return res.status(404).json({
        success: false,
        message: 'Task type not found'
      });
    }

    res.json({
      success: true,
      data: taskType
    });
  } catch (error: any) {
    console.error('Error fetching task type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task type',
      error: error.message
    });
  }
});

/**
 * PUT /api/tasks/types/:id
 * Update task type by ID
 */
router.put('/types/:id', async (req: Request, res: Response) => {
  try {
    const { error, value } = updateTaskTypeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid update data',
        error: error.details[0].message
      });
    }

    const taskType = await TaskService.updateTaskType(req.params.id, value);

    if (!taskType) {
      return res.status(404).json({
        success: false,
        message: 'Task type not found'
      });
    }

    res.json({
      success: true,
      message: 'Task type updated successfully',
      data: taskType
    });
  } catch (error: any) {
    console.error('Error updating task type:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to update task type',
      error: error.message
    });
  }
});

/**
 * DELETE /api/tasks/types/:id
 * Delete (deactivate) task type by ID
 */
router.delete('/types/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await TaskService.deleteTaskType(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Task type not found'
      });
    }

    res.json({
      success: true,
      message: 'Task type deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting task type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task type',
      error: error.message
    });
  }
});

// USAGE AND ANALYTICS ROUTES (before /:id routes)

/**
 * POST /api/tasks/usage/calculate
 * Calculate workspace total units consumed in date range
 */
router.post('/usage/calculate', async (req: Request, res: Response) => {
  try {
    const { error, value } = usageCalculationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date range',
        error: error.details[0].message
      });
    }

    const workspaceId = (req as any).workspaceId;
    const result = await TaskService.calculateWorkspaceTotalUnits(
      workspaceId,
      value.startDate,
      value.endDate
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error calculating usage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate usage',
      error: error.message
    });
  }
});

/**
 * POST /api/tasks/usage/can-execute
 * Check if a task can be executed based on subscription limits
 */
router.post('/usage/can-execute', async (req: Request, res: Response) => {
  try {
    const { error, value } = executionCheckSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid execution check data',
        error: error.details[0].message
      });
    }

    const workspaceId = (req as any).workspaceId;
    const result = await TaskService.canExecuteTask(
      workspaceId,
      value.taskTypeId,
      value.subscriptionLimit,
      value.quantity
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error checking execution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check execution',
      error: error.message
    });
  }
});

/**
 * GET /api/tasks/analytics/summary
 * Get task analytics for workspace in date range
 */
router.get('/analytics/summary', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate query parameters are required'
      });
    }

    const workspaceId = (req as any).workspaceId;
    const analytics = await TaskService.getTaskAnalytics(
      workspaceId,
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

// TASK ROUTES (generic routes last to avoid conflicts)

/**
 * GET /api/tasks
 * Get paginated tasks for workspace
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = queryParamsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        error: error.details[0].message
      });
    }

    const workspaceId = (req as any).workspaceId;
    const result = await TaskService.getWorkspaceTasks(workspaceId, value);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
});

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = createTaskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task data',
        error: error.details[0].message
      });
    }

    const workspaceId = (req as any).workspaceId;
    const task = await TaskService.createTask(workspaceId, value as ICreateTaskRequest);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  } catch (error: any) {
    console.error('Error creating task:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to create task',
      error: error.message
    });
  }
});

/**
 * GET /api/tasks/:id
 * Get task by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId;
    const task = await TaskService.getTaskById(req.params.id, workspaceId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error: any) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task',
      error: error.message
    });
  }
});

/**
 * PUT /api/tasks/:id
 * Update task by ID
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { error, value } = updateTaskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid update data',
        error: error.details[0].message
      });
    }

    const workspaceId = (req as any).workspaceId;
    const task = await TaskService.updateTask(req.params.id, workspaceId, value as IUpdateTaskRequest);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: task
    });
  } catch (error: any) {
    console.error('Error updating task:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to update task',
      error: error.message
    });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete task by ID
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req as any).workspaceId;
    const deleted = await TaskService.deleteTask(req.params.id, workspaceId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
      error: error.message
    });
  }
});

export default router;