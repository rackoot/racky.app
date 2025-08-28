require('dotenv').config();
const mongoose = require('mongoose');

// Definir el esquema del Plan directamente
const { Schema } = mongoose;

const planSchema = new Schema({
  name: {
    type: String,
    required: true,
    enum: ['BASIC', 'PRO', 'ENTERPRISE']
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  contributorType: {
    type: String,
    required: true,
    enum: ['JUNIOR', 'SENIOR', 'EXECUTIVE']
  },
  actionsPerContributor: {
    type: Number,
    required: true,
    min: -1
  },
  maxContributorsPerWorkspace: {
    type: Number,
    required: true,
    min: 1,
    max: 50
  },
  isContactSalesOnly: {
    type: Boolean,
    default: false
  },
  monthlyPrice: {
    type: Number,
    required: true
  },
  yearlyPrice: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'usd'
  },
  stripeMonthlyPriceId: {
    type: String,
    required: true
  },
  stripeYearlyPriceId: {
    type: String,
    required: true
  },
  limits: {
    maxStores: { type: Number, required: true },
    maxProducts: { type: Number, required: true },
    maxMarketplaces: { type: Number, required: true },
    maxSyncFrequency: { type: Number, required: true },
    apiCallsPerMonth: { type: Number, required: true }
  },
  features: [{
    name: { type: String, required: true },
    description: { type: String },
    enabled: { type: Boolean, default: true }
  }],
  isActive: { type: Boolean, default: true },
  isPublic: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  trialDays: { type: Number, default: 14 }
}, {
  timestamps: true
});

const createPlans = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB');

    // Crear el modelo Plan
    const Plan = mongoose.model('Plan', planSchema);

    console.log('🤖 Creating contributor plans...');
    
    const contributorPlans = [
      {
        name: 'BASIC',
        displayName: 'Junior Contributor',
        description: 'Perfect for small teams getting started with marketplace automation',
        contributorType: 'JUNIOR',
        actionsPerContributor: 1000,
        maxContributorsPerWorkspace: 5,
        isContactSalesOnly: false,
        monthlyPrice: 5000, // $50.00 per contributor
        yearlyPrice: 50000, // $500.00 per contributor (save 17%)
        stripeMonthlyPriceId: 'price_1RoS28C0dRh4ObHWOlCINkwn',
        stripeYearlyPriceId: 'price_1S0i9AC0dRh4ObHW05zDSbp8',
        limits: {
          maxStores: 2,
          maxProducts: 1000,
          maxMarketplaces: 2,
          maxSyncFrequency: 24,
          apiCallsPerMonth: 5000
        },
        features: [
          { name: 'Basic Operations', description: 'Essential marketplace tasks and product sync', enabled: true },
          { name: 'Email Support', description: 'Email support with 48-hour response time', enabled: true },
          { name: '1K Actions/Contributor', description: 'Up to 1,000 actions per contributor monthly', enabled: true },
          { name: 'Basic Analytics', description: 'Essential performance metrics', enabled: true },
          { name: 'Product Management', description: 'Create, update, and sync products', enabled: true }
        ],
        sortOrder: 1,
        trialDays: 14
      },
      {
        name: 'PRO',
        displayName: 'Senior Contributor',
        description: 'Advanced contributors with AI assistance for growing businesses',
        contributorType: 'SENIOR',
        actionsPerContributor: 5000,
        maxContributorsPerWorkspace: 5,
        isContactSalesOnly: false,
        monthlyPrice: 10000, // $100.00 per contributor
        yearlyPrice: 100000, // $1,000.00 per contributor (save 17%) 
        stripeMonthlyPriceId: 'price_1RoS2UC0dRh4ObHWIVQporSy',
        stripeYearlyPriceId: 'price_1S0i8aC0dRh4ObHWZ8M2BufQ',
        limits: {
          maxStores: 5,
          maxProducts: 10000,
          maxMarketplaces: 5,
          maxSyncFrequency: 12,
          apiCallsPerMonth: 25000
        },
        features: [
          { name: 'Advanced Operations', description: 'Complex automation and bulk operations', enabled: true },
          { name: 'AI-Powered Insights', description: 'Smart suggestions and optimization recommendations', enabled: true },
          { name: 'Priority Support', description: 'Priority email and chat support', enabled: true },
          { name: '5K Actions/Contributor', description: 'Up to 5,000 actions per contributor monthly', enabled: true },
          { name: 'Advanced Analytics', description: 'Detailed performance metrics and reporting', enabled: true },
          { name: 'Bulk Operations', description: 'Mass updates across multiple marketplaces', enabled: true }
        ],
        sortOrder: 2,
        trialDays: 14
      },
      {
        name: 'ENTERPRISE',
        displayName: 'Executive Contributor',
        description: 'Premium contributors with unlimited capabilities and dedicated support',
        contributorType: 'EXECUTIVE',
        actionsPerContributor: -1, // Unlimited actions
        maxContributorsPerWorkspace: 50,
        isContactSalesOnly: true,
        monthlyPrice: 19900, // $199.00 per contributor (contact for pricing)
        yearlyPrice: 199000, // $1,990.00 per contributor (contact for pricing)
        stripeMonthlyPriceId: 'price_executive_monthly',
        stripeYearlyPriceId: 'price_executive_yearly',
        limits: {
          maxStores: 50,
          maxProducts: 100000,
          maxMarketplaces: 10,
          maxSyncFrequency: 1,
          apiCallsPerMonth: 100000
        },
        features: [
          { name: 'Unlimited Operations', description: 'No limits on actions or complexity', enabled: true },
          { name: 'Custom AI Models', description: 'Tailored AI solutions for your business', enabled: true },
          { name: 'Dedicated Support', description: '24/7 dedicated account manager', enabled: true },
          { name: 'Unlimited Actions', description: 'No monthly action limits', enabled: true },
          { name: 'Custom Integrations', description: 'Bespoke marketplace and tool integrations', enabled: true },
          { name: 'White-label Solution', description: 'Branded interface and API access', enabled: true },
          { name: 'SLA Guarantee', description: '99.9% uptime with guaranteed response times', enabled: true }
        ],
        sortOrder: 3,
        trialDays: 30
      }
    ];

    let created = 0;
    let updated = 0;

    for (const planData of contributorPlans) {
      const existingPlan = await Plan.findOne({ name: planData.name });
      
      if (existingPlan) {
        Object.assign(existingPlan, planData);
        await existingPlan.save();
        console.log(`✅ Updated: ${planData.displayName} ($${(planData.monthlyPrice / 100).toFixed(0)}/month)`);
        updated++;
      } else {
        await Plan.create(planData);
        console.log(`✅ Created: ${planData.displayName} ($${(planData.monthlyPrice / 100).toFixed(0)}/month)`);
        created++;
      }
    }

    await mongoose.disconnect();
    console.log(`✅ Plans setup complete! Created: ${created}, Updated: ${updated}`);
  } catch (error) {
    console.error('❌ Error creating plans:', error);
    process.exit(1);
  }
};

// Solo ejecutar si es llamado directamente
if (require.main === module) {
  createPlans();
}

module.exports = createPlans;