import mongoose, { Document, Model, Schema } from 'mongoose';

// Interface for Plan feature
export interface IPlanFeature {
  name: string;
  description?: string;
  enabled: boolean;
}

// Interface for Plan limits
export interface IPlanLimits {
  maxStores: number;
  maxProducts: number;
  maxMarketplaces: number;
  maxSyncFrequency: number; // In hours
  apiCallsPerMonth: number;
}

// Interface for Plan document
export interface IPlan extends Document {
  name: 'BASIC' | 'PRO' | 'ENTERPRISE';
  displayName: string;
  description: string;
  // Pricing
  monthlyPrice: number; // Price in cents
  yearlyPrice: number; // Price in cents (usually discounted)
  currency: string;
  // Stripe integration
  stripeMonthlyPriceId: string;
  stripeYearlyPriceId: string;
  // Plan limits
  limits: IPlanLimits;
  // Features
  features: IPlanFeature[];
  // Plan settings
  isActive: boolean;
  isPublic: boolean; // Whether this plan is visible to new customers
  sortOrder: number; // For displaying plans in order
  // Trial settings
  trialDays: number;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  getMonthlyPriceFormatted(): string;
  getYearlyPriceFormatted(): string;
  getYearlySavings(): number;
  hasFeature(featureName: string): boolean;
}

// Interface for Plan model with static methods
export interface IPlanModel extends Model<IPlan> {
  findPublicPlans(): Promise<IPlan[]>;
  findByName(name: string): Promise<IPlan | null>;
}

const planSchema = new Schema<IPlan>({
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
planSchema.methods.getMonthlyPriceFormatted = function(this: IPlan): string {
  return (this.monthlyPrice / 100).toFixed(2);
};

planSchema.methods.getYearlyPriceFormatted = function(this: IPlan): string {
  return (this.yearlyPrice / 100).toFixed(2);
};

planSchema.methods.getYearlySavings = function(this: IPlan): number {
  const monthlyTotal = this.monthlyPrice * 12;
  const savings = monthlyTotal - this.yearlyPrice;
  return Math.round((savings / monthlyTotal) * 100);
};

planSchema.methods.hasFeature = function(this: IPlan, featureName: string): boolean {
  return this.features.some(feature => 
    feature.name === featureName && feature.enabled
  );
};

// Statics
planSchema.statics.findPublicPlans = function(this: IPlanModel): Promise<IPlan[]> {
  return this.find({ 
    isActive: true, 
    isPublic: true 
  }).sort({ sortOrder: 1 });
};

planSchema.statics.findByName = function(this: IPlanModel, name: string): Promise<IPlan | null> {
  return this.findOne({ name: name.toUpperCase() });
};

// Indexes
planSchema.index({ name: 1 }, { unique: true });
planSchema.index({ isActive: 1, isPublic: 1 });
planSchema.index({ sortOrder: 1 });

export default mongoose.model<IPlan, IPlanModel>('Plan', planSchema);