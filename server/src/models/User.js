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
  const subscription = await this.getActiveSubscription();
  return !!subscription;
};

// Get user's current plan
userSchema.methods.getCurrentPlan = async function() {
  const subscription = await this.getActiveSubscription();
  if (!subscription) return null;
  return subscription.planId;
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
  const subscription = await this.getActiveSubscription();
  
  if (!subscription) {
    return {
      status: 'NONE',
      plan: null,
      hasActiveSubscription: false,
      endsAt: null,
      planLimits: null
    };
  }
  
  return {
    status: subscription.status,
    plan: subscription.planId.name,
    hasActiveSubscription: true,
    endsAt: subscription.endsAt,
    planLimits: subscription.planId.limits,
    planFeatures: subscription.planId.features
  };
};

// Indexes for efficient querying
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ stripeCustomerId: 1 }, { sparse: true });
userSchema.index({ createdAt: 1 });
userSchema.index({ isActive: 1 });

module.exports = mongoose.model('User', userSchema);