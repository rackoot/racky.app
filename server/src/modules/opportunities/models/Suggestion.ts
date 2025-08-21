import mongoose, { Document, Model, Schema, Types } from 'mongoose';

// Types for platform
export type SuggestionPlatform = 'shopify' | 'amazon' | 'vtex' | 'mercadolibre' | 'facebook_shop' | 'google_shopping' | 'woocommerce';

// Types for suggestion type
export type SuggestionType = 'description' | 'title' | 'tags' | 'pricing' | 'opportunity';

// Types for suggestion status
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';

// Types for opportunity category
export type OpportunityCategory = 'pricing' | 'inventory' | 'marketing' | 'expansion' | 'seo' | 'content';

// Types for priority and effort
export type Priority = 'high' | 'medium' | 'low';
export type Effort = 'low' | 'medium' | 'high';

// Types for estimated impact
export type EstimatedImpact = 'low' | 'medium' | 'high';

// Interface for suggestion metadata
export interface ISuggestionMetadata {
  model: string;
  tokens: number;
  confidence: number;
  keywords: string[];
  prompt?: string;
}

// Interface for opportunity data
export interface IOpportunityData {
  category?: OpportunityCategory;
  priority: Priority;
  impact?: string;
  effort: Effort;
}

// Interface for Suggestion document
export interface ISuggestion extends Document {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  platform: SuggestionPlatform;
  type: SuggestionType;
  title: string;
  description: string;
  originalContent: string;
  suggestedContent: string;
  status: SuggestionStatus;
  metadata: ISuggestionMetadata;
  // For opportunity suggestions
  opportunityData: IOpportunityData;
  // Legacy fields for backward compatibility
  currentValue?: any;
  suggestedValue?: any;
  confidence: number;
  estimatedImpact?: EstimatedImpact;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Interface for Suggestion model with static methods
export interface ISuggestionModel extends Model<ISuggestion> {
  findLatestSuggestion(userId: Types.ObjectId, productId: Types.ObjectId, platform: SuggestionPlatform, type: SuggestionType): Promise<ISuggestion | null>;
  getSuggestionHistory(userId: Types.ObjectId, productId: Types.ObjectId, platform?: SuggestionPlatform | null, type?: SuggestionType | null): Promise<ISuggestion[]>;
}

const suggestionSchema = new Schema<ISuggestion>({
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
  platform: {
    type: String,
    enum: ['shopify', 'amazon', 'vtex', 'mercadolibre', 'facebook_shop', 'google_shopping', 'woocommerce'],
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['description', 'title', 'tags', 'pricing', 'opportunity']
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  originalContent: {
    type: String,
    required: true
  },
  suggestedContent: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  metadata: {
    model: {
      type: String,
      default: 'gpt-3.5-turbo'
    },
    tokens: {
      type: Number,
      default: 0
    },
    confidence: {
      type: Number,
      default: 0.85
    },
    keywords: [String],
    prompt: String
  },
  // For opportunity suggestions
  opportunityData: {
    category: {
      type: String,
      enum: ['pricing', 'inventory', 'marketing', 'expansion', 'seo', 'content']
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    impact: String,
    effort: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  },
  // Legacy fields for backward compatibility
  currentValue: {
    type: Schema.Types.Mixed
  },
  suggestedValue: {
    type: Schema.Types.Mixed
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  estimatedImpact: {
    type: String,
    enum: ['low', 'medium', 'high']
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
suggestionSchema.index({ userId: 1, productId: 1, platform: 1, type: 1 });
suggestionSchema.index({ userId: 1, productId: 1, status: 1 });
suggestionSchema.index({ userId: 1, productId: 1, createdAt: -1 });

// Static method to find latest suggestion for a product/platform/type
suggestionSchema.statics.findLatestSuggestion = function(this: ISuggestionModel, userId: Types.ObjectId, productId: Types.ObjectId, platform: SuggestionPlatform, type: SuggestionType): Promise<ISuggestion | null> {
  return this.findOne({
    userId,
    productId,
    platform,
    type
  }).sort({ createdAt: -1 });
};

// Static method to find suggestion history
suggestionSchema.statics.getSuggestionHistory = function(this: ISuggestionModel, userId: Types.ObjectId, productId: Types.ObjectId, platform: SuggestionPlatform | null = null, type: SuggestionType | null = null): Promise<ISuggestion[]> {
  const query: any = { userId, productId };
  if (platform) query.platform = platform;
  if (type) query.type = type;
  
  return this.find(query).sort({ createdAt: -1 }).limit(50);
};

export default mongoose.model<ISuggestion, ISuggestionModel>('Suggestion', suggestionSchema);