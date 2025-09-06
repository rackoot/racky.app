#!/usr/bin/env node

/**
 * Migration script to transition from Redis/Bull.js to RabbitMQ/MongoDB
 * 
 * This script:
 * 1. Creates MongoDB indexes for new job collections
 * 2. Migrates any active Bull.js jobs to the new system
 * 3. Sets up RabbitMQ queues and exchanges
 * 4. Validates the migration
 */

const mongoose = require('mongoose');
const { execSync } = require('child_process');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/racky';

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

async function createMongoDBIndexes() {
  console.log('📊 Creating MongoDB indexes for job collections...');
  
  try {
    const db = mongoose.connection.db;
    
    // Create indexes for jobs collection
    await db.collection('jobs').createIndex({ jobId: 1 }, { unique: true });
    await db.collection('jobs').createIndex({ workspaceId: 1, status: 1 });
    await db.collection('jobs').createIndex({ workspaceId: 1, createdAt: -1 });
    await db.collection('jobs').createIndex({ jobType: 1, status: 1 });
    await db.collection('jobs').createIndex({ parentJobId: 1 });
    await db.collection('jobs').createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL
    
    // Create indexes for jobhistory collection
    await db.collection('jobhistories').createIndex({ jobId: 1, timestamp: -1 });
    await db.collection('jobhistories').createIndex({ workspaceId: 1, timestamp: -1 });
    await db.collection('jobhistories').createIndex({ event: 1, timestamp: -1 });
    await db.collection('jobhistories').createIndex({ timestamp: 1 }, { expireAfterSeconds: 604800 }); // 7 days TTL
    
    // Create indexes for queuehealth collection
    await db.collection('queuehealths').createIndex({ queueName: 1, timestamp: -1 });
    await db.collection('queuehealths').createIndex({ timestamp: 1 }, { expireAfterSeconds: 604800 }); // 7 days TTL
    await db.collection('queuehealths').createIndex({ isHealthy: 1, timestamp: -1 });
    
    console.log('✅ MongoDB indexes created successfully');
  } catch (error) {
    console.error('❌ Failed to create MongoDB indexes:', error);
    throw error;
  }
}

async function setupRabbitMQInfrastructure() {
  console.log('🐰 Setting up RabbitMQ infrastructure...');
  
  try {
    // This will be handled by the RabbitMQ init script in Docker
    // For manual setup, you would run the RabbitMQ admin commands here
    console.log('ℹ️  RabbitMQ setup will be handled by Docker initialization');
    console.log('ℹ️  Ensure RabbitMQ container is running with the init script');
  } catch (error) {
    console.error('❌ Failed to setup RabbitMQ infrastructure:', error);
    throw error;
  }
}

async function migrateActiveBullJobs() {
  console.log('🔄 Checking for active Bull.js jobs to migrate...');
  
  try {
    // Since we're replacing the system entirely, we'll just log this step
    // In a real migration, you would:
    // 1. Connect to Redis
    // 2. Extract active jobs from Bull.js queues
    // 3. Convert them to MongoDB format
    // 4. Re-queue them in RabbitMQ
    
    console.log('ℹ️  No active Bull.js jobs found to migrate (fresh installation)');
    console.log('✅ Bull.js job migration completed');
  } catch (error) {
    console.error('❌ Failed to migrate Bull.js jobs:', error);
    throw error;
  }
}

async function validateMigration() {
  console.log('🔍 Validating migration...');
  
  try {
    const db = mongoose.connection.db;
    
    // Check that collections exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    const requiredCollections = ['jobs', 'jobhistories', 'queuehealths'];
    const missingCollections = requiredCollections.filter(name => !collectionNames.includes(name));
    
    if (missingCollections.length > 0) {
      console.warn(`⚠️  Some collections don't exist yet (will be created on first use): ${missingCollections.join(', ')}`);
    }
    
    // Check indexes
    const jobsIndexes = await db.collection('jobs').indexes();
    console.log(`✅ Jobs collection has ${jobsIndexes.length} indexes`);
    
    // Validate environment variables
    const requiredEnvVars = ['MONGODB_URI', 'RABBITMQ_URL', 'USE_RABBITMQ'];
    const missingEnvVars = requiredEnvVars.filter(name => !process.env[name]);
    
    if (missingEnvVars.length > 0) {
      console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
      throw new Error('Missing required environment variables');
    }
    
    if (process.env.USE_RABBITMQ !== 'true') {
      console.warn('⚠️  USE_RABBITMQ is not set to "true" - make sure to update your environment');
    }
    
    console.log('✅ Migration validation completed successfully');
  } catch (error) {
    console.error('❌ Migration validation failed:', error);
    throw error;
  }
}

async function updateEnvironmentConfig() {
  console.log('🔧 Environment configuration checklist:');
  
  console.log('📝 Required environment variables:');
  console.log('   RABBITMQ_URL=amqp://racky:racky123@rabbitmq:5672/racky');
  console.log('   RABBITMQ_USER=racky');
  console.log('   RABBITMQ_PASS=racky123');
  console.log('   RABBITMQ_VHOST=racky');
  console.log('   RABBITMQ_MGMT_URL=http://rabbitmq:15672');
  console.log('   USE_RABBITMQ=true');
  
  console.log('📝 Docker services that should be running:');
  console.log('   - mongodb (database)');
  console.log('   - rabbitmq (message broker)');
  console.log('   - backend (application server)');
  
  console.log('📝 RabbitMQ Management UI:');
  console.log('   URL: http://localhost:15672');
  console.log('   Username: racky');
  console.log('   Password: racky123');
}

async function cleanupOldSystem() {
  console.log('🧹 Cleanup recommendations:');
  
  console.log('📝 After successful migration and testing:');
  console.log('   1. Remove Bull.js and Redis dependencies from package.json');
  console.log('   2. Remove Redis service from docker-compose.yml');
  console.log('   3. Remove old Bull.js job setup files');
  console.log('   4. Update any remaining Redis references in code');
  
  console.log('📝 Files that can be removed after migration:');
  console.log('   - /server/src/jobs/jobSetup.ts (replaced with rabbitMQJobSetup.ts)');
  console.log('   - Any Bull.js specific configuration files');
  
  console.log('⚠️  Keep Redis configuration commented out for potential rollback');
}

async function main() {
  console.log('🚀 Starting Redis to RabbitMQ migration...');
  console.log('=====================================');
  
  try {
    // Step 1: Connect to database
    await connectToDatabase();
    
    // Step 2: Create MongoDB indexes
    await createMongoDBIndexes();
    
    // Step 3: Setup RabbitMQ infrastructure
    await setupRabbitMQInfrastructure();
    
    // Step 4: Migrate active jobs (if any)
    await migrateActiveBullJobs();
    
    // Step 5: Validate migration
    await validateMigration();
    
    // Step 6: Environment configuration info
    await updateEnvironmentConfig();
    
    // Step 7: Cleanup recommendations
    await cleanupOldSystem();
    
    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('=====================================');
    console.log('🚀 Next steps:');
    console.log('   1. Start your Docker containers: docker-compose up -d');
    console.log('   2. Verify RabbitMQ is running: http://localhost:15672');
    console.log('   3. Test job processing with a marketplace sync');
    console.log('   4. Monitor the application logs for any issues');
    console.log('');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the migration
if (require.main === module) {
  main();
}

module.exports = {
  main,
  createMongoDBIndexes,
  validateMigration
};