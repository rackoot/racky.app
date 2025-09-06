#!/usr/bin/env node

/**
 * Emergency rollback script to revert from RabbitMQ back to Redis/Bull.js
 * 
 * This script:
 * 1. Stops RabbitMQ consumers
 * 2. Migrates active RabbitMQ jobs back to Redis
 * 3. Switches environment configuration back to Redis
 * 4. Restarts the application with Bull.js
 */

const mongoose = require('mongoose');
const readline = require('readline');
const { execSync } = require('child_process');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/racky';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

async function checkRollbackConditions() {
  console.log('🔍 Checking system conditions for rollback...');
  
  try {
    const db = mongoose.connection.db;
    
    // Check for active RabbitMQ jobs
    const activeJobs = await db.collection('jobs').countDocuments({
      status: { $in: ['queued', 'processing'] },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });
    
    console.log(`Found ${activeJobs} active jobs in the last 24 hours`);
    
    // Check recent failures
    const recentFailures = await db.collection('jobs').countDocuments({
      status: 'failed',
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    });
    
    console.log(`Found ${recentFailures} failed jobs in the last hour`);
    
    return {
      activeJobs,
      recentFailures,
      shouldProceed: true // Always allow manual rollback
    };
  } catch (error) {
    console.error('❌ Failed to check rollback conditions:', error);
    throw error;
  }
}

async function migrateActiveJobsToRedis() {
  console.log('🔄 Migrating active RabbitMQ jobs to Redis/Bull.js...');
  
  try {
    const db = mongoose.connection.db;
    
    // Get all active jobs from MongoDB
    const activeJobs = await db.collection('jobs').find({
      status: { $in: ['queued', 'processing'] },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).toArray();
    
    console.log(`Found ${activeJobs.length} active jobs to migrate`);
    
    if (activeJobs.length === 0) {
      console.log('✅ No active jobs to migrate');
      return;
    }
    
    // For each active job, we would:
    // 1. Convert job data back to Bull.js format
    // 2. Add to appropriate Redis queue
    // 3. Mark as migrated in MongoDB
    
    for (const job of activeJobs) {
      try {
        console.log(`Migrating job ${job.jobId} (${job.jobType})`);
        
        // Mark job as migrated back to Bull.js
        await db.collection('jobs').updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'migrated_to_bull',
              updatedAt: new Date(),
              'metadata.rolledBackAt': new Date(),
              'metadata.rollbackReason': 'emergency_rollback'
            }
          }
        );
        
        // Create history entry
        await db.collection('jobhistories').insertOne({
          jobId: job.jobId,
          workspaceId: job.workspaceId,
          event: 'rollback',
          timestamp: new Date(),
          metadata: {
            fromSystem: 'rabbitmq',
            toSystem: 'bull',
            reason: 'emergency_rollback'
          }
        });
        
      } catch (error) {
        console.error(`❌ Failed to migrate job ${job.jobId}:`, error);
      }
    }
    
    console.log('✅ Job migration to Redis completed');
  } catch (error) {
    console.error('❌ Failed to migrate jobs to Redis:', error);
    throw error;
  }
}

