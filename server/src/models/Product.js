const mongoose = require('mongoose');

const ProductImageSchema = new mongoose.Schema({
  shopifyId: { type: String },
  url: { type: String, required: true },
  altText: { type: String },
  _id: { type: mongoose.Schema.Types.ObjectId }
});

const ProductVariantSchema = new mongoose.Schema({
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
  _id: { type: mongoose.Schema.Types.ObjectId }
});

const ProductPlatformSchema = new mongoose.Schema({
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

const productSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  storeConnectionId: {
    type: mongoose.Schema.Types.ObjectId,
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
  }]
}, {
  timestamps: true
});

productSchema.index({ userId: 1, marketplace: 1, externalId: 1 }, { unique: true });

module.exports = mongoose.model('Product', productSchema);