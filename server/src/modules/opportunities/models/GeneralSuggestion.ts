import mongoose, { Document, Model, Schema, Types } from 'mongoose';

// Types for priority
export type GeneralSuggestionPriority = 'high' | 'medium' | 'low';

// Types for category
export type GeneralSuggestionCategory = 'marketing' | 'inventory' | 'pricing' | 'expansion';

// Interface for context data
export interface IGeneralSuggestionContext {
  connectedMarketplaces: string[];
  totalProducts?: number;
  productCategories: string[];
}

// Interface for GeneralSuggestion document
export interface IGeneralSuggestion extends Document {
  userId: Types.ObjectId;
  title: string;
  description: string;
  priority: GeneralSuggestionPriority;
  category: GeneralSuggestionCategory;
  impact: string;
  // Context that was used to generate this suggestion
  context: IGeneralSuggestionContext;
  // When this suggestion expires and should be refreshed
  expiresAt: Date;
  isActive: boolean;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Interface for GeneralSuggestion model with static methods
export interface IGeneralSuggestionModel extends Model<IGeneralSuggestion> {
  findValidSuggestions(userId: Types.ObjectId): Promise<IGeneralSuggestion[]>;
  deactivateExpired(): Promise<any>;
}

const generalSuggestionSchema = new Schema<IGeneralSuggestion>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    required: true
  },
  category: {
    type: String,
    enum: ['marketing', 'inventory', 'pricing', 'expansion'],
    required: true
  },
  impact: {
    type: String,
    required: true
  },
  // Context that was used to generate this suggestion
  context: {
    connectedMarketplaces: [String],
    totalProducts: Number,
    productCategories: [String]
  },
  // When this suggestion expires and should be refreshed
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
generalSuggestionSchema.index({ userId: 1, isActive: 1, expiresAt: 1 });

// Method to check if suggestions are expired
generalSuggestionSchema.statics.findValidSuggestions = function(this: IGeneralSuggestionModel, userId: Types.ObjectId): Promise<IGeneralSuggestion[]> {
  return this.find({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ priority: 1, createdAt: -1 });
};

// Method to deactivate expired suggestions
generalSuggestionSchema.statics.deactivateExpired = function(this: IGeneralSuggestionModel): Promise<any> {
  return this.updateMany(
    { expiresAt: { $lte: new Date() } },
    { isActive: false }
  );
};

export default mongoose.model<IGeneralSuggestion, IGeneralSuggestionModel>('GeneralSuggestion', generalSuggestionSchema);