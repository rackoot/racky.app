import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IQueueHealth extends Document {
  _id: Types.ObjectId;
  queueName: string;
  timestamp: Date;
  
  // Queue statistics
  stats: {
    waiting: number;
    processing: number; 
    completed: number;
    failed: number;
    delayed?: number;
  };
  
  // Performance metrics
  averageProcessingTime: number;
  averageWaitTime: number;
  throughput: number;      // Jobs per minute
  
  // Health indicators
  isHealthy: boolean;
  issues?: string[];       // Health warnings/errors
  
  // Resource usage
  memoryUsage?: number;    // Bytes
  consumers?: number;      // Active consumers
  messageRate?: number;    // Messages per second
}

const QueueHealthSchema = new Schema<IQueueHealth>({
  queueName: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  stats: {
    waiting: { type: Number, default: 0 },
    processing: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    delayed: { type: Number, default: 0 }
  },
  averageProcessingTime: {
    type: Number,
    default: 0
  },
  averageWaitTime: {
    type: Number,
    default: 0
  },
  throughput: {
    type: Number,
    default: 0
  },
  isHealthy: {
    type: Boolean,
    default: true
  },
  issues: [{
    type: String
  }],
  memoryUsage: {
    type: Number
  },
  consumers: {
    type: Number
  },
  messageRate: {
    type: Number
  }
}, {
  timestamps: false // We use our own timestamp field
});

// Indexes for performance
QueueHealthSchema.index({ queueName: 1, timestamp: -1 });
QueueHealthSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 }); // 7 days TTL
QueueHealthSchema.index({ isHealthy: 1, timestamp: -1 });

// Static methods
QueueHealthSchema.statics.getLatestHealth = function(queueName: string) {
  return this.findOne({ queueName }).sort({ timestamp: -1 });
};

QueueHealthSchema.statics.getAllQueuesHealth = function() {
  return this.aggregate([
    {
      $sort: { timestamp: -1 }
    },
    {
      $group: {
        _id: '$queueName',
        latestHealth: { $first: '$$ROOT' }
      }
    },
    {
      $replaceRoot: { newRoot: '$latestHealth' }
    }
  ]);
};

QueueHealthSchema.statics.getHealthTrend = function(
  queueName: string,
  hours: number = 24
) {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.find({
    queueName,
    timestamp: { $gte: startTime }
  }).sort({ timestamp: 1 });
};

QueueHealthSchema.statics.getPerformanceTrend = function(
  queueName: string,
  hours: number = 24
) {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        queueName,
        timestamp: { $gte: startTime }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d %H:00',
            date: '$timestamp'
          }
        },
        avgProcessingTime: { $avg: '$averageProcessingTime' },
        avgWaitTime: { $avg: '$averageWaitTime' },
        avgThroughput: { $avg: '$throughput' },
        healthyCount: {
          $sum: { $cond: ['$isHealthy', 1, 0] }
        },
        totalCount: { $sum: 1 }
      }
    },
    {
      $addFields: {
        healthPercentage: {
          $multiply: [
            { $divide: ['$healthyCount', '$totalCount'] },
            100
          ]
        }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
};

QueueHealthSchema.statics.getUnhealthyQueues = function() {
  return this.aggregate([
    {
      $sort: { timestamp: -1 }
    },
    {
      $group: {
        _id: '$queueName',
        latestHealth: { $first: '$$ROOT' }
      }
    },
    {
      $match: {
        'latestHealth.isHealthy': false
      }
    },
    {
      $replaceRoot: { newRoot: '$latestHealth' }
    }
  ]);
};

QueueHealthSchema.statics.recordHealthSnapshot = function(
  queueName: string,
  stats: any,
  metrics: Partial<IQueueHealth> = {}
) {
  // Determine health status
  const issues = [];
  
  if (stats.failed > stats.completed * 0.1) {
    issues.push('High failure rate');
  }
  
  if (stats.waiting > 1000) {
    issues.push('High message backlog');
  }
  
  if (metrics.consumers === 0 && stats.waiting > 0) {
    issues.push('No active consumers');
  }
  
  const isHealthy = issues.length === 0;
  
  return this.create({
    queueName,
    timestamp: new Date(),
    stats,
    isHealthy,
    issues: issues.length > 0 ? issues : undefined,
    ...metrics
  });
};

const QueueHealth = mongoose.model<IQueueHealth>('QueueHealth', QueueHealthSchema);

export default QueueHealth;