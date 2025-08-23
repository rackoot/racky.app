const mongoose = require('mongoose');
const { config } = require('dotenv');

// Load environment variables
config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/racky';

// Simple schemas for migration
const UserSchema = new mongoose.Schema({}, { strict: false });
const WorkspaceSchema = new mongoose.Schema({}, { strict: false });
const WorkspaceUserSchema = new mongoose.Schema({}, { strict: false });
const StoreConnectionSchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });
const SubscriptionSchema = new mongoose.Schema({}, { strict: false });
const UsageSchema = new mongoose.Schema({}, { strict: false });
const OpportunitySchema = new mongoose.Schema({}, { strict: false });
const SuggestionSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.model('User', UserSchema);
const Workspace = mongoose.model('Workspace', WorkspaceSchema);
const WorkspaceUser = mongoose.model('WorkspaceUser', WorkspaceUserSchema);
const StoreConnection = mongoose.model('StoreConnection', StoreConnectionSchema);
const Product = mongoose.model('Product', ProductSchema);
const Subscription = mongoose.model('Subscription', SubscriptionSchema);
const Usage = mongoose.model('Usage', UsageSchema);
const Opportunity = mongoose.model('Opportunity', OpportunitySchema);
const Suggestion = mongoose.model('Suggestion', SuggestionSchema);

// Helper function to generate slug
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 50);
}

// Helper function to generate unique slug
async function generateUniqueSlug(baseName) {
  let baseSlug = generateSlug(baseName);
  let slug = baseSlug;
  let counter = 1;

  while (await Workspace.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

async function migrateToWorkspaces() {
  try {
    console.log('🚀 Starting migration to workspace architecture...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all existing users
    const users = await User.find({ isActive: true });
    console.log(`📊 Found ${users.length} active users to migrate`);

    let totalWorkspacesCreated = 0;
    let totalRecordsMigrated = 0;

    for (const user of users) {
      console.log(`\n👤 Migrating user: ${user.email}`);
      
      // Check if user already has a workspace
      const existingWorkspace = await Workspace.findOne({ ownerId: user._id });
      let workspace;
      
      if (existingWorkspace) {
        console.log(`  ✓ User already has workspace: ${existingWorkspace.name}`);
        workspace = existingWorkspace;
      } else {
        // Create default workspace for user
        const workspaceName = user.companyName || `${user.firstName}'s Workspace`;
        const slug = await generateUniqueSlug(workspaceName);
        
        workspace = await Workspace.create({
          name: workspaceName,
          slug: slug,
          ownerId: user._id,
          settings: {
            timezone: user.timezone || 'UTC',
            currency: 'USD',
            language: user.language || 'en'
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`  ✓ Created workspace: ${workspace.name} (${workspace.slug})`);
        totalWorkspacesCreated++;
      }

      // Check if workspace user relationship exists
      const existingWorkspaceUser = await WorkspaceUser.findOne({
        workspaceId: workspace._id,
        userId: user._id
      });

      if (!existingWorkspaceUser) {
        // Create workspace user relationship
        await WorkspaceUser.create({
          workspaceId: workspace._id,
          userId: user._id,
          role: 'OWNER',
          joinedAt: new Date(),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`  ✓ Created workspace user relationship`);
      }

      // Migrate user's data to the workspace
      let migratedCount = 0;

      // Migrate Store Connections
      const storeConnections = await StoreConnection.find({ userId: user._id });
      for (const connection of storeConnections) {
        if (!connection.workspaceId) {
          await StoreConnection.updateOne(
            { _id: connection._id },
            { workspaceId: workspace._id }
          );
          migratedCount++;
        }
      }
      console.log(`  ✓ Migrated ${storeConnections.length} store connections`);

      // Migrate Products
      const products = await Product.find({ userId: user._id });
      for (const product of products) {
        if (!product.workspaceId) {
          await Product.updateOne(
            { _id: product._id },
            { workspaceId: workspace._id }
          );
          migratedCount++;
        }
      }
      console.log(`  ✓ Migrated ${products.length} products`);

      // Migrate Subscriptions
      const subscriptions = await Subscription.find({ userId: user._id });
      for (const subscription of subscriptions) {
        if (!subscription.workspaceId) {
          await Subscription.updateOne(
            { _id: subscription._id },
            { workspaceId: workspace._id }
          );
          migratedCount++;
        }
      }
      console.log(`  ✓ Migrated ${subscriptions.length} subscriptions`);

      // Migrate Usage records
      const usageRecords = await Usage.find({ userId: user._id });
      for (const usage of usageRecords) {
        if (!usage.workspaceId) {
          await Usage.updateOne(
            { _id: usage._id },
            { workspaceId: workspace._id }
          );
          migratedCount++;
        }
      }
      console.log(`  ✓ Migrated ${usageRecords.length} usage records`);

      // Migrate Opportunities
      const opportunities = await Opportunity.find({ userId: user._id });
      for (const opportunity of opportunities) {
        if (!opportunity.workspaceId) {
          await Opportunity.updateOne(
            { _id: opportunity._id },
            { workspaceId: workspace._id }
          );
          migratedCount++;
        }
      }
      console.log(`  ✓ Migrated ${opportunities.length} opportunities`);

      // Migrate Suggestions
      const suggestions = await Suggestion.find({ userId: user._id });
      for (const suggestion of suggestions) {
        if (!suggestion.workspaceId) {
          await Suggestion.updateOne(
            { _id: suggestion._id },
            { workspaceId: workspace._id }
          );
          migratedCount++;
        }
      }
      console.log(`  ✓ Migrated ${suggestions.length} suggestions`);

      totalRecordsMigrated += migratedCount;
      console.log(`  📊 Total records migrated for user: ${migratedCount}`);
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Workspaces created: ${totalWorkspacesCreated}`);
    console.log(`   - Total records migrated: ${totalRecordsMigrated}`);
    console.log(`   - Users processed: ${users.length}`);

    console.log('\n⚠️  Post-migration steps:');
    console.log('1. Update your application to use workspace context');
    console.log('2. Test all functionality with workspace isolation');
    console.log('3. Once verified, you can remove userId fields from models');
    console.log('4. Update API endpoints to require workspace context');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateToWorkspaces()
    .then(() => {
      console.log('🏁 Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToWorkspaces };