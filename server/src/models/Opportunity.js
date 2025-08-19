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
  type: {
    type: String,
    required: true,
    enum: ['price_optimization', 'inventory_alert', 'competitor_analysis', 'market_expansion']
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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Opportunity', opportunitySchema);