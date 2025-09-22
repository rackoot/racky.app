require("dotenv").config();
const mongoose = require("mongoose");

// Definir el esquema del Plan directamente
const { Schema } = mongoose;

const planSchema = new Schema(
  {
    displayName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    // Contributor-based fields
    contributorType: {
      type: String,
      required: false,
      enum: ["JUNIOR", "SENIOR", "EXECUTIVE", "junior", "senior", "executive"],
    },
    actionsPerContributor: {
      type: Number,
      required: true,
      min: 0,
    },
    maxContributorsPerWorkspace: {
      type: Number,
      required: true,
      min: 1,
      max: 50, // Reasonable upper limit
    },
    isContactSalesOnly: {
      type: Boolean,
      default: false,
    },
    // Pricing
    monthlyPrice: {
      type: Number,
      required: true, // Price in cents
    },
    currency: {
      type: String,
      default: "usd",
    },
    // Stripe integration
    stripeMonthlyPriceId: {
      type: String,
      required: true,
    },
    // Plan limits
    limits: {
      maxStores: {
        type: Number,
        required: true,
      },
      maxProducts: {
        type: Number,
        required: true,
      },
      maxMarketplaces: {
        type: Number,
        required: true,
      },
      maxSyncFrequency: {
        type: Number, // In hours
        required: true,
      },
      apiCallsPerMonth: {
        type: Number,
        required: true,
      },
    },
    // Features
    features: [
      {
        name: {
          type: String,
          required: true,
        },
        description: {
          type: String,
        },
        enabled: {
          type: Boolean,
          default: true,
        },
      },
    ],
    // Plan settings
    isActive: {
      type: Boolean,
      default: true,
    },
    isPublic: {
      type: Boolean,
      default: true, // Whether this plan is visible to new customers
    },
    sortOrder: {
      type: Number,
      default: 0, // For displaying plans in order
    },
    // Trial settings
    trialDays: {
      type: Number,
      default: 14,
    },
  },
  {
    timestamps: true,
  }
);

const createPlans = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("🔗 Connected to MongoDB");

    // Crear el modelo Plan
    const Plan = mongoose.model("Plan", planSchema);

    console.log("🤖 Creating contributor plans...");

    const contributorPlans = [
      {
        displayName: "Junior Contributor",
        description:
          "Perfect for small teams getting started with marketplace automation",
        contributorType: "JUNIOR",
        actionsPerContributor: 1000,
        maxContributorsPerWorkspace: 5,
        isContactSalesOnly: false,
        monthlyPrice: 9900, // $100.00 per contributor
        stripeMonthlyPriceId: "price_1SAGBHC0dRh4ObHWb6mez2Ed",
        limits: {
          maxStores: 2,
          maxProducts: 1000,
          maxMarketplaces: 2,
          maxSyncFrequency: 24,
          apiCallsPerMonth: 5000,
        },
        features: [
          {
            name: "Basic Operations",
            description: "Essential marketplace tasks and product sync",
            enabled: true,
          },
          {
            name: "Email Support",
            description: "Email support with 48-hour response time",
            enabled: true,
          },
          {
            name: "1K Actions/Contributor",
            description: "Up to 1,000 actions per contributor monthly",
            enabled: true,
          },
          {
            name: "Basic Analytics",
            description: "Essential performance metrics",
            enabled: true,
          },
          {
            name: "Product Management",
            description: "Create, update, and sync products",
            enabled: true,
          },
        ],
        sortOrder: 1,
        trialDays: 14,
      },
      {
        displayName: "Senior Contributor",
        description:
          "Advanced contributors with AI assistance for growing businesses",
        contributorType: "SENIOR",
        actionsPerContributor: 5000,
        maxContributorsPerWorkspace: 5,
        isContactSalesOnly: false,
        monthlyPrice: 19900, // $200.00 per contributor
        stripeMonthlyPriceId: "price_1SAGBoC0dRh4ObHWwNyiz4Ew",
        limits: {
          maxStores: 5,
          maxProducts: 10000,
          maxMarketplaces: 5,
          maxSyncFrequency: 12,
          apiCallsPerMonth: 25000,
        },
        features: [
          {
            name: "Advanced Operations",
            description: "Complex automation and bulk operations",
            enabled: true,
          },
          {
            name: "AI-Powered Insights",
            description: "Smart suggestions and optimization recommendations",
            enabled: true,
          },
          {
            name: "Priority Support",
            description: "Priority email and chat support",
            enabled: true,
          },
          {
            name: "5K Actions/Contributor",
            description: "Up to 5,000 actions per contributor monthly",
            enabled: true,
          },
          {
            name: "Advanced Analytics",
            description: "Detailed performance metrics and reporting",
            enabled: true,
          },
          {
            name: "Bulk Operations",
            description: "Mass updates across multiple marketplaces",
            enabled: true,
          },
        ],
        sortOrder: 2,
        trialDays: 14,
      },
    ];

    let created = 0;
    let updated = 0;

    for (const planData of contributorPlans) {
      const existingPlan = await Plan.findOne({
        contributorType: planData.contributorType,
      });

      if (existingPlan) {
        Object.assign(existingPlan, planData);
        await existingPlan.save();
        console.log(
          `✅ Updated: ${planData.displayName} ($${(
            planData.monthlyPrice / 100
          ).toFixed(0)}/month)`
        );
        updated++;
      } else {
        await Plan.create(planData);
        console.log(
          `✅ Created: ${planData.displayName} ($${(
            planData.monthlyPrice / 100
          ).toFixed(0)}/month)`
        );
        created++;
      }
    }

    await mongoose.disconnect();
    console.log(
      `✅ Plans setup complete! Created: ${created}, Updated: ${updated}`
    );
  } catch (error) {
    console.error("❌ Error creating plans:", error);
    process.exit(1);
  }
};

// Solo ejecutar si es llamado directamente
if (require.main === module) {
  createPlans();
}

module.exports = createPlans;
