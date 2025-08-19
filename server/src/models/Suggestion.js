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
  type: {
    type: String,
    required: true,
    enum: ['pricing', 'inventory', 'description', 'images', 'keywords', 'cross_selling']
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  currentValue: {
    type: mongoose.Schema.Types.Mixed
  },
  suggestedValue: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'applied'],
    default: 'pending'
  },
  estimatedImpact: {
    type: String,
    enum: ['low', 'medium', 'high']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Suggestion', suggestionSchema);