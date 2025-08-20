const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
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
  // Pricing
  monthlyPrice: {
    type: Number,
    required: true // Price in cents
  },
  yearlyPrice: {
    type: Number,
    required: true // Price in cents (usually discounted)
  },
  currency: {
    type: String,
    default: 'usd'
  },
  // Stripe integration
  stripeMonthlyPriceId: {
    type: String,
    required: true
  },
  stripeYearlyPriceId: {
    type: String,
    required: true
  },
  // Plan limits
  limits: {
    maxStores: {
      type: Number,
      required: true
    },
    maxProducts: {
      type: Number,
      required: true
    },
    maxMarketplaces: {
      type: Number,
      required: true
    },
    maxSyncFrequency: {
      type: Number, // In hours
      required: true
    },
    apiCallsPerMonth: {
      type: Number,
      required: true
    }
  },
  // Features
  features: [{
    name: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    enabled: {
      type: Boolean,
      default: true
    }
  }],
  // Plan settings
  isActive: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true // Whether this plan is visible to new customers
  },
  sortOrder: {
    type: Number,
    default: 0 // For displaying plans in order
  },
  // Trial settings
  trialDays: {
    type: Number,
    default: 14
  }
}, {
  timestamps: true
});

// Methods
planSchema.methods.getMonthlyPriceFormatted = function() {
  return (this.monthlyPrice / 100).toFixed(2);
};

planSchema.methods.getYearlyPriceFormatted = function() {
  return (this.yearlyPrice / 100).toFixed(2);
};

planSchema.methods.getYearlySavings = function() {
  const monthlyTotal = this.monthlyPrice * 12;
  const savings = monthlyTotal - this.yearlyPrice;
  return Math.round((savings / monthlyTotal) * 100);
};

planSchema.methods.hasFeature = function(featureName) {
  return this.features.some(feature => 
    feature.name === featureName && feature.enabled
  );
};

// Statics
planSchema.statics.findPublicPlans = function() {
  return this.find({ 
    isActive: true, 
    isPublic: true 
  }).sort({ sortOrder: 1 });
};

planSchema.statics.findByName = function(name) {
  return this.findOne({ name: name.toUpperCase() });
};

// Indexes
planSchema.index({ name: 1 }, { unique: true });
planSchema.index({ isActive: 1, isPublic: 1 });
planSchema.index({ sortOrder: 1 });

module.exports = mongoose.model('Plan', planSchema);