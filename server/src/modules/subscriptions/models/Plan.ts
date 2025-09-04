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
  displayName: string;
  description: string;
  // Contributor-based model
  contributorType: 'JUNIOR' | 'SENIOR' | 'EXECUTIVE';
  actionsPerContributor: number; // Actions per month per contributor
  maxContributorsPerWorkspace: number; // Max contributors allowed per workspace
  isContactSalesOnly: boolean; // True for Executive plan
  // Pricing (per contributor)
  monthlyPrice: number; // Price in cents PER CONTRIBUTOR
  currency: string;
  // Stripe integration
  stripeMonthlyPriceId: string;
  // Plan limits (legacy, will be computed based on contributor count)
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
  hasFeature(featureName: string): boolean;
  // Contributor-based methods
  getTotalMonthlyPrice(contributorCount: number): number;
  getTotalActionsPerMonth(contributorCount: number): number;
  getContributorIcon(): string;
}

// Interface for Plan model with static methods
export interface IPlanModel extends Model<IPlan> {
  findPublicPlans(): Promise<IPlan[]>;
  findByContributorType(contributorType: string): Promise<IPlan | null>;
}

const planSchema = new Schema<IPlan>({
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  // Contributor-based fields
  contributorType: {
    type: String,
    required: false,
    enum: ['JUNIOR', 'SENIOR', 'EXECUTIVE', 'junior', 'senior', 'executive']
  },
  actionsPerContributor: {
    type: Number,
    required: true,
    min: 0
  },
  maxContributorsPerWorkspace: {
    type: Number,
    required: true,
    min: 1,
    max: 50 // Reasonable upper limit
  },
  isContactSalesOnly: {
    type: Boolean,
    default: false
  },
  // Pricing
  monthlyPrice: {
    type: Number,
    required: true // Price in cents
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

planSchema.methods.hasFeature = function(this: IPlan, featureName: string): boolean {
  return this.features.some(feature => 
    feature.name === featureName && feature.enabled
  );
};

// Contributor-based methods
planSchema.methods.getTotalMonthlyPrice = function(this: IPlan, contributorCount: number): number {
  return this.monthlyPrice * contributorCount;
};

planSchema.methods.getTotalActionsPerMonth = function(this: IPlan, contributorCount: number): number {
  return this.actionsPerContributor * contributorCount;
};

planSchema.methods.getContributorIcon = function(this: IPlan): string {
  switch (this.contributorType) {
    case 'JUNIOR':
      return 'user-code';
    case 'SENIOR':
      return 'user-check';
    case 'EXECUTIVE':
      return 'crown';
    default:
      return 'user';
  }
};

// Statics
planSchema.statics.findPublicPlans = function(this: IPlanModel): Promise<IPlan[]> {
  return this.find({ 
    isActive: true, 
    isPublic: true 
  }).sort({ sortOrder: 1 });
};

planSchema.statics.findByContributorType = function(this: IPlanModel, contributorType: string): Promise<IPlan | null> {
  return this.findOne({ contributorType: contributorType.toUpperCase() });
};

// Indexes
planSchema.index({ contributorType: 1 }, { unique: true });
planSchema.index({ isActive: 1, isPublic: 1 });
planSchema.index({ sortOrder: 1 });

export default mongoose.model<IPlan, IPlanModel>('Plan', planSchema);