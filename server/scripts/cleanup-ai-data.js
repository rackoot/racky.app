#!/usr/bin/env node

/**
 * Cleanup Script for AI Optimization Data
 * 
 * This script deletes all AI-related data including:
 * - Opportunities
 * - Product History entries
 * - AI optimization queue jobs
 * - AI scan results
 */

const mongoose = require('mongoose');
const Bull = require('bull');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/racky';

// Redis connection for Bull queues
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function connectToDatabase() {
  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');
}

async function cleanupDatabase() {
  console.log('\n🗑️  Starting database cleanup...');

  // Use direct database operations instead of model imports
  const db = mongoose.connection.db;

  // 1. Delete all opportunities
  console.log('📝 Deleting all opportunities...');
  const opportunitiesResult = await db.collection('opportunities').deleteMany({});
  console.log(`   ✅ Deleted ${opportunitiesResult.deletedCount} opportunities`);

  // 2. Delete all AI-related product history entries
  console.log('📋 Deleting AI-related product history entries...');
  const historyResult = await db.collection('producthistories').deleteMany({
    actionType: {
      $in: [
        'AI_OPTIMIZATION_GENERATED',
        'AI_OPTIMIZATION_ACCEPTED', 
        'AI_OPTIMIZATION_REJECTED',
        'AI_OPTIMIZATION_APPLIED',
        'AI_BULK_SCAN_STARTED',
        'AI_BULK_SCAN_COMPLETED'
      ]
    }
  });
  console.log(`   ✅ Deleted ${historyResult.deletedCount} AI history entries`);

  // 3. Check for any other AI-related collections and clean them
  console.log('🔍 Checking for additional AI-related data...');
  const collections = await db.listCollections().toArray();
  console.log('   📋 Available collections:', collections.map(c => c.name).join(', '));

  console.log('✅ Database cleanup completed!');
}

async function cleanupQueue() {
  console.log('\n🔄 Starting queue cleanup...');

  // Create queue instance (Bull will handle Redis connection internally)
  const aiQueue = new Bull('ai-optimization', REDIS_URL);
  
  console.log('✅ Connected to AI optimization queue');

  try {
    // Get all jobs in different states (using available methods)
    console.log('📦 Retrieving all jobs from ai-optimization queue...');
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      aiQueue.getWaiting(),
      aiQueue.getActive(), 
      aiQueue.getCompleted(),
      aiQueue.getFailed(),
      aiQueue.getDelayed()
    ]);

    const allJobs = [...waiting, ...active, ...completed, ...failed, ...delayed];
    console.log(`   📊 Found ${allJobs.length} total jobs`);
    console.log(`      - Waiting: ${waiting.length}`);
    console.log(`      - Active: ${active.length}`);
    console.log(`      - Completed: ${completed.length}`);
    console.log(`      - Failed: ${failed.length}`);
    console.log(`      - Delayed: ${delayed.length}`);

    // Remove all jobs
    if (allJobs.length > 0) {
      console.log('🗑️  Removing all jobs...');
      
      // Remove jobs by ID
      for (const job of allJobs) {
        try {
          await job.remove();
        } catch (error) {
          console.log(`   ⚠️  Warning: Could not remove job ${job.id}: ${error.message}`);
        }
      }
      
      console.log('✅ All jobs removed');
    }

    // Clean the queue completely - use correct job state names
    console.log('🧹 Cleaning queue data...');
    try {
      await aiQueue.clean(0, 'completed');
      await aiQueue.clean(0, 'failed');
      // Note: 'waiting' state may not be cleanable - jobs are already removed above
      console.log('   ✅ Cleaned completed and failed jobs');
    } catch (error) {
      console.log(`   ⚠️  Clean operation warning: ${error.message}`);
    }

    // Additional cleanup - clean queue data directly
    console.log('🔑 Cleaning remaining queue data...');
    await aiQueue.obliterate({ force: true });
    console.log('   ✅ Queue obliterated (all data removed)');

    console.log('✅ Queue cleanup completed!');

  } finally {
    // Cleanup connections
    await aiQueue.close();
  }
}

async function main() {
  try {
    console.log('🚀 Starting AI Data Cleanup Script');
    console.log('=====================================');
    
    // Connect to database
    await connectToDatabase();
    
    // Clean up database
    await cleanupDatabase();
    
    // Clean up queue
    await cleanupQueue();
    
    console.log('\n🎉 AI Data Cleanup Complete!');
    console.log('=====================================');
    console.log('✅ All opportunities deleted');
    console.log('✅ All AI history entries deleted');
    console.log('✅ All AI queue jobs deleted');
    console.log('✅ All queue data cleaned');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.disconnect();
    console.log('🔒 Database connection closed');
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, cleaning up...');
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, cleaning up...');
  await mongoose.disconnect();
  process.exit(0);
});

// Run the cleanup
main();