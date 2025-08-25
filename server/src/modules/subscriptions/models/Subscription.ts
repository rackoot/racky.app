import mongoose, { Document, Model, Schema, Types } from 'mongoose';
// Note: This import may cause circular dependencies and should be handled carefully
// import Plan from './Plan';

// Type for subscription status
export type SubscriptionStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';

// Type for billing interval
export type BillingInterval = 'month' | 'year';

// Interface for Subscription document
export interface ISubscription extends Document {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId; // Keep for backward compatibility during migration
  planId: Types.ObjectId;
  status: SubscriptionStatus;
  // Contributor-based fields
  contributorCount: number; // Number of contributors hired (1-5 for most plans)
  totalMonthlyActions: number; // Computed: contributorCount * plan.actionsPerContributor
  // Stripe Integration
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  // Pricing information
  amount: number; // Total amount in cents (contributorCount * plan price)
  currency: string;
  interval: BillingInterval;
  // Subscription periods
  startsAt: Date;
  endsAt: Date;
  // Billing
  nextBillingDate?: Date;
  lastBillingDate?: Date;
  // Cancellation
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  // Suspension
  suspendedAt?: Date;
  suspensionReason?: string;
  // Payment tracking
  paymentFailed: boolean;
  paymentFailedAt?: Date;
  // Notification tracking
  expirationWarningsSent: Date[];
  expiredNotificationSent: boolean;
  cancellationNotificationSent: boolean;
  suspensionNotificationSent: boolean;
  // Metadata
  metadata: Record<string, any>;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  isActive(): boolean;
  isExpired(): boolean;
  isCancelled(): boolean;
  isSuspended(): boolean;
  daysUntilExpiration(): number;
  daysUntilNextBilling(): number | null;
  cancel(reason?: string): Promise<ISubscription>;
  suspend(reason?: string): Promise<ISubscription>;
  reactivate(): Promise<ISubscription>;
  renew(months?: number): Promise<ISubscription>;
  // Contributor-based methods
  updateContributorCount(newCount: number): Promise<ISubscription>;
  getActionsPerContributor(): number;
  getContributorUtilization(usedActions: number): number;
}

// Interface for Subscription model with static methods
export interface ISubscriptionModel extends Model<ISubscription> {
  findActiveByUser(userId: Types.ObjectId): Promise<ISubscription | null>;
  findByStripeId(stripeSubscriptionId: string): Promise<ISubscription | null>;
  findExpiringSubscriptions(days?: number): Promise<ISubscription[]>;
  findExpiredSubscriptions(): Promise<ISubscription[]>;
  createSubscription(userId: Types.ObjectId, planId: Types.ObjectId, interval?: BillingInterval, contributorCount?: number): Promise<ISubscription>;
}

