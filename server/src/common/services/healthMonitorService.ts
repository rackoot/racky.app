import { rabbitMQMonitoringService, jobMetricsService } from './rabbitMQMonitoringService';
import QueueHealth from '@/common/models/QueueHealth';
import Job from '@/common/models/Job';
import JobHistory from '@/common/models/JobHistory';

export interface HealthAlert {
  type: 'info' | 'warning' | 'error';
  service: 'queue' | 'jobs' | 'system';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  threshold?: number;
  currentValue?: number;
  queue?: string;
  jobType?: string;
  action?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    rabbitmq: {
      status: 'healthy' | 'unhealthy';
      version: string;
      uptime: number;
      memory: number;
      diskFree: number;
      connections: number;
    };
    database: {
      status: 'healthy' | 'unhealthy';
      connections: number;
      responseTime?: number;
    };
    queues: Record<string, {
      messages: number;
      consumers: number;
      messageRate: number;
      consumeRate: number;
      status: 'running' | 'stopped';
    }>;
  };
  performance: {
    stats: any[];
    alerts: HealthAlert[];
  };
}

/**
 * Health Monitor Service
 * Provides automated health monitoring and alerting for the queue system
 */
class HealthMonitorService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly monitoringInterval = 5 * 60 * 1000; // 5 minutes
  private readonly alertThresholds = {
    HIGH_QUEUE_BACKLOG: 1000,
    HIGH_FAILURE_RATE: 0.10, // 10%
    ZERO_CONSUMERS: 0,
    HIGH_PROCESSING_TIME: 60000, // 1 minute
    LOW_THROUGHPUT: 10 // jobs per hour
  };

  /**
   * Start the health monitoring service
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️  Health monitor already running');
      return;
    }

    this.intervalId = setInterval(async () => {
      await this.performHealthCheck();
    }, this.monitoringInterval);

    this.isRunning = true;
    console.log('✅ Health monitor started (checking every 5 minutes)');
    
    // Perform initial health check
    this.performHealthCheck();
  }

  /**
   * Stop the health monitoring service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    console.log('🛑 Health monitor stopped');
  }

  /**
   * Perform a comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      console.log('🔍 Performing health check...');
      
      const [
        rabbitMQHealth,
        allQueueStats,
        jobPerformanceStats,
        databaseHealth
      ] = await Promise.all([
        rabbitMQMonitoringService.getOverallHealth(),
        rabbitMQMonitoringService.getAllQueuesStats(),
        jobMetricsService.getPerformanceStats('1h'),
        this.checkDatabaseHealth()
      ]);

      // Save queue health snapshots
      await this.saveQueueHealthSnapshots(allQueueStats);

      // Generate health alerts
      const alerts = await this.generateHealthAlerts(allQueueStats, jobPerformanceStats);

      // Log alerts
      for (const alert of alerts) {
        this.logAlert(alert);
      }

      // Check if emergency rollback is needed
      await this.checkEmergencyRollbackConditions(alerts, rabbitMQHealth);

      console.log(`✅ Health check completed. Found ${alerts.length} alerts.`);

    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  /**
   * Save queue health snapshots to MongoDB
   */
  private async saveQueueHealthSnapshots(queueStats: any[]): Promise<void> {
    const queueNames = ['sync.marketplace', 'products.batch', 'ai.scan', 'ai.batch'];
    
    for (const queueName of queueNames) {
      try {
        const stats = queueStats.find(q => q.name === queueName) || {
          name: queueName,
          messages: 0,
          consumers: 0,
          messageRate: 0,
          consumeRate: 0,
          isRunning: false
        };

        // Get additional metrics from MongoDB
        const [completed, failed] = await Promise.all([
          Job.countDocuments({ 
            queueName, 
            status: 'completed',
            completedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
          }),
          Job.countDocuments({ 
            queueName, 
            status: 'failed',
            completedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
          })
        ]);

        // Calculate average processing time
        const avgProcessingTime = await this.calculateAvgProcessingTime(queueName);
        const avgWaitTime = await this.calculateAvgWaitTime(queueName);

        // Determine health status
        const issues = [];
        
        if (stats.messages > this.alertThresholds.HIGH_QUEUE_BACKLOG) {
          issues.push(`High backlog: ${stats.messages} messages`);
        }
        
        if (stats.consumers === 0 && stats.messages > 0) {
          issues.push('No active consumers');
        }
        
        if (!stats.isRunning) {
          issues.push('Queue not running');
        }

        const isHealthy = issues.length === 0;

        await QueueHealth.create({
          queueName,
          timestamp: new Date(),
          stats: {
            waiting: stats.messages,
            processing: stats.consumers,
            completed,
            failed
          },
          averageProcessingTime: avgProcessingTime,
          averageWaitTime: avgWaitTime,
          throughput: stats.consumeRate * 60, // Convert to per minute
          isHealthy,
          issues: issues.length > 0 ? issues : undefined,
          memoryUsage: stats.memory,
          consumers: stats.consumers,
          messageRate: stats.messageRate
        });

      } catch (error) {
        console.error(`❌ Failed to save health snapshot for ${queueName}:`, error);
      }
    }
  }

  /**
   * Generate health alerts based on current metrics
   */
  private async generateHealthAlerts(queueStats: any[], jobStats: any[]): Promise<HealthAlert[]> {
    const alerts: HealthAlert[] = [];
    const now = new Date();

    // Check queue-specific alerts
    for (const queue of queueStats) {
      // High message backlog
      if (queue.messages > this.alertThresholds.HIGH_QUEUE_BACKLOG) {
        alerts.push({
          type: 'warning',
          service: 'queue',
          queue: queue.name,
          message: `High message backlog in ${queue.name}`,
          timestamp: now,
          threshold: this.alertThresholds.HIGH_QUEUE_BACKLOG,
          currentValue: queue.messages,
          metadata: { 
            consumers: queue.consumers,
            messageRate: queue.messageRate,
            consumeRate: queue.consumeRate
          }
        });
      }

      // No consumers for active queue
      if (queue.consumers === 0 && queue.messages > 0) {
        alerts.push({
          type: 'error',
          service: 'queue',
          queue: queue.name,
          message: `No consumers available for ${queue.name} with ${queue.messages} pending messages`,
          timestamp: now,
          action: 'restart_workers',
          metadata: {
            pendingMessages: queue.messages
          }
        });
      }

      // Queue not running
      if (!queue.isRunning) {
        alerts.push({
          type: 'error',
          service: 'queue',
          queue: queue.name,
          message: `Queue ${queue.name} is not running`,
          timestamp: now,
          action: 'restart_queue'
        });
      }

      // Low throughput
      if (queue.consumeRate < this.alertThresholds.LOW_THROUGHPUT / 60 && queue.messages > 0) {
        alerts.push({
          type: 'warning',
          service: 'queue',
          queue: queue.name,
          message: `Low throughput in ${queue.name}`,
          timestamp: now,
          threshold: this.alertThresholds.LOW_THROUGHPUT,
          currentValue: queue.consumeRate * 60,
          metadata: {
            consumeRatePerHour: queue.consumeRate * 3600
          }
        });
      }
    }

    // Check job performance alerts
    for (const jobStat of jobStats) {
      const failureRate = jobStat.totalJobs > 0 ? jobStat.failedJobs / jobStat.totalJobs : 0;
      
      if (failureRate > this.alertThresholds.HIGH_FAILURE_RATE) {
        alerts.push({
          type: 'warning',
          service: 'jobs',
          jobType: jobStat._id,
          message: `High failure rate for ${jobStat._id}`,
          timestamp: now,
          threshold: this.alertThresholds.HIGH_FAILURE_RATE * 100,
          currentValue: Math.round(failureRate * 100),
          metadata: {
            totalJobs: jobStat.totalJobs,
            failedJobs: jobStat.failedJobs,
            successRate: jobStat.successRate
          }
        });
      }

      // High processing time
      if (jobStat.avgProcessingTime && jobStat.avgProcessingTime > this.alertThresholds.HIGH_PROCESSING_TIME) {
        alerts.push({
          type: 'warning',
          service: 'jobs',
          jobType: jobStat._id,
          message: `High average processing time for ${jobStat._id}`,
          timestamp: now,
          threshold: this.alertThresholds.HIGH_PROCESSING_TIME,
          currentValue: jobStat.avgProcessingTime,
          metadata: {
            maxProcessingTime: jobStat.maxProcessingTime,
            minProcessingTime: jobStat.minProcessingTime
          }
        });
      }
    }

    return alerts;
  }

  /**
   * Check for emergency rollback conditions
   */
  private async checkEmergencyRollbackConditions(alerts: HealthAlert[], rabbitMQHealth: any): Promise<void> {
    const criticalAlerts = alerts.filter(alert => alert.type === 'error');
    const systemFailures = alerts.filter(alert => 
      alert.message.includes('No consumers available') || 
      alert.message.includes('not running')
    );

    // Count recent failures
    const recentFailures = await this.countRecentFailures();
    
    const shouldTriggerRollback = (
      !rabbitMQHealth.isHealthy ||
      criticalAlerts.length >= 3 ||
      systemFailures.length >= 2 ||
      recentFailures > 50 // More than 50 failed jobs in last hour
    );

    if (shouldTriggerRollback) {
      console.error('🚨 EMERGENCY ROLLBACK CONDITIONS DETECTED:', {
        rabbitMQHealthy: rabbitMQHealth.isHealthy,
        criticalAlerts: criticalAlerts.length,
        systemFailures: systemFailures.length,
        recentFailures
      });

      // This would trigger the emergency rollback process
      // For now, just log the condition
      alerts.push({
        type: 'error',
        service: 'system',
        message: 'Emergency rollback conditions detected',
        timestamp: new Date(),
        metadata: {
          rabbitMQHealthy: rabbitMQHealth.isHealthy,
          criticalAlerts: criticalAlerts.length,
          systemFailures: systemFailures.length,
          recentFailures
        },
        action: 'emergency_rollback'
      });
    }
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const [
        rabbitMQHealth,
        allQueueStats,
        jobPerformanceStats,
        databaseHealth
      ] = await Promise.all([
        rabbitMQMonitoringService.getOverallHealth(),
        rabbitMQMonitoringService.getAllQueuesStats(),
        jobMetricsService.getPerformanceStats('24h'),
        this.checkDatabaseHealth()
      ]);

      // Generate current alerts
      const alerts = await this.generateHealthAlerts(allQueueStats, jobPerformanceStats);

      // Map queue stats
      const queues: Record<string, any> = {};
      for (const queue of allQueueStats) {
        queues[queue.name] = {
          messages: queue.messages,
          consumers: queue.consumers,
          messageRate: queue.messageRate,
          consumeRate: queue.consumeRate,
          status: queue.isRunning ? 'running' : 'stopped'
        };
      }

      // Determine overall health
      let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (!rabbitMQHealth.isHealthy || databaseHealth.status !== 'healthy') {
        overallHealth = 'unhealthy';
      } else if (alerts.some(alert => alert.type === 'error')) {
        overallHealth = 'unhealthy';
      } else if (alerts.some(alert => alert.type === 'warning')) {
        overallHealth = 'degraded';
      }

      return {
        overall: overallHealth,
        timestamp: new Date().toISOString(),
        services: {
          rabbitmq: {
            status: rabbitMQHealth.isHealthy ? 'healthy' : 'unhealthy',
            version: rabbitMQHealth.version,
            uptime: rabbitMQHealth.uptime,
            memory: rabbitMQHealth.memoryUsed,
            diskFree: rabbitMQHealth.diskFree,
            connections: rabbitMQHealth.totalConnections
          },
          database: databaseHealth,
          queues
        },
        performance: {
          stats: jobPerformanceStats,
          alerts
        }
      };
    } catch (error) {
      console.error('❌ Failed to get system health:', error);
      
      return {
        overall: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          rabbitmq: {
            status: 'unhealthy',
            version: 'unknown',
            uptime: 0,
            memory: 0,
            diskFree: 0,
            connections: 0
          },
          database: {
            status: 'unhealthy',
            connections: 0
          },
          queues: {}
        },
        performance: {
          stats: [],
          alerts: [{
            type: 'error',
            service: 'system',
            message: 'Failed to retrieve system health',
            timestamp: new Date()
          }]
        }
      };
    }
  }

  /**
   * Calculate average processing time for a queue
   */
  private async calculateAvgProcessingTime(queueName: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    try {
      const result = await Job.aggregate([
        {
          $match: {
            queueName,
            completedAt: { $gte: oneHourAgo },
            processingTime: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: '$processingTime' }
          }
        }
      ]);
      
      return result[0]?.avgTime || 0;
    } catch (error) {
      console.error(`❌ Failed to calculate avg processing time for ${queueName}:`, error);
      return 0;
    }
  }

  /**
   * Calculate average wait time for a queue
   */
  private async calculateAvgWaitTime(queueName: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    try {
      const result = await Job.aggregate([
        {
          $match: {
            queueName,
            startedAt: { $gte: oneHourAgo },
            queueWaitTime: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: null,
            avgWaitTime: { $avg: '$queueWaitTime' }
          }
        }
      ]);
      
      return result[0]?.avgWaitTime || 0;
    } catch (error) {
      console.error(`❌ Failed to calculate avg wait time for ${queueName}:`, error);
      return 0;
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<{ status: 'healthy' | 'unhealthy'; connections: number; responseTime?: number }> {
    try {
      const startTime = Date.now();
      
      // Simple database ping
      await Job.findOne().limit(1);
      
      const responseTime = Date.now() - startTime;
      
      // Get connection count (if available)
      const connections = 1; // Simplified for now
      
      return {
        status: responseTime < 1000 ? 'healthy' : 'unhealthy',
        connections,
        responseTime
      };
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return {
        status: 'unhealthy',
        connections: 0
      };
    }
  }

  /**
   * Count recent job failures
   */
  private async countRecentFailures(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    try {
      return await Job.countDocuments({
        status: 'failed',
        completedAt: { $gte: oneHourAgo }
      });
    } catch (error) {
      console.error('❌ Failed to count recent failures:', error);
      return 0;
    }
  }

  /**
   * Log health alert
   */
  private logAlert(alert: HealthAlert): void {
    const alertSymbol = alert.type === 'error' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${alertSymbol} HEALTH ALERT [${alert.type.toUpperCase()}]: ${alert.message}`, {
      service: alert.service,
      queue: alert.queue,
      jobType: alert.jobType,
      threshold: alert.threshold,
      currentValue: alert.currentValue,
      metadata: alert.metadata
    });
  }
}

// Export singleton instance
export const healthMonitorService = new HealthMonitorService();
export default healthMonitorService;