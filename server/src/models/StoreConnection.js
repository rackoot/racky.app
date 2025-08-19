const mongoose = require('mongoose');

const marketplaceSchema = new mongoose.Schema({
  type: {
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
});

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
  marketplaces: [marketplaceSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('StoreConnection', storeConnectionSchema);