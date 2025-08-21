const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'],
    required: true,
    default: 'ACTIVE'
  },
  // Stripe Integration
  stripeSubscriptionId: {
    type: String,
    sparse: true,
    unique: true
  },
  stripeCustomerId: {
    type: String,
    sparse: true
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
    required: true,
    default: 'month'
  },
  // Subscription periods
  startsAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  endsAt: {
    type: Date,
    required: true
  },
  // Billing
  nextBillingDate: {
    type: Date
  },
  lastBillingDate: {
    type: Date
  },
  // Cancellation
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  },
  // Suspension
  suspendedAt: {
    type: Date
  },
  suspensionReason: {
    type: String
  },
  // Payment tracking
  paymentFailed: {
    type: Boolean,
    default: false
  },
  paymentFailedAt: {
    type: Date
  },
  // Notification tracking
  expirationWarningsSent: [{
    type: Date
  }],
  expiredNotificationSent: {
    type: Boolean,
    default: false
  },
  cancellationNotificationSent: {
    type: Boolean,
    default: false
  },
  suspensionNotificationSent: {
    type: Boolean,
    default: false
  },
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Instance Methods
subscriptionSchema.methods.isActive = function() {
  return this.status === 'ACTIVE' && this.endsAt > new Date();
};

subscriptionSchema.methods.isExpired = function() {
  return this.endsAt <= new Date();
};

subscriptionSchema.methods.isCancelled = function() {
  return this.status === 'CANCELLED';
};

subscriptionSchema.methods.isSuspended = function() {
  return this.status === 'SUSPENDED';
};

subscriptionSchema.methods.daysUntilExpiration = function() {
  const now = new Date();
  const timeDiff = this.endsAt - now;
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
};

subscriptionSchema.methods.daysUntilNextBilling = function() {
  if (!this.nextBillingDate) return null;
  const now = new Date();
  const timeDiff = this.nextBillingDate - now;
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
};

subscriptionSchema.methods.cancel = async function(reason = null) {
  this.status = 'CANCELLED';
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return await this.save();
};

subscriptionSchema.methods.suspend = async function(reason = null) {
  this.status = 'SUSPENDED';
  this.suspendedAt = new Date();
  this.suspensionReason = reason;
  return await this.save();
};

subscriptionSchema.methods.reactivate = async function() {
  this.status = 'ACTIVE';
  this.suspendedAt = null;
  this.suspensionReason = null;
  return await this.save();
};

subscriptionSchema.methods.renew = async function(months = 1) {
  const currentEnd = this.endsAt > new Date() ? this.endsAt : new Date();
  this.endsAt = new Date(currentEnd.getTime() + (months * 30 * 24 * 60 * 60 * 1000));
  this.lastBillingDate = new Date();
  this.nextBillingDate = new Date(this.endsAt);
  this.paymentFailed = false;
  this.paymentFailedAt = null;
  
  if (this.status !== 'ACTIVE') {
    this.status = 'ACTIVE';
  }
  
  return await this.save();
};

// Static Methods
subscriptionSchema.statics.findActiveByUser = function(userId) {
  return this.findOne({
    userId,
    status: 'ACTIVE',
    endsAt: { $gt: new Date() }
  }).populate('planId');
};

subscriptionSchema.statics.findByStripeId = function(stripeSubscriptionId) {
  return this.findOne({ stripeSubscriptionId }).populate('planId');
};

subscriptionSchema.statics.findExpiringSubscriptions = function(days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: 'ACTIVE',
    endsAt: { 
      $gte: new Date(),
      $lte: futureDate 
    }
  }).populate('userId planId');
};

subscriptionSchema.statics.findExpiredSubscriptions = function() {
  return this.find({
    status: 'ACTIVE',
    endsAt: { $lt: new Date() },
    expiredNotificationSent: false
  }).populate('userId planId');
};

subscriptionSchema.statics.createSubscription = async function(userId, planId, interval = 'month') {
  const Plan = require('./Plan');
  const plan = await Plan.findById(planId);
  
  if (!plan) {
    throw new Error('Plan not found');
  }
  
  const amount = interval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;
  const durationMonths = interval === 'year' ? 12 : 1;
  const endsAt = new Date();
  endsAt.setMonth(endsAt.getMonth() + durationMonths);
  
  return await this.create({
    userId,
    planId,
    amount,
    interval,
    endsAt,
    nextBillingDate: endsAt
  });
};

// Indexes
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ planId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ endsAt: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 }, { sparse: true, unique: true });
subscriptionSchema.index({ stripeCustomerId: 1 }, { sparse: true });
subscriptionSchema.index({ nextBillingDate: 1 });
subscriptionSchema.index({ createdAt: 1 });

// Compound indexes
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ status: 1, endsAt: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);