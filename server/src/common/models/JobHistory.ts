import mongoose, { Schema, Document, Types, Model } from 'mongoose';

export interface IJobHistory extends Document {
  _id: Types.ObjectId;
  jobId: string;           // Reference to Job
  workspaceId: string;     // Multi-tenant isolation
  
  // Event tracking
  event: 'created' | 'started' | 'progress' | 'completed' | 'failed' | 'retry' | 'cancelled' | 'batch_initiated';
  timestamp: Date;
  
  // Event details
  progress?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
  
  // Performance tracking
  processingTime?: number; // Milliseconds
  queueWaitTime?: number;  // Time spent waiting in queue
  
  // Additional context
  attempt?: number;        // Which attempt this event is for
  previousStatus?: string; // Previous job status
  newStatus?: string;      // New job status after event
}

// Interface for static methods
export interface IJobHistoryModel extends Model<IJobHistory> {
  createEvent(
    jobId: string,
    workspaceId: string,
    event: string,
    details?: Partial<IJobHistory>
  ): Promise<IJobHistory>;
  
  getJobTimeline(jobId: string): Promise<IJobHistory[]>;
  
  getRecentEvents(
    workspaceId: string,
    limit?: number,
    eventTypes?: string[]
  ): Promise<IJobHistory[]>;
  
  getPerformanceMetrics(
    workspaceId: string,
    timeframe?: Date
  ): Promise<any[]>;
  
  getErrorAnalysis(
    workspaceId: string,
    timeframe?: Date
  ): Promise<any[]>;
}

const JobHistorySchema = new Schema<IJobHistory>({
  jobId: {
    type: String,
    required: true,
    index: true
  },
  workspaceId: {
    type: String,
    required: true,
    index: true
  },
  event: {
    type: String,
    required: true,
    enum: ['created', 'started', 'progress', 'completed', 'failed', 'retry', 'cancelled', 'batch_initiated']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  progress: {
    type: Number,
    min: 0,
    max: 100
  },
  errorMessage: {
    type: String
  },
  metadata: {
    type: Schema.Types.Mixed
  },
  processingTime: {
    type: Number
  },
  queueWaitTime: {
    type: Number
  },
  attempt: {
    type: Number
  },
  previousStatus: {
    type: String
  },
  newStatus: {
    type: String
  }
}, {
  timestamps: false // We use our own timestamp field
});

// Indexes for performance
JobHistorySchema.index({ jobId: 1, timestamp: -1 });
JobHistorySchema.index({ workspaceId: 1, timestamp: -1 });
JobHistorySchema.index({ event: 1, timestamp: -1 });
JobHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 }); // 7 days TTL

// Static methods
JobHistorySchema.statics.createEvent = function(
  jobId: string,
  workspaceId: string,
  event: string,
  details: Partial<IJobHistory> = {}
) {
  return this.create({
    jobId,
    workspaceId,
    event,
    timestamp: new Date(),
    ...details
  });
};

JobHistorySchema.statics.getJobTimeline = function(jobId: string) {
  return this.find({ jobId }).sort({ timestamp: 1 });
};

JobHistorySchema.statics.getRecentEvents = function(
  workspaceId: string,
  limit: number = 100,
  eventTypes?: string[]
) {
  const filter: any = { workspaceId };
  if (eventTypes && eventTypes.length > 0) {
    filter.event = { $in: eventTypes };
  }
  
  return this.find(filter)
    .sort({ timestamp: -1 })
    .limit(limit);
};

JobHistorySchema.statics.getPerformanceMetrics = function(
  workspaceId: string,
  timeframe: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)
) {
  return this.aggregate([
    {
      $match: {
        workspaceId,
        timestamp: { $gte: timeframe },
        event: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalJobs: { $sum: 1 },
        avgProcessingTime: { $avg: '$processingTime' },
        avgWaitTime: { $avg: '$queueWaitTime' },
        maxProcessingTime: { $max: '$processingTime' },
        minProcessingTime: { $min: '$processingTime' }
      }
    }
  ]);
};

JobHistorySchema.statics.getErrorAnalysis = function(
  workspaceId: string,
  timeframe: Date = new Date(Date.now() - 24 * 60 * 60 * 1000)
) {
  return this.aggregate([
    {
      $match: {
        workspaceId,
        timestamp: { $gte: timeframe },
        event: 'failed',
        errorMessage: { $exists: true }
      }
    },
    {
      $group: {
        _id: '$errorMessage',
        count: { $sum: 1 },
        lastOccurrence: { $max: '$timestamp' },
        jobs: { $push: '$jobId' }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 10
    }
  ]);
};

const JobHistory = mongoose.model<IJobHistory, IJobHistoryModel>('JobHistory', JobHistorySchema);

export default JobHistory;