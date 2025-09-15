import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface ITask extends Document {
  taskTypeId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  date: Date;
  quantity: number;
  duration?: number;
  description?: string;
  status: TaskStatus;
  userId?: Types.ObjectId;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaskModel extends Model<ITask> {
  findByWorkspace(workspaceId: Types.ObjectId, limit?: number): Promise<ITask[]>;
  findByDateRange(workspaceId: Types.ObjectId, startDate: Date, endDate: Date): Promise<ITask[]>;
  findCompletedByDateRange(workspaceId: Types.ObjectId, startDate: Date, endDate: Date): Promise<ITask[]>;
  getTotalUnitsConsumed(workspaceId: Types.ObjectId, startDate: Date, endDate: Date): Promise<number>;
  getTaskTypeUsage(workspaceId: Types.ObjectId, startDate: Date, endDate: Date): Promise<any[]>;
}

const taskSchema = new Schema<ITask>({
  taskTypeId: {
    type: Schema.Types.ObjectId,
    ref: 'TaskType',
    required: true,
    index: true
  },
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  duration: {
    type: Number,
    min: 0
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Static method to find tasks by workspace
taskSchema.statics.findByWorkspace = function(
  workspaceId: Types.ObjectId, 
  limit: number = 50
): Promise<ITask[]> {
  return this.find({ workspaceId })
    .populate('taskTypeId', 'name description unitCost unitType')
    .populate('userId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to find tasks by date range
taskSchema.statics.findByDateRange = function(
  workspaceId: Types.ObjectId, 
  startDate: Date, 
  endDate: Date
): Promise<ITask[]> {
  return this.find({
    workspaceId,
    date: { $gte: startDate, $lte: endDate }
  })
  .populate('taskTypeId', 'name description unitCost unitType')
  .populate('userId', 'firstName lastName email')
  .sort({ date: -1 });
};

// Static method to find completed tasks by date range
taskSchema.statics.findCompletedByDateRange = function(
  workspaceId: Types.ObjectId, 
  startDate: Date, 
  endDate: Date
): Promise<ITask[]> {
  return this.find({
    workspaceId,
    status: 'completed',
    date: { $gte: startDate, $lte: endDate }
  })
  .populate('taskTypeId', 'name description unitCost unitType')
  .populate('userId', 'firstName lastName email')
  .sort({ date: -1 });
};

// Static method to get total units consumed in date range
taskSchema.statics.getTotalUnitsConsumed = async function(
  workspaceId: Types.ObjectId, 
  startDate: Date, 
  endDate: Date
): Promise<number> {
  const pipeline = [
    {
      $match: {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        status: 'completed',
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'tasktypes',
        localField: 'taskTypeId',
        foreignField: '_id',
        as: 'taskType'
      }
    },
    {
      $unwind: '$taskType'
    },
    {
      $project: {
        totalUnits: { $multiply: ['$quantity', '$taskType.unitCost'] }
      }
    },
    {
      $group: {
        _id: null,
        totalUnitsConsumed: { $sum: '$totalUnits' }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  return result.length > 0 ? result[0].totalUnitsConsumed : 0;
};

// Static method to get task type usage breakdown
taskSchema.statics.getTaskTypeUsage = async function(
  workspaceId: Types.ObjectId, 
  startDate: Date, 
  endDate: Date
): Promise<any[]> {
  return await this.aggregate([
    {
      $match: {
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        status: 'completed',
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'tasktypes',
        localField: 'taskTypeId',
        foreignField: '_id',
        as: 'taskType'
      }
    },
    {
      $unwind: '$taskType'
    },
    {
      $group: {
        _id: '$taskTypeId',
        taskTypeName: { $first: '$taskType.name' },
        unitCost: { $first: '$taskType.unitCost' },
        unitType: { $first: '$taskType.unitType' },
        totalTasks: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalUnits: { $sum: { $multiply: ['$quantity', '$taskType.unitCost'] } }
      }
    },
    {
      $sort: { totalUnits: -1 }
    }
  ]);
};

// Indexes for performance optimization
taskSchema.index({ workspaceId: 1, date: -1 });
taskSchema.index({ workspaceId: 1, status: 1 });
taskSchema.index({ workspaceId: 1, status: 1, date: -1 });
taskSchema.index({ taskTypeId: 1 });
taskSchema.index({ userId: 1 });

// Compound index for efficient date range queries
taskSchema.index({ workspaceId: 1, date: 1, status: 1 });

const Task: ITaskModel = mongoose.model<ITask, ITaskModel>('Task', taskSchema);

export default Task;