import axios from 'axios';
import getEnv from '@/common/config/env';
import QueueHealth from '@/common/models/QueueHealth';
import JobHistory from '@/common/models/JobHistory';
import Job from '@/common/models/Job';

export interface RabbitMQQueueStats {
  name: string;
  messages: number;
  consumers: number;
  messageRate: number;
  consumeRate: number;
  memory: number;
  isRunning: boolean;
}

export interface RabbitMQOverallHealth {
  version: string;
  uptime: number;
  totalQueues: number;
  totalConnections: number;
  memoryUsed: number;
  diskFree: number;
  isHealthy: boolean;
}

/**
 * RabbitMQ Monitoring Service
 * Integrates with RabbitMQ Management API for real-time statistics and health monitoring
 */
class RabbitMQMonitoringService {
  private managementApiUrl: string;
  private authHeader: string;

  constructor() {
    const env = getEnv();
    const { RABBITMQ_MGMT_URL = 'http://rabbitmq:15672' } = env;
    const { RABBITMQ_USER = 'racky', RABBITMQ_PASS = 'racky123' } = env;
    
    this.managementApiUrl = `${RABBITMQ_MGMT_URL}/api`;
    this.authHeader = `Basic ${Buffer.from(`${RABBITMQ_USER}:${RABBITMQ_PASS}`).toString('base64')}`;
  }

  /**
   * Get statistics for a specific queue
   */
  async getQueueStats(queueName: string): Promise<RabbitMQQueueStats> {
    try {
      const response = await axios.get(
        `${this.managementApiUrl}/queues/racky/${queueName}`,
        { 
          headers: { Authorization: this.authHeader },
          timeout: 5000
        }
      );

      const data = response.data;

      return {
        name: data.name,
        messages: data.messages || 0,
        consumers: data.consumers || 0,
        messageRate: data.message_stats?.publish_details?.rate || 0,
        consumeRate: data.message_stats?.deliver_details?.rate || 0,
        memory: data.memory || 0,
        isRunning: data.state === 'running'
      };
    } catch (error) {
      console.error(`❌ Failed to get queue stats for ${queueName}:`, error);
      
      // Return default stats if API call fails
      return {
        name: queueName,
        messages: 0,
        consumers: 0,
        messageRate: 0,
        consumeRate: 0,
        memory: 0,
        isRunning: false
      };
    }
  }

  /**
   * Get overall RabbitMQ broker health
   */
  async getOverallHealth(): Promise<RabbitMQOverallHealth> {
    try {
      const [overviewResponse, nodesResponse] = await Promise.all([
        axios.get(`${this.managementApiUrl}/overview`, {
          headers: { Authorization: this.authHeader },
          timeout: 5000
        }),
        axios.get(`${this.managementApiUrl}/nodes`, {
          headers: { Authorization: this.authHeader },
          timeout: 5000
        })
      ]);

      const overview = overviewResponse.data;
      const nodes = nodesResponse.data;
      const firstNode = nodes[0] || {};

      return {
        version: overview.rabbitmq_version || 'unknown',
        uptime: firstNode.uptime || 0,
        totalQueues: overview.object_totals?.queues || 0,
        totalConnections: overview.object_totals?.connections || 0,
        memoryUsed: firstNode.mem_used || 0,
        diskFree: firstNode.disk_free || 0,
        isHealthy: nodes.every((node: any) => node.running)
      };
    } catch (error) {
      console.error('❌ Failed to get RabbitMQ overall health:', error);
      
      // Return default health status
      return {
        version: 'unknown',
        uptime: 0,
        totalQueues: 0,
        totalConnections: 0,
        memoryUsed: 0,
        diskFree: 0,
        isHealthy: false
      };
    }
  }

  /**
   * Get all queues statistics
   */
  async getAllQueuesStats(): Promise<RabbitMQQueueStats[]> {
    try {
      const response = await axios.get(
        `${this.managementApiUrl}/queues/racky`,
        { 
          headers: { Authorization: this.authHeader },
          timeout: 10000
        }
      );

      return response.data.map((queue: any) => ({
        name: queue.name,
        messages: queue.messages || 0,
        consumers: queue.consumers || 0,
        messageRate: queue.message_stats?.publish_details?.rate || 0,
        consumeRate: queue.message_stats?.deliver_details?.rate || 0,
        memory: queue.memory || 0,
        isRunning: queue.state === 'running'
      }));
    } catch (error) {
      console.error('❌ Failed to get all queues stats:', error);
      return [];
    }
  }

