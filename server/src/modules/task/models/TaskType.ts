import mongoose, { Document, Model, Schema } from "mongoose";
import { TaskTypeSlug } from "../interfaces/task";

export interface ITaskType extends Document {
  name: string;
  slug: TaskTypeSlug;
  description?: string;
  unitCost: number;
  unitType?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaskTypeModel extends Model<ITaskType> {
  findActive(): Promise<ITaskType[]>;
  findBySlug(slug: TaskTypeSlug): Promise<ITaskType | null>;
  findByName(name: string): Promise<ITaskType | null>;
}

const taskTypeSchema = new Schema<ITaskType>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      enum: Object.values(TaskTypeSlug),
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
    unitType: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "unit",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Static method to find active task types
taskTypeSchema.statics.findActive = function (): Promise<ITaskType[]> {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Static method to find task type by slug
taskTypeSchema.statics.findBySlug = function (
  slug: TaskTypeSlug
): Promise<ITaskType | null> {
  return this.findOne({ slug, isActive: true });
};

// Static method to find task type by name
taskTypeSchema.statics.findByName = function (
  name: string
): Promise<ITaskType | null> {
  return this.findOne({ name: name.trim(), isActive: true });
};

const TaskType: ITaskTypeModel = mongoose.model<ITaskType, ITaskTypeModel>(
  "TaskType",
  taskTypeSchema
);

export default TaskType;
