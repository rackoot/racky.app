const mongoose = require('mongoose');

const storeConnectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  storeName: {
    type: String,
    required: true,
    trim: true
  },
  marketplaceType: {
    type: String,
    required: true,
    enum: ['shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce']
  },
  credentials: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSync: {
    type: Date,
    default: null
  },
  syncStatus: {
    type: String,
    enum: ['pending', 'syncing', 'completed', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Compound index to ensure one connection per marketplace type per user
storeConnectionSchema.index({ userId: 1, marketplaceType: 1 }, { unique: true });

module.exports = mongoose.model('StoreConnection', storeConnectionSchema);