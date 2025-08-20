const mongoose = require('mongoose');

const generalSuggestionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
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
generalSuggestionSchema.statics.findValidSuggestions = function(userId) {
  return this.find({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ priority: 1, createdAt: -1 });
};

// Method to deactivate expired suggestions
generalSuggestionSchema.statics.deactivateExpired = function() {
  return this.updateMany(
    { expiresAt: { $lte: new Date() } },
    { isActive: false }
  );
};

module.exports = mongoose.model('GeneralSuggestion', generalSuggestionSchema);