import mongoose, { Document, Schema, Types } from 'mongoose';

// Type for platform types
export type PlatformType = 'shopify' | 'vtex' | 'woocommerce' | 'amazon' | 'mercadolibre' | 'facebook';

// Type for marketplace types (legacy)
export type MarketplaceType = 'shopify' | 'vtex' | 'mercadolibre' | 'amazon' | 'facebook_shop' | 'google_shopping' | 'woocommerce';

// Type for product status
export type ProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'active' | 'draft' | 'archived';

// Type for cached description platform
export type CachedDescriptionPlatform = 'shopify' | 'amazon' | 'mercadolibre' | 'woocommerce' | 'vtex' | 'facebook_shop' | 'google_shopping';

// Type for cached description status
export type CachedDescriptionStatus = 'pending' | 'accepted' | 'rejected';

// Type for video status
export type VideoStatus = 'pending' | 'completed' | 'failed';

// Interface for Product Video
export interface IProductVideo {
  templateId: string;
  templateName: string;
  status: VideoStatus;
  videoUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  _id?: Types.ObjectId;
}

// Interface for Product Image
export interface IProductImage {
  shopifyId?: string;
  url: string;
  altText?: string;
  _id?: Types.ObjectId;
}

// Interface for Product Variant
export interface IProductVariant {
  id?: string;
  shopifyId?: string;
  title: string;
  price: string;
  compareAtPrice?: string;
  sku?: string;
  barcode?: string;
  inventory: number;
  inventoryQuantity: number;
  weight?: number;
  weightUnit?: string;
  taxable: boolean;
  _id?: Types.ObjectId;
}

// Interface for Product Platform
export interface IProductPlatform {
  platform: PlatformType;
  platformId: string;
  platformSku?: string;
  platformPrice?: number;
  platformInventory?: number;
  platformStatus?: string;
  lastSyncAt?: Date;
}

// Interface for Cached Description
export interface ICachedDescription {
  platform: CachedDescriptionPlatform;
  content: string;
  confidence?: number;
  keywords: string[];
  tokens?: number;
  createdAt: Date;
  status: CachedDescriptionStatus;
}

// Interface for Product document
export interface IProduct extends Document {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId; // Keep for backward compatibility during migration
  storeConnectionId: Types.ObjectId;
  title: string;
  description?: string;
  price?: number;
  compareAtPrice?: number;
  sku?: string;
  barcode?: string;
  inventory: number;
  vendor?: string;
  productType?: string;
  tags: string[];
  images: IProductImage[];
  variants: IProductVariant[];
  platforms: IProductPlatform[];
  status: ProductStatus;
  // Shopify-specific fields
  shopifyId?: string;
  handle?: string;
  shopifyCreatedAt?: Date;
  shopifyUpdatedAt?: Date;
  // Legacy fields for backward compatibility
  marketplace?: MarketplaceType;
  externalId?: string;
  marketplaceUrl?: string; // Direct URL to the product on the marketplace
  currency: string;
  stock: number;
  category?: string;
  lastSyncedAt: Date;
  cachedDescriptions: ICachedDescription[];
  // Update status tracking
  updateStatus?: 'pending' | 'updating' | 'completed' | 'failed';
  updateError?: string;
  lastUpdateAttempt?: Date;
  // Video generation tracking (multiple videos, latest one is active)
  videos: IProductVideo[];
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const ProductImageSchema = new Schema<IProductImage>({
  shopifyId: { type: String },
  url: { type: String, required: true },
  altText: { type: String },
  _id: { type: Schema.Types.ObjectId }
});

const ProductVariantSchema = new Schema<IProductVariant>({
  id: { type: String },
  shopifyId: { type: String },
  title: { type: String, required: true },
  price: { type: String, required: true },
  compareAtPrice: { type: String },
  sku: { type: String },
  barcode: { type: String },
  inventory: { type: Number, default: 0 },
  inventoryQuantity: { type: Number, default: 0 },
  weight: { type: Number },
  weightUnit: { type: String },
  taxable: { type: Boolean, default: true },
  _id: { type: Schema.Types.ObjectId }
});

const ProductVideoSchema = new Schema<IProductVideo>({
  templateId: { type: String, required: true },
  templateName: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    required: true
  },
  videoUrl: { type: String },
  error: { type: String },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  _id: { type: Schema.Types.ObjectId }
});

const ProductPlatformSchema = new Schema<IProductPlatform>({
  platform: { 
    type: String, 
    enum: ['shopify', 'vtex', 'woocommerce', 'amazon', 'mercadolibre', 'facebook'],
    required: true 
  },
  platformId: { type: String, required: true },
  platformSku: { type: String },
  platformPrice: { type: Number },
  platformInventory: { type: Number },
  platformStatus: { type: String },
  lastSyncAt: { type: Date }
});

const productSchema = new Schema<IProduct>({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false // Will be removed after migration
  },
  storeConnectionId: {
    type: Schema.Types.ObjectId,
    ref: 'StoreConnection',
    required: true
  },
  title: { type: String, required: true },
  description: { type: String },
  price: { type: Number },
  compareAtPrice: { type: Number },
  sku: { type: String },
  barcode: { type: String },
  inventory: { type: Number, default: 0 },
  vendor: { type: String },
  productType: { type: String },
  tags: [{ type: String }],
  images: [ProductImageSchema],
  variants: [ProductVariantSchema],
  platforms: [ProductPlatformSchema],
  status: { 
    type: String, 
    enum: ['ACTIVE', 'DRAFT', 'ARCHIVED', 'active', 'draft', 'archived'],
    default: 'ACTIVE' 
  },
  // Shopify-specific fields
  shopifyId: { type: String },
  handle: { type: String },
  shopifyCreatedAt: { type: Date },
  shopifyUpdatedAt: { type: Date },
  // Legacy fields for backward compatibility
  marketplace: {
    type: String,
    enum: ['shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce']
  },
  externalId: { type: String },
  marketplaceUrl: { type: String }, // Direct URL to the product on the marketplace
  currency: {
    type: String,
    default: 'USD'
  },
  stock: { type: Number, default: 0 },
  category: { type: String },
  lastSyncedAt: { type: Date, default: Date.now },
  // Update status tracking
  updateStatus: { 
    type: String, 
    enum: ['pending', 'updating', 'completed', 'failed'],
    default: 'completed'
  },
  updateError: { type: String },
  lastUpdateAttempt: { type: Date },
  cachedDescriptions: [{
    platform: {
      type: String,
      enum: ['shopify', 'amazon', 'mercadolibre', 'woocommerce', 'vtex', 'facebook_shop', 'google_shopping'],
      required: true
    },
    content: { type: String, required: true },
    confidence: { type: Number, min: 0, max: 1 },
    keywords: [{ type: String }],
    tokens: { type: Number },
    createdAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    }
  }],
  // Video generation tracking (array of videos, latest one is shown)
  videos: [ProductVideoSchema]
}, {
  timestamps: true
});

// Virtual field to check if product has an accepted AI description
productSchema.virtual('hasAIDescription').get(function() {
  return this.cachedDescriptions.some(desc => desc.status === 'accepted');
});

// Ensure virtuals are included in JSON responses
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Update indexes for workspace-based access
productSchema.index({ workspaceId: 1, marketplace: 1, externalId: 1 }, { unique: true });
// Keep old index for backward compatibility during migration
productSchema.index({ userId: 1, marketplace: 1, externalId: 1 });

export default mongoose.model<IProduct>('Product', productSchema);