import mongoose, { Document, Model, Schema } from 'mongoose';

// Interface for OpportunityCategory document
export interface IOpportunityCategory extends Document {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isMarketplace: boolean;
  isActive: boolean;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Interface for OpportunityCategory model with static methods
export interface IOpportunityCategoryModel extends Model<IOpportunityCategory> {
  initializeDefaultCategories(): Promise<void>;
  getActiveCategories(): Promise<IOpportunityCategory[]>;
  getGeneralCategories(): Promise<IOpportunityCategory[]>;
  getMarketplaceCategories(): Promise<IOpportunityCategory[]>;
}

const opportunityCategorySchema = new Schema<IOpportunityCategory>({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true
  },
  isMarketplace: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Static method to initialize default categories
opportunityCategorySchema.statics.initializeDefaultCategories = async function(this: IOpportunityCategoryModel): Promise<void> {
  const { OPPORTUNITY_CATEGORIES, getMarketplaceCategories } = await import('@/common/constants/marketplaces');
  
  try {
    const existingCount = await this.countDocuments();
    
    // Only initialize if no categories exist
    if (existingCount === 0) {
      // Insert general categories
      await this.insertMany(OPPORTUNITY_CATEGORIES);
      
      // Insert marketplace categories
      const marketplaceCategories = getMarketplaceCategories();
      await this.insertMany(marketplaceCategories);
      
      console.log('Initialized default opportunity categories');
    }
  } catch (error) {
    console.error('Error initializing opportunity categories:', error);
  }
};

// Static method to get all active categories
opportunityCategorySchema.statics.getActiveCategories = function(this: IOpportunityCategoryModel): Promise<IOpportunityCategory[]> {
  return this.find({ isActive: true }).sort({ isMarketplace: 1, name: 1 });
};

// Static method to get general categories only
opportunityCategorySchema.statics.getGeneralCategories = function(this: IOpportunityCategoryModel): Promise<IOpportunityCategory[]> {
  return this.find({ isActive: true, isMarketplace: false }).sort({ name: 1 });
};

// Static method to get marketplace categories only
opportunityCategorySchema.statics.getMarketplaceCategories = function(this: IOpportunityCategoryModel): Promise<IOpportunityCategory[]> {
  return this.find({ isActive: true, isMarketplace: true }).sort({ name: 1 });
};

export default mongoose.model<IOpportunityCategory, IOpportunityCategoryModel>('OpportunityCategory', opportunityCategorySchema);