const subscriptionSchema = new Schema<ISubscription>({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false // Will be removed after migration
  },
  planId: {
    type: Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'],
    required: true,
    default: 'ACTIVE'
  },
  // Contributor-based fields
  contributorCount: {
    type: Number,
    required: true,
    min: 1,
    max: 50,
    default: 1
  },
  totalMonthlyActions: {
    type: Number,
    required: true,
    min: 0
  },
  // Stripe Integration
  stripeSubscriptionId: {
    type: String
  },
  stripeCustomerId: {
    type: String
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
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Instance Methods
subscriptionSchema.methods.isActive = function(this: ISubscription): boolean {
  return this.status === 'ACTIVE' && this.endsAt > new Date();
};

subscriptionSchema.methods.isExpired = function(this: ISubscription): boolean {
  return this.endsAt <= new Date();
};

subscriptionSchema.methods.isCancelled = function(this: ISubscription): boolean {
  return this.status === 'CANCELLED';
};

subscriptionSchema.methods.isSuspended = function(this: ISubscription): boolean {
  return this.status === 'SUSPENDED';
};

subscriptionSchema.methods.daysUntilExpiration = function(this: ISubscription): number {
  const now = new Date();
  const timeDiff = this.endsAt.getTime() - now.getTime();
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
};

subscriptionSchema.methods.daysUntilNextBilling = function(this: ISubscription): number | null {
  if (!this.nextBillingDate) return null;
  const now = new Date();
  const timeDiff = this.nextBillingDate.getTime() - now.getTime();
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
};

subscriptionSchema.methods.cancel = async function(this: ISubscription, reason?: string): Promise<ISubscription> {
  this.status = 'CANCELLED';
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return await this.save();
};

subscriptionSchema.methods.suspend = async function(this: ISubscription, reason?: string): Promise<ISubscription> {
  this.status = 'SUSPENDED';
  this.suspendedAt = new Date();
  this.suspensionReason = reason;
  return await this.save();
};

subscriptionSchema.methods.reactivate = async function(this: ISubscription): Promise<ISubscription> {
  this.status = 'ACTIVE';
  this.suspendedAt = undefined;
  this.suspensionReason = undefined;
  return await this.save();
};

subscriptionSchema.methods.renew = async function(this: ISubscription, months: number = 1): Promise<ISubscription> {
  const currentEnd = this.endsAt > new Date() ? this.endsAt : new Date();
  this.endsAt = new Date(currentEnd.getTime() + (months * 30 * 24 * 60 * 60 * 1000));
  this.lastBillingDate = new Date();
  this.nextBillingDate = new Date(this.endsAt);
  this.paymentFailed = false;
  this.paymentFailedAt = undefined;
  
  if (this.status !== 'ACTIVE') {
    this.status = 'ACTIVE';
  }
  
  return await this.save();
};

// Contributor-based methods
subscriptionSchema.methods.updateContributorCount = async function(this: ISubscription, newCount: number): Promise<ISubscription> {
  // Dynamic import to avoid circular dependency
  const { default: Plan } = await import('./Plan');
  const plan = await Plan.findById(this.planId);
  
  if (!plan) {
    throw new Error('Plan not found');
  }
  
  if (newCount > plan.maxContributorsPerWorkspace) {
    throw new Error(`Maximum ${plan.maxContributorsPerWorkspace} contributors allowed for this plan`);
  }
  
  this.contributorCount = newCount;
  this.totalMonthlyActions = plan.getTotalActionsPerMonth(newCount);
  this.amount = this.interval === 'year' ? 
    plan.getTotalYearlyPrice(newCount) : 
    plan.getTotalMonthlyPrice(newCount);
  
  return await this.save();
};

subscriptionSchema.methods.getActionsPerContributor = function(this: ISubscription): number {
  return Math.floor(this.totalMonthlyActions / this.contributorCount);
};

subscriptionSchema.methods.getContributorUtilization = function(this: ISubscription, usedActions: number): number {
  if (this.totalMonthlyActions === 0) return 0;
  return Math.min((usedActions / this.totalMonthlyActions) * 100, 100);
};

// Static Methods
subscriptionSchema.statics.findActiveByUser = function(this: ISubscriptionModel, userId: Types.ObjectId): Promise<ISubscription | null> {
  return this.findOne({
    userId,
    status: 'ACTIVE',
    endsAt: { $gt: new Date() }
  }).populate('planId');
};

subscriptionSchema.statics.findByStripeId = function(this: ISubscriptionModel, stripeSubscriptionId: string): Promise<ISubscription | null> {
  return this.findOne({ stripeSubscriptionId }).populate('planId');
};

subscriptionSchema.statics.findExpiringSubscriptions = function(this: ISubscriptionModel, days: number = 7): Promise<ISubscription[]> {
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

subscriptionSchema.statics.findExpiredSubscriptions = function(this: ISubscriptionModel): Promise<ISubscription[]> {
  return this.find({
    status: 'ACTIVE',
    endsAt: { $lt: new Date() },
    expiredNotificationSent: false
  }).populate('userId planId');
};

subscriptionSchema.statics.createSubscription = async function(this: ISubscriptionModel, userId: Types.ObjectId, planId: Types.ObjectId, interval: BillingInterval = 'month', contributorCount: number = 1): Promise<ISubscription> {
  // Dynamic import to avoid circular dependency
  const { default: Plan } = await import('./Plan');
  const plan = await Plan.findById(planId);
  
  if (!plan) {
    throw new Error('Plan not found');
  }
  
  if (contributorCount > plan.maxContributorsPerWorkspace) {
    throw new Error(`Maximum ${plan.maxContributorsPerWorkspace} contributors allowed for this plan`);
  }
  
  const amount = interval === 'year' ? 
    plan.getTotalYearlyPrice(contributorCount) : 
    plan.getTotalMonthlyPrice(contributorCount);
  const totalMonthlyActions = plan.getTotalActionsPerMonth(contributorCount);
  const durationMonths = interval === 'year' ? 12 : 1;
  const endsAt = new Date();
  endsAt.setMonth(endsAt.getMonth() + durationMonths);
  
  return await this.create({
    userId,
    planId,
    contributorCount,
    totalMonthlyActions,
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
subscriptionSchema.index({ nextBillingDate: 1 });
subscriptionSchema.index({ createdAt: 1 });

// Compound indexes
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ status: 1, endsAt: 1 });

export default mongoose.model<ISubscription, ISubscriptionModel>('Subscription', subscriptionSchema);