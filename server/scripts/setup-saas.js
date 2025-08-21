require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Plan = require('../src/models/Plan');

const setupSaaS = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create or update super admin user
    console.log('\n=== Setting up Super Admin ===');
    const existingSuperAdmin = await User.findOne({ email: 'admin@racky.app' });
    
    if (existingSuperAdmin) {
      // Update existing user to super admin
      existingSuperAdmin.role = 'SUPERADMIN';
      existingSuperAdmin.subscriptionStatus = 'ACTIVE';
      existingSuperAdmin.isActive = true;
      await existingSuperAdmin.save();
      console.log('✓ Updated existing user to SUPERADMIN role');
    } else {
      // Create new super admin
      const superAdmin = await User.create({
        email: 'admin@racky.app',
        password: 'admin123!',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPERADMIN',
        subscriptionStatus: 'ACTIVE',
        subscriptionPlan: 'ENTERPRISE'
      });
      console.log('✓ Created new SUPERADMIN user');
      console.log(`  Email: ${superAdmin.email}`);
      console.log(`  Password: admin123!`);
    }

    // Create subscription plans
    console.log('\n=== Setting up Subscription Plans ===');
    
    const plans = [
      {
        name: 'BASIC',
        displayName: 'Basic Plan',
        description: 'Perfect for small businesses getting started with marketplace management',
        monthlyPrice: 2900, // $29.00
        yearlyPrice: 29000, // $290.00 (save 17%)
        stripeMonthlyPriceId: 'price_basic_monthly', // Replace with actual Stripe price IDs
        stripeYearlyPriceId: 'price_basic_yearly',
        limits: {
          maxStores: 1,
          maxProducts: 100,
          maxMarketplaces: 2,
          maxSyncFrequency: 24, // hours
          apiCallsPerMonth: 1000
        },
        features: [
          { name: 'Basic Analytics', description: 'View basic product and sales analytics' },
          { name: 'Product Sync', description: 'Sync products between marketplaces' },
          { name: 'Email Support', description: 'Email support with 48-hour response time' },
          { name: '1 Store Connection', description: 'Connect up to 1 store' }
        ],
        sortOrder: 1,
        trialDays: 14
      },
      {
        name: 'PRO',
        displayName: 'Pro Plan',
        description: 'Ideal for growing businesses with multiple marketplaces',
        monthlyPrice: 7900, // $79.00
        yearlyPrice: 79000, // $790.00 (save 17%)
        stripeMonthlyPriceId: 'price_pro_monthly',
        stripeYearlyPriceId: 'price_pro_yearly',
        limits: {
          maxStores: 5,
          maxProducts: 1000,
          maxMarketplaces: 5,
          maxSyncFrequency: 6, // hours
          apiCallsPerMonth: 10000
        },
        features: [
          { name: 'Advanced Analytics', description: 'Detailed analytics and reporting' },
          { name: 'AI Suggestions', description: 'AI-powered product optimization suggestions' },
          { name: 'Bulk Operations', description: 'Bulk edit products across marketplaces' },
          { name: 'Priority Support', description: 'Priority email and chat support' },
          { name: '5 Store Connections', description: 'Connect up to 5 stores' },
          { name: 'Custom Integrations', description: 'Access to custom marketplace integrations' }
        ],
        sortOrder: 2,
        trialDays: 14
      },
      {
        name: 'ENTERPRISE',
        displayName: 'Enterprise Plan',
        description: 'For large businesses with complex marketplace operations',
        monthlyPrice: 19900, // $199.00
        yearlyPrice: 199000, // $1,990.00 (save 17%)
        stripeMonthlyPriceId: 'price_enterprise_monthly',
        stripeYearlyPriceId: 'price_enterprise_yearly',
        limits: {
          maxStores: 50,
          maxProducts: 10000,
          maxMarketplaces: 10,
          maxSyncFrequency: 1, // hours
          apiCallsPerMonth: 100000
        },
        features: [
          { name: 'Enterprise Analytics', description: 'Advanced analytics with custom dashboards' },
          { name: 'White-label Solution', description: 'Branded interface for your business' },
          { name: 'Dedicated Support', description: 'Dedicated account manager and phone support' },
          { name: 'Custom Workflows', description: 'Custom automation workflows' },
          { name: 'Unlimited Stores', description: 'Connect unlimited stores (up to 50)' },
          { name: 'API Access', description: 'Full API access for custom integrations' },
          { name: 'SLA Guarantee', description: '99.9% uptime guarantee with SLA' }
        ],
        sortOrder: 3,
        trialDays: 30
      }
    ];

    for (const planData of plans) {
      const existingPlan = await Plan.findOne({ name: planData.name });
      
      if (existingPlan) {
        // Update existing plan
        Object.assign(existingPlan, planData);
        await existingPlan.save();
        console.log(`✓ Updated ${planData.name} plan`);
      } else {
        // Create new plan
        await Plan.create(planData);
        console.log(`✓ Created ${planData.name} plan`);
      }
    }

    console.log('\n=== SaaS Setup Complete ===');
    console.log('🎉 Your Racky platform is now ready for multi-tenant operation!');
    console.log('\nNext steps:');
    console.log('1. Update Stripe price IDs in the Plan documents');
    console.log('2. Configure Stripe webhooks for subscription management');
    console.log('3. Test the super admin login: admin@racky.app / admin123!');
    console.log('4. Access admin panel at: http://localhost:5173/admin');

    process.exit(0);
  } catch (error) {
    console.error('Error setting up SaaS:', error);
    process.exit(1);
  }
};

setupSaaS();