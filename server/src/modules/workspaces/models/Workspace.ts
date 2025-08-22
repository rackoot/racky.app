import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { IWorkspaceSettings } from '../interfaces/workspace';

export interface IWorkspace extends Document {
  name: string;
  description?: string;
  slug: string;
  ownerId: Types.ObjectId;
  settings: IWorkspaceSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  generateSlug(): string;
  isOwner(userId: Types.ObjectId): boolean;
  getMemberCount(): Promise<number>;
  getActiveSubscription(): Promise<any>;
}

// Interface for Workspace model with static methods
export interface IWorkspaceModel extends Model<IWorkspace> {
  findBySlug(slug: string): Promise<IWorkspace | null>;
  findUserWorkspaces(userId: Types.ObjectId): Promise<IWorkspace[]>;
  createWorkspace(ownerId: Types.ObjectId, workspaceData: any): Promise<IWorkspace>;
  generateUniqueSlug(baseName: string): Promise<string>;
}

const workspaceSchema = new Schema<IWorkspace>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/,
    maxlength: 50
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  settings: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    currency: {
      type: String,
      default: 'USD'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Instance Methods
workspaceSchema.methods.generateSlug = function(this: IWorkspace): string {
  return this.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 50);
};

workspaceSchema.methods.isOwner = function(this: IWorkspace, userId: Types.ObjectId): boolean {
  return this.ownerId.toString() === userId.toString();
};

workspaceSchema.methods.getMemberCount = async function(this: IWorkspace): Promise<number> {
  // Dynamic import to avoid circular dependency
  const { default: WorkspaceUser } = await import('./WorkspaceUser');
  return await WorkspaceUser.countDocuments({
    workspaceId: this._id,
    isActive: true
  });
};

workspaceSchema.methods.getActiveSubscription = async function(this: IWorkspace) {
  // Dynamic import to avoid circular dependency
  const { default: Subscription } = await import('../../subscriptions/models/Subscription');
  return await Subscription.findOne({
    workspaceId: this._id,
    status: 'ACTIVE',
    endsAt: { $gt: new Date() }
  }).populate('planId');
};

// Static Methods
workspaceSchema.statics.findBySlug = function(this: IWorkspaceModel, slug: string): Promise<IWorkspace | null> {
  return this.findOne({ slug, isActive: true }).populate('ownerId', 'email firstName lastName');
};

workspaceSchema.statics.findUserWorkspaces = async function(this: IWorkspaceModel, userId: Types.ObjectId): Promise<IWorkspace[]> {
  // Dynamic import to avoid circular dependency
  const { default: WorkspaceUser } = await import('./WorkspaceUser');
  
  const workspaceUsers = await WorkspaceUser.find({
    userId,
    isActive: true
  }).populate('workspaceId');
  
  return workspaceUsers
    .filter(wu => wu.workspaceId && (wu.workspaceId as any).isActive)
    .map(wu => wu.workspaceId as any as IWorkspace);
};

workspaceSchema.statics.createWorkspace = async function(
  this: IWorkspaceModel,
  ownerId: Types.ObjectId,
  workspaceData: any
): Promise<IWorkspace> {
  const { name, description, settings } = workspaceData;
  
  // Generate unique slug
  const slug = await this.generateUniqueSlug(name);
  
  // Create workspace
  const workspace = await this.create({
    name,
    description,
    slug,
    ownerId,
    settings: {
      timezone: settings?.timezone || 'UTC',
      currency: settings?.currency || 'USD',
      language: settings?.language || 'en'
    }
  });

  // Create workspace user relationship for owner
  const { default: WorkspaceUser } = await import('./WorkspaceUser');
  await WorkspaceUser.create({
    workspaceId: workspace._id,
    userId: ownerId,
    role: 'OWNER',
    joinedAt: new Date(),
    isActive: true
  });

  return workspace;
};

workspaceSchema.statics.generateUniqueSlug = async function(
  this: IWorkspaceModel,
  baseName: string
): Promise<string> {
  let baseSlug = baseName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 45); // Leave room for suffix

  let slug = baseSlug;
  let counter = 1;

  while (await this.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

// Indexes
workspaceSchema.index({ slug: 1 }, { unique: true });
workspaceSchema.index({ ownerId: 1 });
workspaceSchema.index({ isActive: 1 });
workspaceSchema.index({ createdAt: 1 });

// Compound indexes
workspaceSchema.index({ ownerId: 1, isActive: 1 });

export default mongoose.model<IWorkspace, IWorkspaceModel>('Workspace', workspaceSchema);