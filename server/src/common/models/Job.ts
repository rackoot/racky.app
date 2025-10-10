import mongoose, { Schema, Document, Types } from 'mongoose';
import { JobType, JobPriority } from '../types/jobTypes';

export interface IJob extends Document {
  _id: Types.ObjectId;
  jobId: string;           // UUID for job tracking
  jobType: JobType;        // Existing enum from Bull.js
  queueName: string;       // RabbitMQ queue name
  routingKey: string;      // RabbitMQ routing key
  
  // Multi-tenant fields
  userId: string;
  workspaceId: string;
  
  // Job data and status
  data: Record<string, any>; // Job-specific data
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;        // 0-100
  
  // Timing
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Error handling
  attempts: number;        // Current attempt count
  maxAttempts: number;     // Max retry attempts
  lastError?: string;      // Latest error message
  
  // Hierarchy
  parentJobId?: string;    // For batch job relationships
  childJobIds: string[];   // Child job references
  
  // Results
  result?: Record<string, any>; // Job completion result
  
  // Priority and metadata
  priority: JobPriority;
  metadata?: Record<string, any>;
  
  // Processing metrics
  processingTime?: number; // Milliseconds
  queueWaitTime?: number;  // Time spent waiting in queue
  
  // Instance methods
  markStarted(): Promise<this>;
  markCompleted(result?: any): Promise<this>;
  markFailed(error: string): Promise<this>;
  updateProgress(progress: number, message?: string): Promise<this>;
  incrementAttempts(): Promise<this>;
}

const JobSchema = new Schema<IJob>({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  jobType: {
    type: String,
    required: true,
    enum: Object.values(JobType)
  },
  queueName: {
    type: String,
    required: true,
    index: true
  },
  routingKey: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  workspaceId: {
    type: String,
    required: true,
    index: true
  },
  data: {
    type: Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'queued',
    index: true
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  lastError: {
    type: String
  },
  parentJobId: {
    type: String
  },
  childJobIds: [{
    type: String
  }],
  result: {
    type: Schema.Types.Mixed
  },
  priority: {
    type: Number,
    required: true,
    enum: Object.values(JobPriority).filter(v => typeof v === 'number')
  },
  metadata: {
    type: Schema.Types.Mixed
  },
  processingTime: {
    type: Number
  },
  queueWaitTime: {
    type: Number
  }
}, {
  timestamps: true
});

// Indexes for performance
JobSchema.index({ workspaceId: 1, status: 1 });
JobSchema.index({ workspaceId: 1, createdAt: -1 });
JobSchema.index({ jobType: 1, status: 1 });
JobSchema.index({ parentJobId: 1 });
JobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

// Instance methods
JobSchema.methods.markStarted = function() {
  this.status = 'processing';
  this.startedAt = new Date();
  this.queueWaitTime = this.startedAt.getTime() - this.createdAt.getTime();
  return this.save();
};

JobSchema.methods.markCompleted = function(result?: any) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.progress = 100;
  if (result) {
    this.result = result;
  }
  if (this.startedAt) {
    this.processingTime = this.completedAt.getTime() - this.startedAt.getTime();
  }
  return this.save();
};

JobSchema.methods.markFailed = function(error: string) {
  this.status = 'failed';
  this.completedAt = new Date();
  this.lastError = error;
  if (this.startedAt) {
    this.processingTime = this.completedAt.getTime() - this.startedAt.getTime();
  }
  return this.save();
};

JobSchema.methods.updateProgress = function(progress: number) {
  this.progress = Math.min(100, Math.max(0, progress));
  return this.save();
};

JobSchema.methods.incrementAttempts = function() {
  this.attempts += 1;
  return this.save();
};

// Static methods
JobSchema.statics.findByWorkspace = function(workspaceId: string, status?: string) {
  const filter: any = { workspaceId };
  if (status) {
    filter.status = status;
  }
  return this.find(filter).sort({ createdAt: -1 });
};

JobSchema.statics.findActiveJobs = function(workspaceId?: string) {
  const filter: any = {
    status: { $in: ['queued', 'processing'] }
  };
  if (workspaceId) {
    filter.workspaceId = workspaceId;
  }
  return this.find(filter);
};

JobSchema.statics.getJobStats = function(timeframe: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)) {
  return this.aggregate([
    { $match: { createdAt: { $gte: timeframe } } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$processingTime' },
        avgWaitTime: { $avg: '$queueWaitTime' }
      }
    }
  ]);
};

const Job = mongoose.model<IJob>('Job', JobSchema);

export default Job;