const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
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
opportunitySchema.statics.findValidForProduct = function(userId, productId) {
  return this.find({
    userId,
    productId,
    expiresAt: { $gt: new Date() },
    status: { $ne: 'dismissed' }
  }).sort({ priority: 1, createdAt: -1 });
};

// Static method to find opportunities by category
opportunitySchema.statics.findByCategory = function(userId, productId, category) {
  return this.find({
    userId,
    productId,
    category,
    expiresAt: { $gt: new Date() },
    status: { $ne: 'dismissed' }
  }).sort({ priority: 1, createdAt: -1 });
};

// Static method to clean up expired opportunities
opportunitySchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

// Instance method to check if opportunity is expired
opportunitySchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Instance method to extend expiration
opportunitySchema.methods.extendExpiration = function(hours = 24) {
  this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.save();
};

module.exports = mongoose.model('Opportunity', opportunitySchema);