import mongoose, { Document, Model, Schema, Types } from 'mongoose';

// Types for opportunity category
export type OpportunityCategory = 'pricing' | 'description' | 'images' | 'seo' | 'inventory' | 'marketing' | 'unconnected_marketplaces' | 'shopify' | 'vtex' | 'mercadolibre' | 'amazon' | 'facebook_shop' | 'google_shopping' | 'woocommerce';

// Types for marketplace
export type MarketplaceType = 'shopify' | 'vtex' | 'mercadolibre' | 'amazon' | 'facebook_shop' | 'google_shopping' | 'woocommerce';

// Types for priority
export type OpportunityPriority = 'low' | 'medium' | 'high' | 'critical';

// Types for status
export type OpportunityStatus = 'open' | 'in_progress' | 'completed' | 'dismissed';

// Types for legacy type field
export type OpportunityType = 'price_optimization' | 'inventory_alert' | 'competitor_analysis' | 'market_expansion';

// Interface for potential impact
export interface IPotentialImpact {
  revenue: number;
  percentage: number;
}

// Interface for AI metadata
export interface IAIMetadata {
  model: string;
  prompt?: string;
  tokens?: number;
  confidence?: number;
}

// Interface for Opportunity document
export interface IOpportunity extends Document {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  category: OpportunityCategory;
  marketplace?: MarketplaceType | null;
  title: string;
  description: string;
  priority: OpportunityPriority;
  status: OpportunityStatus;
  potentialImpact: IPotentialImpact;
  actionRequired?: string;
  dueDate?: Date;
  // Caching fields
  cachedAt: Date;
  expiresAt: Date;
  // AI metadata
  aiMetadata: IAIMetadata;
  // Legacy type field for backward compatibility
  type?: OpportunityType;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  isExpired(): boolean;
  extendExpiration(hours?: number): Promise<IOpportunity>;
}

// Interface for Opportunity model with static methods
export interface IOpportunityModel extends Model<IOpportunity> {
  findValidForProduct(userId: Types.ObjectId, productId: Types.ObjectId): Promise<IOpportunity[]>;
  findByCategory(userId: Types.ObjectId, productId: Types.ObjectId, category: OpportunityCategory): Promise<IOpportunity[]>;
  cleanupExpired(): Promise<any>;
}

const opportunitySchema = new Schema<IOpportunity>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['pricing', 'description', 'images', 'seo', 'inventory', 'marketing', 'unconnected_marketplaces', 'shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce']
  },
  marketplace: {
    type: String,
    enum: ['shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce'],
    default: null
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'completed', 'dismissed'],
    default: 'open'
  },
  potentialImpact: {
    revenue: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    }
  },
  actionRequired: {
    type: String
  },
  dueDate: {
    type: Date
  },
  // Caching fields
  cachedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
  },
  // AI metadata
  aiMetadata: {
    model: {
      type: String,
      default: 'gpt-3.5-turbo'
    },
    prompt: String,
    tokens: Number,
    confidence: {
      type: Number,
      min: 0,
      max: 1
    }
  },
  // Legacy type field for backward compatibility
  type: {
    type: String,
    enum: ['price_optimization', 'inventory_alert', 'competitor_analysis', 'market_expansion']
  }
}, {
  timestamps: true
});

// Index for efficient queries
opportunitySchema.index({ productId: 1, userId: 1, category: 1 });
opportunitySchema.index({ userId: 1, status: 1 });
opportunitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to find valid (non-expired) opportunities for a product
opportunitySchema.statics.findValidForProduct = function(this: IOpportunityModel, userId: Types.ObjectId, productId: Types.ObjectId): Promise<IOpportunity[]> {
  return this.find({
    userId,
    productId,
    expiresAt: { $gt: new Date() },
    status: { $ne: 'dismissed' }
  }).sort({ priority: 1, createdAt: -1 });
};

// Static method to find opportunities by category
opportunitySchema.statics.findByCategory = function(this: IOpportunityModel, userId: Types.ObjectId, productId: Types.ObjectId, category: OpportunityCategory): Promise<IOpportunity[]> {
  return this.find({
    userId,
    productId,
    category,
    expiresAt: { $gt: new Date() },
    status: { $ne: 'dismissed' }
  }).sort({ priority: 1, createdAt: -1 });
};

// Static method to clean up expired opportunities
opportunitySchema.statics.cleanupExpired = function(this: IOpportunityModel): Promise<any> {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

// Instance method to check if opportunity is expired
opportunitySchema.methods.isExpired = function(this: IOpportunity): boolean {
  return this.expiresAt < new Date();
};

// Instance method to extend expiration
opportunitySchema.methods.extendExpiration = function(this: IOpportunity, hours: number = 24): Promise<IOpportunity> {
  this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.save();
};

export default mongoose.model<IOpportunity, IOpportunityModel>('Opportunity', opportunitySchema);