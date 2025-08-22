import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
// Note: These imports may cause circular dependencies and should be handled carefully
// import Subscription from '../../subscriptions/models/Subscription';
// import Plan from '../../subscriptions/models/Plan';
// import StoreConnection from '../../stores/models/StoreConnection';
// import Product from '../../products/models/Product';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'USER' | 'SUPERADMIN';
  isActive: boolean;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  subscriptionPlan: 'BASIC' | 'PRO' | 'ENTERPRISE';
  trialEndsAt?: Date;
  subscriptionEndsAt?: Date;
  companyName?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  timezone: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  matchPassword(enteredPassword: string): Promise<boolean>;
  isSuperAdmin(): boolean;
  getActiveSubscription(): Promise<any>;
  hasActiveSubscription(): Promise<boolean>;
  getCurrentPlan(): Promise<any>;
  hasReachedStoreLimit(): Promise<boolean>;
  hasReachedProductLimit(): Promise<boolean>;
  getFullName(): string;
  getSubscriptionInfo(): Promise<{
    status: string;
    plan: string | null;
    hasActiveSubscription: boolean;
    endsAt: Date | null;
    trialEndsAt?: Date | null;
    isTrialExpired?: boolean;
    planLimits: any;
  }>;
}

const userSchema = new Schema<IUser>({
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

userSchema.methods.matchPassword = async function(enteredPassword: string): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if user is a SUPERADMIN
userSchema.methods.isSuperAdmin = function(): boolean {
  return this.role === 'SUPERADMIN';
};

// Get user's active subscription
userSchema.methods.getActiveSubscription = async function() {
  // Dynamic import to avoid circular dependency
  const { default: Subscription } = await import('../../subscriptions/models/Subscription');
  return await Subscription.findOne({
    userId: this._id,
    status: 'ACTIVE',
    endsAt: { $gt: new Date() }
  }).populate('planId');
};

// Check if user has an active subscription
userSchema.methods.hasActiveSubscription = async function(): Promise<boolean> {
  const subscriptionInfo = await this.getSubscriptionInfo();
  return subscriptionInfo.hasActiveSubscription;
};

// Get user's current plan
userSchema.methods.getCurrentPlan = async function() {
  if (!this.subscriptionPlan) return null;
  
  // Dynamic import to avoid circular dependency
  const { default: Plan } = await import('../../subscriptions/models/Plan');
  return await Plan.findByName(this.subscriptionPlan);
};

// Check if user has reached their limits
userSchema.methods.hasReachedStoreLimit = async function(): Promise<boolean> {
  const plan = await this.getCurrentPlan();
  if (!plan) return true; // No subscription = no access
  
  // Dynamic import to avoid circular dependency
  const { default: StoreConnection } = await import('../../stores/models/StoreConnection');
  const storeCount = await StoreConnection.countDocuments({ 
    userId: this._id, 
    isActive: true 
  });
  return storeCount >= plan.limits.maxStores;
};

userSchema.methods.hasReachedProductLimit = async function(): Promise<boolean> {
  const plan = await this.getCurrentPlan();
  if (!plan) return true; // No subscription = no access
  
  // Dynamic import to avoid circular dependency
  const { default: Product } = await import('../../products/models/Product');
  const productCount = await Product.countDocuments({ userId: this._id });
  return productCount >= plan.limits.maxProducts;
};

// Get user's full name
userSchema.methods.getFullName = function(): string {
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

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default User;