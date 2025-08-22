const mongoose = require('mongoose');
const { config } = require('dotenv');

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/racky';

// Simple schemas for rollback
const WorkspaceSchema = new mongoose.Schema({}, { strict: false });
const WorkspaceUserSchema = new mongoose.Schema({}, { strict: false });
const StoreConnectionSchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });
const SubscriptionSchema = new mongoose.Schema({}, { strict: false });
const UsageSchema = new mongoose.Schema({}, { strict: false });
const OpportunitySchema = new mongoose.Schema({}, { strict: false });
const SuggestionSchema = new mongoose.Schema({}, { strict: false });

const Workspace = mongoose.model('Workspace', WorkspaceSchema);
const WorkspaceUser = mongoose.model('WorkspaceUser', WorkspaceUserSchema);
const StoreConnection = mongoose.model('StoreConnection', StoreConnectionSchema);
const Product = mongoose.model('Product', ProductSchema);
const Subscription = mongoose.model('Subscription', SubscriptionSchema);
const Usage = mongoose.model('Usage', UsageSchema);
const Opportunity = mongoose.model('Opportunity', OpportunitySchema);
const Suggestion = mongoose.model('Suggestion', SuggestionSchema);

async function rollbackWorkspaces() {
  try {
    console.log('🔄 Starting rollback of workspace architecture...');
    console.log('⚠️  WARNING: This will remove all workspace data and revert to user-based architecture');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    let totalRecordsProcessed = 0;

    // Get all workspace-user relationships to understand data ownership
    const workspaceUsers = await WorkspaceUser.find({ isActive: true, role: 'OWNER' });
    console.log(`📊 Found ${workspaceUsers.length} workspace owners to process`);

    for (const workspaceUser of workspaceUsers) {
      const workspaceId = workspaceUser.workspaceId;
      const userId = workspaceUser.userId;
      
      console.log(`\n🔄 Processing workspace ${workspaceId} owned by user ${userId}`);

      // Remove workspaceId from Store Connections (keep userId)
      const storeConnections = await StoreConnection.find({ workspaceId });
      for (const connection of storeConnections) {
        await StoreConnection.updateOne(
          { _id: connection._id },
          { 
            $unset: { workspaceId: 1 },
            $set: { userId: userId } // Ensure userId is set
          }
        );
        totalRecordsProcessed++;
      }
      console.log(`  ✓ Reverted ${storeConnections.length} store connections`);

      // Remove workspaceId from Products (keep userId)
      const products = await Product.find({ workspaceId });
      for (const product of products) {
        await Product.updateOne(
          { _id: product._id },
          { 
            $unset: { workspaceId: 1 },
            $set: { userId: userId } // Ensure userId is set
          }
        );
        totalRecordsProcessed++;
      }
      console.log(`  ✓ Reverted ${products.length} products`);

      // Remove workspaceId from Subscriptions (keep userId)
      const subscriptions = await Subscription.find({ workspaceId });
      for (const subscription of subscriptions) {
        await Subscription.updateOne(
          { _id: subscription._id },
          { 
            $unset: { workspaceId: 1 },
            $set: { userId: userId } // Ensure userId is set
          }
        );
        totalRecordsProcessed++;
      }
      console.log(`  ✓ Reverted ${subscriptions.length} subscriptions`);

      // Remove workspaceId from Usage records (keep userId)
      const usageRecords = await Usage.find({ workspaceId });
      for (const usage of usageRecords) {
        await Usage.updateOne(
          { _id: usage._id },
          { 
            $unset: { workspaceId: 1 },
            $set: { userId: userId } // Ensure userId is set
          }
        );
        totalRecordsProcessed++;
      }
      console.log(`  ✓ Reverted ${usageRecords.length} usage records`);

      // Remove workspaceId from Opportunities (keep userId)
      const opportunities = await Opportunity.find({ workspaceId });
      for (const opportunity of opportunities) {
        await Opportunity.updateOne(
          { _id: opportunity._id },
          { 
            $unset: { workspaceId: 1 },
            $set: { userId: userId } // Ensure userId is set
          }
        );
        totalRecordsProcessed++;
      }
      console.log(`  ✓ Reverted ${opportunities.length} opportunities`);

      // Remove workspaceId from Suggestions (keep userId)
      const suggestions = await Suggestion.find({ workspaceId });
      for (const suggestion of suggestions) {
        await Suggestion.updateOne(
          { _id: suggestion._id },
          { 
            $unset: { workspaceId: 1 },
            $set: { userId: userId } // Ensure userId is set
          }
        );
        totalRecordsProcessed++;
      }
      console.log(`  ✓ Reverted ${suggestions.length} suggestions`);
    }

    // Delete all workspace-related collections
    const workspaceCount = await Workspace.countDocuments();
    const workspaceUserCount = await WorkspaceUser.countDocuments();
    
    await Workspace.deleteMany({});
    await WorkspaceUser.deleteMany({});
    
    console.log(`\n🗑️  Deleted ${workspaceCount} workspaces`);
    console.log(`🗑️  Deleted ${workspaceUserCount} workspace user relationships`);

    console.log('\n🎉 Rollback completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Records reverted: ${totalRecordsProcessed}`);
    console.log(`   - Workspaces deleted: ${workspaceCount}`);
    console.log(`   - Workspace users deleted: ${workspaceUserCount}`);

    console.log('\n⚠️  Post-rollback steps:');
    console.log('1. Revert your application code to use userId context');
    console.log('2. Remove workspace-related middleware and routes');
    console.log('3. Update database indexes to remove workspaceId fields');
    console.log('4. Test all functionality with user-based isolation');

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run rollback if called directly
if (require.main === module) {
  console.log('⚠️  You are about to rollback the workspace architecture!');
  console.log('⚠️  This will delete all workspace data and revert to user-based architecture.');
  console.log('⚠️  Press Ctrl+C within 10 seconds to cancel...');
  
  setTimeout(() => {
    rollbackWorkspaces()
      .then(() => {
        console.log('🏁 Rollback script completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Rollback script failed:', error);
        process.exit(1);
      });
  }, 10000); // 10 second delay
}

module.exports = { rollbackWorkspaces };