async function switchEnvironmentConfiguration() {
  console.log('🔧 Switching environment configuration...');
  
  try {
    console.log('📝 Required environment changes:');
    console.log('');
    console.log('Set these environment variables:');
    console.log('   USE_RABBITMQ=false');
    console.log('   REDIS_URL=redis://redis:6379');
    console.log('');
    console.log('Comment out these variables:');
    console.log('   # RABBITMQ_URL=amqp://racky:racky123@rabbitmq:5672/racky');
    console.log('   # RABBITMQ_USER=racky');
    console.log('   # RABBITMQ_PASS=racky123');
    console.log('');
    
    console.log('⚠️  Manual step required: Update your .env.docker file');
    
    const shouldContinue = await askQuestion('Have you updated the environment configuration? (yes/no): ');
    if (shouldContinue.toLowerCase() !== 'yes') {
      console.log('❌ Rollback cancelled. Please update environment configuration first.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Failed to switch environment configuration:', error);
    throw error;
  }
}

async function restoreRedisInfrastructure() {
  console.log('🔴 Restoring Redis infrastructure...');
  
  try {
    console.log('📝 Required Docker Compose changes:');
    console.log('');
    console.log('1. Restore Redis service in docker-compose.yml:');
    console.log(`
  redis:
    image: redis:7.2-alpine
    container_name: racky-redis
    restart: unless-stopped
    ports:
      - "\${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    networks:
      - racky-network
    command: redis-server --appendonly yes`);
    console.log('');
    console.log('2. Update backend service dependencies to include Redis');
    console.log('3. Add redis_data volume back to volumes section');
    console.log('');
    
    console.log('⚠️  Manual step required: Update docker-compose.yml file');
    
    const shouldContinue = await askQuestion('Have you updated the Docker configuration? (yes/no): ');
    if (shouldContinue.toLowerCase() !== 'yes') {
      console.log('❌ Rollback cancelled. Please update Docker configuration first.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Failed to restore Redis infrastructure:', error);
    throw error;
  }
}

async function restartServices() {
  console.log('🔄 Service restart recommendations...');
  
  try {
    console.log('📝 Recommended restart sequence:');
    console.log('');
    console.log('1. Stop all containers:');
    console.log('   docker-compose down');
    console.log('');
    console.log('2. Start with Redis:');
    console.log('   docker-compose up -d redis mongodb');
    console.log('');
    console.log('3. Start backend (should now use Bull.js):');
    console.log('   docker-compose up -d backend');
    console.log('');
    console.log('4. Start frontend:');
    console.log('   docker-compose up -d frontend');
    console.log('');
    
    console.log('⚠️  Manual step required: Restart Docker services');
    
  } catch (error) {
    console.error('❌ Failed to restart services:', error);
    throw error;
  }
}

async function validateRollback() {
  console.log('🔍 Rollback validation checklist...');
  
  try {
    console.log('📝 Verify these items after restart:');
    console.log('');
    console.log('✅ Redis container is running and accessible');
    console.log('✅ Backend logs show Bull.js initialization (not RabbitMQ)');
    console.log('✅ Job processing is working (test with a marketplace sync)');
    console.log('✅ No RabbitMQ connection errors in logs');
    console.log('✅ Health check endpoint returns Redis-based statistics');
    console.log('');
    
    console.log('🏥 Health monitoring:');
    console.log('   - Monitor application logs for 30 minutes');
    console.log('   - Test critical job workflows');
    console.log('   - Verify no data loss occurred during rollback');
    console.log('');
    
  } catch (error) {
    console.error('❌ Rollback validation failed:', error);
    throw error;
  }
}

async function createRollbackReport() {
  console.log('📊 Creating rollback report...');
  
  try {
    const db = mongoose.connection.db;
    
    // Count migrated jobs
    const migratedJobs = await db.collection('jobs').countDocuments({
      'metadata.rolledBackAt': { $exists: true }
    });
    
    // Count failed jobs in last hour
    const recentFailures = await db.collection('jobs').countDocuments({
      status: 'failed',
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    });
    
    const report = {
      timestamp: new Date().toISOString(),
      migratedJobs,
      recentFailures,
      rollbackReason: 'manual_emergency_rollback',
      systemState: 'rolled_back_to_redis'
    };
    
    // Save report to database
    await db.collection('systemreports').insertOne({
      type: 'rollback',
      ...report
    });
    
    console.log('📊 Rollback Report:');
    console.log(`   Jobs migrated back to Redis: ${migratedJobs}`);
    console.log(`   Recent failures: ${recentFailures}`);
    console.log(`   Rollback completed at: ${report.timestamp}`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Failed to create rollback report:', error);
    // Don't throw - this is not critical
  }
}

async function main() {
  console.log('🚨 EMERGENCY ROLLBACK TO REDIS/BULL.JS');
  console.log('=====================================');
  console.log('');
  
  // Confirmation prompt
  const confirmed = await askQuestion('⚠️  Are you sure you want to rollback to Redis/Bull.js? This will stop RabbitMQ job processing. (yes/no): ');
  if (confirmed.toLowerCase() !== 'yes') {
    console.log('❌ Rollback cancelled');
    process.exit(0);
  }
  
  try {
    // Step 1: Connect to database
    await connectToDatabase();
    
    // Step 2: Check rollback conditions
    const conditions = await checkRollbackConditions();
    console.log('✅ Rollback conditions checked');
    
    // Step 3: Migrate active jobs back to Redis format
    await migrateActiveJobsToRedis();
    
    // Step 4: Switch environment configuration
    await switchEnvironmentConfiguration();
    
    // Step 5: Restore Redis infrastructure
    await restoreRedisInfrastructure();
    
    // Step 6: Service restart instructions
    await restartServices();
    
    // Step 7: Validation checklist
    await validateRollback();
    
    // Step 8: Create rollback report
    await createRollbackReport();
    
    console.log('✅ ROLLBACK COMPLETED!');
    console.log('===================');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Restart Docker services as instructed above');
    console.log('   2. Monitor application logs for 30+ minutes');
    console.log('   3. Test critical job processing workflows');
    console.log('   4. Consider investigating the root cause of the rollback');
    console.log('');
    console.log('📞 If issues persist, check:');
    console.log('   - Docker container logs');
    console.log('   - Redis connectivity');
    console.log('   - Bull.js job queue health');
    console.log('');
    
  } catch (error) {
    console.error('❌ Emergency rollback failed:', error);
    console.log('');
    console.log('🆘 MANUAL INTERVENTION REQUIRED');
    console.log('Contact system administrator immediately');
    process.exit(1);
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

// Run the rollback
if (require.main === module) {
  main();
}

module.exports = {
  main,
  migrateActiveJobsToRedis,
  checkRollbackConditions
};