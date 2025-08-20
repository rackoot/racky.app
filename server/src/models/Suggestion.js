const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
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
    type: mongoose.Schema.Types.Mixed
  },
  suggestedValue: {
    type: mongoose.Schema.Types.Mixed
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
suggestionSchema.statics.findLatestSuggestion = function(userId, productId, platform, type) {
  return this.findOne({
    userId,
    productId,
    platform,
    type
  }).sort({ createdAt: -1 });
};

// Static method to find suggestion history
suggestionSchema.statics.getSuggestionHistory = function(userId, productId, platform = null, type = null) {
  const query = { userId, productId };
  if (platform) query.platform = platform;
  if (type) query.type = type;
  
  return this.find(query).sort({ createdAt: -1 }).limit(50);
};

module.exports = mongoose.model('Suggestion', suggestionSchema);