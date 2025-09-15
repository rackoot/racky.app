import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ITaskType extends Document {
  name: string;
  description?: string;
  unitCost: number;
  unitType?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaskTypeModel extends Model<ITaskType> {
  findActive(): Promise<ITaskType[]>;
  findByName(name: string): Promise<ITaskType | null>;
}

const taskTypeSchema = new Schema<ITaskType>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0,
    default: 1
  },
  unitType: {
    type: String,
    trim: true,
    maxlength: 50,
    default: 'unit'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Static method to find active task types
taskTypeSchema.statics.findActive = function(): Promise<ITaskType[]> {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Static method to find task type by name
taskTypeSchema.statics.findByName = function(name: string): Promise<ITaskType | null> {
  return this.findOne({ name: name.trim(), isActive: true });
};

// Indexes for performance
taskTypeSchema.index({ name: 1, isActive: 1 }, { unique: true });
taskTypeSchema.index({ isActive: 1 });

const TaskType: ITaskTypeModel = mongoose.model<ITaskType, ITaskTypeModel>('TaskType', taskTypeSchema);

export default TaskType;