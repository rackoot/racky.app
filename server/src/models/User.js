const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['USER', 'SUPERADMIN'],
    default: 'USER'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Subscription Information
  subscriptionStatus: {
    type: String,
    enum: ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'],
    default: 'TRIAL'
  },
  subscriptionPlan: {
    type: String,
    enum: ['BASIC', 'PRO', 'ENTERPRISE'],
    default: 'BASIC'
  },
  trialEndsAt: {
    type: Date
  },
  subscriptionEndsAt: {
    type: Date
  },
  // Company Information (optional)
  companyName: {
    type: String,
    trim: true
  },
  // Billing Integration
  stripeCustomerId: {
    type: String,
    sparse: true
  },
  stripeSubscriptionId: {
    type: String,
    sparse: true
  },
  // User Preferences
  timezone: {
    type: String,
    default: 'UTC'
  },
  language: {
    type: String,
    default: 'en'
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if user is a SUPERADMIN
userSchema.methods.isSuperAdmin = function() {
  return this.role === 'SUPERADMIN';
};

// Get user's active subscription
userSchema.methods.getActiveSubscription = async function() {
  const Subscription = require('./Subscription');
  return await Subscription.findOne({
    userId: this._id,
    status: 'ACTIVE',
    endsAt: { $gt: new Date() }
  }).populate('planId');
};

// Check if user has an active subscription
userSchema.methods.hasActiveSubscription = async function() {
  const subscriptionInfo = await this.getSubscriptionInfo();
  return subscriptionInfo.hasActiveSubscription;
};

// Get user's current plan
userSchema.methods.getCurrentPlan = async function() {
  if (!this.subscriptionPlan) return null;
  
  const Plan = require('./Plan');
  return await Plan.findByName(this.subscriptionPlan);
};

// Check if user has reached their limits
userSchema.methods.hasReachedStoreLimit = async function() {
  const plan = await this.getCurrentPlan();
  if (!plan) return true; // No subscription = no access
  
  const StoreConnection = require('./StoreConnection');
  const storeCount = await StoreConnection.countDocuments({ 
    userId: this._id, 
    isActive: true 
  });
  return storeCount >= plan.limits.maxStores;
};

userSchema.methods.hasReachedProductLimit = async function() {
  const plan = await this.getCurrentPlan();
  if (!plan) return true; // No subscription = no access
  
  const Product = require('./Product');
  const productCount = await Product.countDocuments({ userId: this._id });
  return productCount >= plan.limits.maxProducts;
};

// Get user's full name
userSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Get user's subscription info
userSchema.methods.getSubscriptionInfo = async function() {
  // Use subscription data from User model instead of Subscription collection
  if (!this.subscriptionStatus || this.subscriptionStatus === 'CANCELLED') {
    return {
      status: 'NONE',
      plan: null,
      hasActiveSubscription: false,
      endsAt: null,
      planLimits: null
    };
  }

  // Check if subscription is expired
  const now = new Date();
  const isTrialExpired = this.trialEndsAt && now > this.trialEndsAt;
  const isSubscriptionExpired = this.subscriptionEndsAt && now > this.subscriptionEndsAt;

  const hasActiveSubscription = this.subscriptionStatus === 'ACTIVE' || 
    (this.subscriptionStatus === 'TRIAL' && !isTrialExpired);

  return {
    status: this.subscriptionStatus,
    plan: this.subscriptionPlan,
    hasActiveSubscription,
    endsAt: this.subscriptionEndsAt,
    trialEndsAt: this.trialEndsAt,
    isTrialExpired,
    planLimits: null // Will be populated by getCurrentPlan if needed
  };
};

// Indexes for efficient querying
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ stripeCustomerId: 1 }, { sparse: true });
userSchema.index({ createdAt: 1 });
userSchema.index({ isActive: 1 });

module.exports = mongoose.model('User', userSchema);