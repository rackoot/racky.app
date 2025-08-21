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
  // Subscription Management
  subscriptionStatus: {
    type: String,
    enum: ['TRIAL', 'TRIAL_EXPIRED', 'ACTIVE', 'SUSPENDED', 'CANCELLED'],
    default: 'TRIAL'
  },
  subscriptionPlan: {
    type: String,
    enum: ['BASIC', 'PRO', 'ENTERPRISE'],
    default: 'BASIC'
  },
  trialEndsAt: {
    type: Date,
    default: function() {
      // 14-day trial period
      return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    }
  },
  subscriptionEndsAt: {
    type: Date
  },
  // Plan Limits
  maxStores: {
    type: Number,
    default: function() {
      switch(this.subscriptionPlan) {
        case 'BASIC': return 1;
        case 'PRO': return 5;
        case 'ENTERPRISE': return 50;
        default: return 1;
      }
    }
  },
  maxProducts: {
    type: Number,
    default: function() {
      switch(this.subscriptionPlan) {
        case 'BASIC': return 100;
        case 'PRO': return 1000;
        case 'ENTERPRISE': return 10000;
        default: return 100;
      }
    }
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
  // Notification Tracking
  lastTrialWarningAt: {
    type: Date
  },
  trialExpiredNotificationSent: {
    type: Boolean,
    default: false
  },
  trialExpiredAt: {
    type: Date
  },
  suspensionNotificationSent: {
    type: Boolean,
    default: false
  },
  subscriptionSuspendedAt: {
    type: Date
  },
  cancellationNotificationSent: {
    type: Boolean,
    default: false
  },
  subscriptionCancelledAt: {
    type: Date
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

// Check if user has an active subscription
userSchema.methods.hasActiveSubscription = function() {
  return this.subscriptionStatus === 'ACTIVE' || 
         (this.subscriptionStatus === 'TRIAL' && this.trialEndsAt > new Date());
};

// Check if trial is expired
userSchema.methods.isTrialExpired = function() {
  return this.subscriptionStatus === 'TRIAL' && this.trialEndsAt <= new Date();
};

// Check if user has reached their limits
userSchema.methods.hasReachedStoreLimit = async function() {
  const StoreConnection = require('./StoreConnection');
  const storeCount = await StoreConnection.countDocuments({ 
    userId: this._id, 
    isActive: true 
  });
  return storeCount >= this.maxStores;
};

userSchema.methods.hasReachedProductLimit = async function() {
  const Product = require('./Product');
  const productCount = await Product.countDocuments({ userId: this._id });
  return productCount >= this.maxProducts;
};

// Get user's full name
userSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Get user's subscription info
userSchema.methods.getSubscriptionInfo = function() {
  return {
    status: this.subscriptionStatus,
    plan: this.subscriptionPlan,
    trialEndsAt: this.trialEndsAt,
    subscriptionEndsAt: this.subscriptionEndsAt,
    maxStores: this.maxStores,
    maxProducts: this.maxProducts,
    hasActiveSubscription: this.hasActiveSubscription(),
    isTrialExpired: this.isTrialExpired()
  };
};

// Get user's current plan with limits and features
userSchema.methods.getCurrentPlan = async function() {
  const Plan = require('./Plan');
  const plan = await Plan.findOne({ name: this.subscriptionPlan });
  return plan;
};

// Update plan limits when subscription plan changes
userSchema.pre('save', function(next) {
  if (this.isModified('subscriptionPlan')) {
    switch(this.subscriptionPlan) {
      case 'BASIC':
        this.maxStores = 1;
        this.maxProducts = 100;
        break;
      case 'PRO':
        this.maxStores = 5;
        this.maxProducts = 1000;
        break;
      case 'ENTERPRISE':
        this.maxStores = 50;
        this.maxProducts = 10000;
        break;
      default:
        this.maxStores = 1;
        this.maxProducts = 100;
    }
  }
  next();
});

// Indexes for efficient querying
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ subscriptionStatus: 1 });
userSchema.index({ trialEndsAt: 1 });
userSchema.index({ stripeCustomerId: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);