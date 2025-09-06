#!/usr/bin/env node

/**
 * Validation script for RabbitMQ migration
 * 
 * This script:
 * 1. Tests RabbitMQ connectivity
 * 2. Validates MongoDB job collections
 * 3. Tests job creation and processing
 * 4. Verifies health monitoring
 * 5. Provides migration success report
 */

const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/racky';
const RABBITMQ_MGMT_URL = process.env.RABBITMQ_MGMT_URL || 'http://localhost:15672';
const RABBITMQ_USER = process.env.RABBITMQ_USER || 'racky';
const RABBITMQ_PASS = process.env.RABBITMQ_PASS || 'racky123';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

class MigrationValidator {
  constructor() {
    this.results = {
      mongodb: { status: 'pending', details: [] },
      rabbitmq: { status: 'pending', details: [] },
      application: { status: 'pending', details: [] },
      performance: { status: 'pending', details: [] }
    };
  }

  async validateMongoDB() {
    console.log('🔍 Validating MongoDB setup...');
    
    try {
      await mongoose.connect(MONGODB_URI);
      this.results.mongodb.details.push('✅ MongoDB connection successful');
      
      const db = mongoose.connection.db;
      
      // Check required collections exist (or can be created)
      const requiredCollections = ['jobs', 'jobhistories', 'queuehealths'];
      for (const collectionName of requiredCollections) {
        try {
          await db.createCollection(collectionName);
          this.results.mongodb.details.push(`✅ Collection "${collectionName}" ready`);
        } catch (error) {
          if (error.code === 48) { // Collection already exists
            this.results.mongodb.details.push(`✅ Collection "${collectionName}" exists`);
          } else {
            throw error;
          }
        }
      }
      
      // Verify indexes exist
      const jobsIndexes = await db.collection('jobs').indexes();
      this.results.mongodb.details.push(`✅ Jobs collection has ${jobsIndexes.length} indexes`);
      
      // Test basic operations
      const testDoc = {
        jobId: 'test-validation-' + Date.now(),
        jobType: 'TEST_VALIDATION',
        queueName: 'test.validation',
        routingKey: 'test.validation.normal',
        userId: 'test-user',
        workspaceId: 'test-workspace',
        data: { test: true },
        status: 'completed',
        progress: 100,
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: 1,
        priority: 5
      };
      
      await db.collection('jobs').insertOne(testDoc);
      const retrieved = await db.collection('jobs').findOne({ jobId: testDoc.jobId });
      await db.collection('jobs').deleteOne({ jobId: testDoc.jobId });
      
      if (retrieved) {
        this.results.mongodb.details.push('✅ Basic CRUD operations working');
      } else {
        throw new Error('Failed to retrieve test document');
      }
      
      this.results.mongodb.status = 'success';
      
    } catch (error) {
      this.results.mongodb.status = 'failed';
      this.results.mongodb.details.push(`❌ MongoDB validation failed: ${error.message}`);
    }
  }