  /**
   * Check if RabbitMQ Management API is accessible
   */
  async isManagementApiAccessible(): Promise<boolean> {
    try {
      await axios.get(`${this.managementApiUrl}/overview`, {
        headers: { Authorization: this.authHeader },
        timeout: 3000
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  async getConnectionStats(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.managementApiUrl}/connections`,
        { 
          headers: { Authorization: this.authHeader },
          timeout: 5000
        }
      );

      return response.data.map((conn: any) => ({
        name: conn.name,
        state: conn.state,
        channels: conn.channels,
        user: conn.user,
        vhost: conn.vhost,
        protocol: conn.protocol,
        connectedAt: new Date(conn.connected_at)
      }));
    } catch (error) {
      console.error('❌ Failed to get connection stats:', error);
      return [];
    }
  }

  /**
   * Get channel statistics
   */
  async getChannelStats(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.managementApiUrl}/channels`,
        { 
          headers: { Authorization: this.authHeader },
          timeout: 5000
        }
      );

      return response.data.map((channel: any) => ({
        name: channel.name,
        state: channel.state,
        user: channel.user,
        vhost: channel.vhost,
        consumerCount: channel.consumer_count,
        messagesUnacknowledged: channel.messages_unacknowledged,
        messagesUncommitted: channel.messages_uncommitted
      }));
    } catch (error) {
      console.error('❌ Failed to get channel stats:', error);
      return [];
    }
  }
}

/**
 * Job Metrics Service
 * Handles job performance tracking and analytics
 */
class JobMetricsService {
  /**
   * Record job completion metrics
   */
  async recordJobCompletion(jobId: string, startTime: Date, endTime: Date): Promise<void> {
    try {
      const processingTime = endTime.getTime() - startTime.getTime();
      
      // Update job document with processing time
      const job = await Job.findOneAndUpdate(
        { jobId },
        {
          $set: {
            completedAt: endTime,
            processingTime
          }
        },
        { new: true }
      );

      if (job) {
        // Create performance history entry
        await JobHistory.createEvent(jobId, job.workspaceId, 'completed', {
          processingTime,
          queueWaitTime: job.queueWaitTime,
          metadata: {
            duration: processingTime,
            efficiency: this.calculateJobEfficiency(job.queueWaitTime || 0, processingTime)
          }
        });
      }
    } catch (error) {
      console.error(`❌ Failed to record job completion for ${jobId}:`, error);
    }
  }

  /**
   * Calculate job processing efficiency
   */
  private calculateJobEfficiency(waitTime: number, processingTime: number): number {
    if (waitTime + processingTime === 0) return 100;
    return Math.round((processingTime / (waitTime + processingTime)) * 100);
  }

  /**
   * Get performance statistics for a time period
   */
  async getPerformanceStats(timeframe: '1h' | '24h' | '7d' = '24h'): Promise<any[]> {
    const since = new Date();
    switch (timeframe) {
      case '1h': since.setHours(since.getHours() - 1); break;
      case '24h': since.setDate(since.getDate() - 1); break;
      case '7d': since.setDate(since.getDate() - 7); break;
    }

    try {
      const stats = await Job.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$jobType',
            totalJobs: { $sum: 1 },
            completedJobs: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            failedJobs: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            },
            processingJobs: {
              $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] }
            },
            queuedJobs: {
              $sum: { $cond: [{ $eq: ['$status', 'queued'] }, 1, 0] }
            },
            avgProcessingTime: { 
              $avg: { 
                $cond: [
                  { $ne: ['$processingTime', null] }, 
                  '$processingTime', 
                  null
                ] 
              } 
            },
            avgWaitTime: { 
              $avg: { 
                $cond: [
                  { $ne: ['$queueWaitTime', null] }, 
                  '$queueWaitTime', 
                  null
                ] 
              } 
            },
            maxProcessingTime: { $max: '$processingTime' },
            minProcessingTime: { $min: '$processingTime' }
          }
        },
        {
          $addFields: {
            successRate: {
              $cond: [
                { $eq: ['$totalJobs', 0] },
                0,
                { $multiply: [{ $divide: ['$completedJobs', '$totalJobs'] }, 100] }
              ]
            },
            failureRate: {
              $cond: [
                { $eq: ['$totalJobs', 0] },
                0,
                { $multiply: [{ $divide: ['$failedJobs', '$totalJobs'] }, 100] }
              ]
            }
          }
        },
        { $sort: { totalJobs: -1 } }
      ]);

      return stats;
    } catch (error) {
      console.error('❌ Failed to get performance stats:', error);
      return [];
    }
  }

  /**
   * Get throughput statistics (jobs per minute)
   */
  async getThroughputStats(queueName?: string, hours: number = 24): Promise<any[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const matchStage: any = {
      completedAt: { $gte: since, $ne: null }
    };
    
    if (queueName) {
      matchStage.queueName = queueName;
    }

    try {
      const throughput = await Job.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d %H:%M',
                date: '$completedAt'
              }
            },
            jobsCompleted: { $sum: 1 },
            avgProcessingTime: { $avg: '$processingTime' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return throughput;
    } catch (error) {
      console.error('❌ Failed to get throughput stats:', error);
      return [];
    }
  }

  /**
   * Get error analysis for troubleshooting
   */
  async getErrorAnalysis(workspaceId?: string, hours: number = 24): Promise<any[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const matchStage: any = {
      timestamp: { $gte: since },
      event: 'failed',
      errorMessage: { $exists: true, $ne: null }
    };
    
    if (workspaceId) {
      matchStage.workspaceId = workspaceId;
    }

    try {
      const errorAnalysis = await JobHistory.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$errorMessage',
            count: { $sum: 1 },
            lastOccurrence: { $max: '$timestamp' },
            jobs: { $addToSet: '$jobId' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]);

      return errorAnalysis;
    } catch (error) {
      console.error('❌ Failed to get error analysis:', error);
      return [];
    }
  }
}

// Export singleton instances
export const rabbitMQMonitoringService = new RabbitMQMonitoringService();
export const jobMetricsService = new JobMetricsService();

export { RabbitMQMonitoringService, JobMetricsService };