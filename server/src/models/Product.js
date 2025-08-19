const mongoose = require('mongoose');

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
  marketplace: {
    type: String,
    required: true,
    enum: ['shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce']
  },
  externalId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  price: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  sku: {
    type: String
  },
  stock: {
    type: Number,
    default: 0
  },
  images: [{
    type: String
  }],
  category: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'active'
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

productSchema.index({ userId: 1, marketplace: 1, externalId: 1 }, { unique: true });

module.exports = mongoose.model('Product', productSchema);