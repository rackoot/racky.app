require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Plan = require('../src/models/Plan');
const Subscription = require('../src/models/Subscription');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/racky');
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const migrateToSubscriptions = async () => {
  try {
    console.log('🚀 Starting migration to subscription-based system...');
    
    // 1. Ensure plans exist
    console.log('📋 Checking for existing plans...');
    const planCount = await Plan.countDocuments();
    if (planCount === 0) {
      console.log('📋 Creating default plans...');
      await Plan.create([
        {
          name: 'BASIC',
          displayName: 'Basic',
          description: 'Perfect for small businesses getting started',
          monthlyPrice: 2900, // $29.00
          yearlyPrice: 29000, // $290.00
          limits: {
            maxStores: 2,
            maxProducts: 1000,
            maxMarketplaces: 2,
            maxSyncFrequency: 24,
            apiCallsPerMonth: 5000
          },
          features: [
            { name: 'Store Connections', description: 'Connect up to 2 stores', enabled: true },
            { name: 'Product Management', description: 'Manage up to 1,000 products', enabled: true },
            { name: 'Basic Analytics', description: 'Essential performance metrics', enabled: true },
            { name: 'Email Support', description: 'Support via email', enabled: true },
            { name: 'AI Suggestions', description: 'AI-powered recommendations', enabled: false },
            { name: 'Advanced Analytics', description: 'Deep insights and reporting', enabled: false },
            { name: 'Priority Support', description: '24/7 priority support', enabled: false },
            { name: 'Custom Integrations', description: 'Build custom marketplace connections', enabled: false }
          ]
        },
        {
          name: 'PRO',
          displayName: 'Professional',
          description: 'Ideal for growing businesses with multiple channels',
          monthlyPrice: 7900, // $79.00
          yearlyPrice: 79000, // $790.00
          limits: {
            maxStores: 5,
            maxProducts: 10000,
            maxMarketplaces: 5,
            maxSyncFrequency: 12,
            apiCallsPerMonth: 25000
          },
          features: [
            { name: 'Store Connections', description: 'Connect up to 5 stores', enabled: true },
            { name: 'Product Management', description: 'Manage up to 10,000 products', enabled: true },
            { name: 'Advanced Analytics', description: 'Deep insights and reporting', enabled: true },
            { name: 'AI Suggestions', description: 'AI-powered recommendations', enabled: true },
            { name: 'Priority Support', description: 'Priority email and chat support', enabled: true },
            { name: 'Bulk Operations', description: 'Mass product updates', enabled: true },
            { name: 'Custom Integrations', description: 'Build custom marketplace connections', enabled: false },
            { name: 'Dedicated Manager', description: 'Personal account manager', enabled: false }
          ]
        },
        {
          name: 'ENTERPRISE',
          displayName: 'Enterprise',
          description: 'Comprehensive solution for large-scale operations',
          monthlyPrice: 19900, // $199.00
          yearlyPrice: 199000, // $1990.00
          limits: {
            maxStores: 20,
            maxProducts: 100000,
            maxMarketplaces: 10,
            maxSyncFrequency: 1,
            apiCallsPerMonth: 100000
          },
          features: [
            { name: 'Store Connections', description: 'Connect up to 20 stores', enabled: true },
            { name: 'Product Management', description: 'Manage up to 100,000 products', enabled: true },
            { name: 'Advanced Analytics', description: 'Deep insights and reporting', enabled: true },
            { name: 'AI Suggestions', description: 'AI-powered recommendations', enabled: true },
            { name: 'Priority Support', description: '24/7 priority support', enabled: true },
            { name: 'Bulk Operations', description: 'Mass product updates', enabled: true },
            { name: 'Custom Integrations', description: 'Build custom marketplace connections', enabled: true },
            { name: 'Dedicated Manager', description: 'Personal account manager', enabled: true }
          ]
        }
      ]);
      console.log('✅ Plans created successfully');
    } else {
      console.log('✅ Plans already exist');
    }
    
    // 2. Find all users with old subscription fields
    console.log('👥 Finding users to migrate...');
    const usersToMigrate = await User.find({
      $or: [
        { subscriptionStatus: { $exists: true } },
        { subscriptionPlan: { $exists: true } },
        { trialEndsAt: { $exists: true } }
      ]
    });
    
    console.log(`📊 Found ${usersToMigrate.length} users to migrate`);
    
    // 3. Remove all existing subscriptions to start fresh
    console.log('🗑️ Clearing existing subscriptions...');
    await Subscription.deleteMany({});
    
    // 4. Process each user
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const user of usersToMigrate) {
      try {
        console.log(`🔄 Processing user: ${user.email}`);
        
        // Skip creating subscriptions - users must pay to get access
        // This implements the "no free trials" requirement
        console.log(`⏭️ Skipping subscription creation for ${user.email} - must purchase to access`);
        
        // Clean up the user document by removing old fields
        const updateData = {
          $unset: {
            subscriptionStatus: '',
            subscriptionPlan: '',
            trialEndsAt: '',
            subscriptionEndsAt: '',
            maxStores: '',
            maxProducts: '',
            lastTrialWarningAt: '',
            trialExpiredNotificationSent: '',
            trialExpiredAt: '',
            suspensionNotificationSent: '',
            subscriptionSuspendedAt: '',
            cancellationNotificationSent: '',
            subscriptionCancelledAt: ''
          }
        };
        
        await User.findByIdAndUpdate(user._id, updateData);
        skippedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing user ${user.email}:`, error.message);
      }
    }
    
    console.log(`✅ Migration completed!`);
    console.log(`📊 Summary:`);
    console.log(`   - Users processed: ${usersToMigrate.length}`);
    console.log(`   - Subscriptions created: ${migratedCount}`);
    console.log(`   - Users cleaned (no subscription): ${skippedCount}`);
    console.log(`   - Note: All users must now purchase subscriptions to access the platform`);
    
    // 5. Verify admin@example.com has no subscription
    const adminUser = await User.findOne({ email: 'admin@example.com' });
    if (adminUser) {
      const adminSubscription = await Subscription.findOne({ userId: adminUser._id });
      if (!adminSubscription) {
        console.log(`✅ Confirmed: admin@example.com has no active subscription`);
      } else {
        console.log(`⚠️ Warning: admin@example.com still has a subscription`);
      }
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await migrateToSubscriptions();
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
};

// Run the migration
main();