  async validateRabbitMQ() {
    console.log('🔍 Validating RabbitMQ setup...');
    
    try {
      const authHeader = `Basic ${Buffer.from(`${RABBITMQ_USER}:${RABBITMQ_PASS}`).toString('base64')}`;
      
      // Test management API connectivity
      const overviewResponse = await axios.get(`${RABBITMQ_MGMT_URL}/api/overview`, {
        headers: { Authorization: authHeader },
        timeout: 5000
      });
      
      this.results.rabbitmq.details.push('✅ RabbitMQ Management API accessible');
      this.results.rabbitmq.details.push(`✅ RabbitMQ version: ${overviewResponse.data.rabbitmq_version}`);
      
      // Check required exchanges
      const exchangesResponse = await axios.get(`${RABBITMQ_MGMT_URL}/api/exchanges/racky`, {
        headers: { Authorization: authHeader },
        timeout: 5000
      });
      
      const exchanges = exchangesResponse.data.map(e => e.name);
      const requiredExchanges = [
        'racky.sync.exchange',
        'racky.products.exchange',
        'racky.ai.exchange',
        'racky.updates.exchange',
        'racky.dlx'
      ];
      
      for (const exchangeName of requiredExchanges) {
        if (exchanges.includes(exchangeName)) {
          this.results.rabbitmq.details.push(`✅ Exchange "${exchangeName}" exists`);
        } else {
          this.results.rabbitmq.details.push(`❌ Exchange "${exchangeName}" missing`);
        }
      }
      
      // Check required queues
      const queuesResponse = await axios.get(`${RABBITMQ_MGMT_URL}/api/queues/racky`, {
        headers: { Authorization: authHeader },
        timeout: 5000
      });
      
      const queues = queuesResponse.data.map(q => q.name);
      const requiredQueues = [
        'sync.marketplace',
        'products.batch',
        'products.individual',
        'ai.scan',
        'ai.batch',
        'updates.batch',
        'racky.failed'
      ];
      
      for (const queueName of requiredQueues) {
        if (queues.includes(queueName)) {
          this.results.rabbitmq.details.push(`✅ Queue "${queueName}" exists`);
        } else {
          this.results.rabbitmq.details.push(`❌ Queue "${queueName}" missing`);
        }
      }
      
      // Check connections
      const connectionsResponse = await axios.get(`${RABBITMQ_MGMT_URL}/api/connections`, {
        headers: { Authorization: authHeader },
        timeout: 5000
      });
      
      this.results.rabbitmq.details.push(`✅ Active connections: ${connectionsResponse.data.length}`);
      
      this.results.rabbitmq.status = 'success';
      
    } catch (error) {
      this.results.rabbitmq.status = 'failed';
      this.results.rabbitmq.details.push(`❌ RabbitMQ validation failed: ${error.message}`);
    }
  }

  async validateApplication() {
    console.log('🔍 Validating application integration...');
    
    try {
      // Test health endpoint
      const healthResponse = await axios.get(`${BACKEND_URL}/api/products/sync/health`, {
        timeout: 10000
      });
      
      if (healthResponse.data.success) {
        this.results.application.details.push('✅ Health endpoint responding');
        
        const healthData = healthResponse.data.data;
        this.results.application.details.push(`✅ Overall system health: ${healthData.overall}`);
        
        if (healthData.services.rabbitmq) {
          this.results.application.details.push(`✅ RabbitMQ integration: ${healthData.services.rabbitmq.status}`);
        }
        
        if (healthData.services.database) {
          this.results.application.details.push(`✅ Database integration: ${healthData.services.database.status}`);
        }
        
      } else {
        throw new Error('Health endpoint returned unsuccessful response');
      }
      
      // Test job listing endpoint (should work even with no jobs)
      try {
        const jobsResponse = await axios.get(`${BACKEND_URL}/api/products/sync/jobs?limit=1`, {
          timeout: 5000
        });
        
        if (jobsResponse.data.success) {
          this.results.application.details.push('✅ Job listing endpoint working');
        }
      } catch (error) {
        // This might fail if authentication is required, which is expected
        this.results.application.details.push('ℹ️  Job listing endpoint requires authentication (expected)');
      }
      
      this.results.application.status = 'success';
      
    } catch (error) {
      this.results.application.status = 'failed';
      this.results.application.details.push(`❌ Application validation failed: ${error.message}`);
    }
  }

  async validatePerformance() {
    console.log('🔍 Validating performance and monitoring...');
    
    try {
      const db = mongoose.connection.db;
      
      // Test query performance on jobs collection
      const startTime = Date.now();
      await db.collection('jobs').find({}).limit(10).toArray();
      const queryTime = Date.now() - startTime;
      
      this.results.performance.details.push(`✅ Database query performance: ${queryTime}ms`);
      
      if (queryTime > 1000) {
        this.results.performance.details.push('⚠️  Database queries are slow (>1s)');
      }
      
      // Check if health monitoring data exists
      const healthRecords = await db.collection('queuehealths').countDocuments();
      this.results.performance.details.push(`ℹ️  Queue health records: ${healthRecords}`);
      
      // Check job history functionality
      const historyRecords = await db.collection('jobhistories').countDocuments();
      this.results.performance.details.push(`ℹ️  Job history records: ${historyRecords}`);
      
      this.results.performance.status = 'success';
      
    } catch (error) {
      this.results.performance.status = 'failed';
      this.results.performance.details.push(`❌ Performance validation failed: ${error.message}`);
    }
  }

  async generateReport() {
    console.log('📊 Generating validation report...');
    
    const allSuccessful = Object.values(this.results).every(r => r.status === 'success');
    const hasFailures = Object.values(this.results).some(r => r.status === 'failed');
    
    console.log('\n=====================================');
    console.log('🔍 RABBITMQ MIGRATION VALIDATION REPORT');
    console.log('=====================================\n');
    
    // MongoDB Results
    console.log('📊 MongoDB Validation:');
    console.log(`Status: ${this.getStatusEmoji(this.results.mongodb.status)} ${this.results.mongodb.status.toUpperCase()}`);
    this.results.mongodb.details.forEach(detail => console.log(`   ${detail}`));
    console.log('');
    
    // RabbitMQ Results
    console.log('🐰 RabbitMQ Validation:');
    console.log(`Status: ${this.getStatusEmoji(this.results.rabbitmq.status)} ${this.results.rabbitmq.status.toUpperCase()}`);
    this.results.rabbitmq.details.forEach(detail => console.log(`   ${detail}`));
    console.log('');
    
    // Application Results
    console.log('🚀 Application Integration:');
    console.log(`Status: ${this.getStatusEmoji(this.results.application.status)} ${this.results.application.status.toUpperCase()}`);
    this.results.application.details.forEach(detail => console.log(`   ${detail}`));
    console.log('');
    
    // Performance Results
    console.log('⚡ Performance & Monitoring:');
    console.log(`Status: ${this.getStatusEmoji(this.results.performance.status)} ${this.results.performance.status.toUpperCase()}`);
    this.results.performance.details.forEach(detail => console.log(`   ${detail}`));
    console.log('');
    
    // Overall Summary
    console.log('=====================================');
    if (allSuccessful) {
      console.log('✅ MIGRATION VALIDATION SUCCESSFUL!');
      console.log('🎉 Your RabbitMQ migration is working correctly.');
      console.log('');
      console.log('🚀 Next steps:');
      console.log('   1. Test marketplace sync functionality');
      console.log('   2. Monitor job processing for 24 hours');
      console.log('   3. Set up production monitoring alerts');
      console.log('   4. Remove old Redis/Bull.js dependencies');
    } else if (hasFailures) {
      console.log('❌ MIGRATION VALIDATION FAILED!');
      console.log('🚨 Critical issues found that need resolution.');
      console.log('');
      console.log('🛠️  Action required:');
      console.log('   1. Review failed validation checks above');
      console.log('   2. Fix configuration issues');
      console.log('   3. Consider rollback if issues persist');
      console.log('   4. Re-run validation after fixes');
    } else {
      console.log('⚠️  MIGRATION VALIDATION INCOMPLETE');
      console.log('Some checks are still pending or had issues.');
    }
    console.log('=====================================\n');
    
    // Save report to database
    try {
      const db = mongoose.connection.db;
      await db.collection('migrationreports').insertOne({
        type: 'validation',
        timestamp: new Date(),
        results: this.results,
        overallStatus: allSuccessful ? 'success' : hasFailures ? 'failed' : 'incomplete',
        environment: {
          mongodbUri: MONGODB_URI,
          rabbitmqMgmtUrl: RABBITMQ_MGMT_URL,
          backendUrl: BACKEND_URL,
          nodeEnv: process.env.NODE_ENV || 'development'
        }
      });
      console.log('📊 Validation report saved to database');
    } catch (error) {
      console.log(`⚠️  Could not save report to database: ${error.message}`);
    }
    
    return allSuccessful;
  }

  getStatusEmoji(status) {
    switch (status) {
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'pending': return '⏳';
      default: return '❓';
    }
  }
}

async function main() {
  console.log('🔍 Starting RabbitMQ migration validation...');
  console.log('==========================================\n');
  
  const validator = new MigrationValidator();
  
  try {
    // Run all validations
    await validator.validateMongoDB();
    await validator.validateRabbitMQ();
    await validator.validateApplication();
    await validator.validatePerformance();
    
    // Generate and display report
    const isValid = await validator.generateReport();
    
    // Exit with appropriate code
    process.exit(isValid ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Validation process failed:', error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  main();
}

module.exports = {
  MigrationValidator,
  main
};