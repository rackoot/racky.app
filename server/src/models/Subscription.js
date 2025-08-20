const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stripeSubscriptionId: {
    type: String,
    required: true,
    unique: true
  },
  stripeCustomerId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID'],
    required: true
  },
  plan: {
    type: String,
    enum: ['BASIC', 'PRO', 'ENTERPRISE'],
    required: true
  },
  // Pricing information
  amount: {
    type: Number,
    required: true // Amount in cents
  },
  currency: {
    type: String,
    default: 'usd'
  },
  interval: {
    type: String,
    enum: ['month', 'year'],
    required: true
  },
  // Subscription periods
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  // Cancellation
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  canceledAt: {
    type: Date
  },
  // Trial information
  trialStart: {
    type: Date
  },
  trialEnd: {
    type: Date
  },
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Methods
subscriptionSchema.methods.isActive = function() {
  return this.status === 'ACTIVE' && this.currentPeriodEnd > new Date();
};

subscriptionSchema.methods.isTrialing = function() {
  return this.trialEnd && this.trialEnd > new Date();
};

subscriptionSchema.methods.willCancelAtPeriodEnd = function() {
  return this.cancelAtPeriodEnd === true;
};

subscriptionSchema.methods.daysUntilRenewal = function() {
  const now = new Date();
  const timeDiff = this.currentPeriodEnd - now;
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
};

// Statics
subscriptionSchema.statics.findActiveByUser = function(userId) {
  return this.findOne({
    userId,
    status: 'ACTIVE',
    currentPeriodEnd: { $gt: new Date() }
  });
};

subscriptionSchema.statics.findByStripeId = function(stripeSubscriptionId) {
  return this.findOne({ stripeSubscriptionId });
};

// Indexes
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 }, { unique: true });
subscriptionSchema.index({ stripeCustomerId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);