import Joi from 'joi';

// DTO interfaces for subscription operations
export interface UpdateSubscriptionDto {
  planName: 'BASIC' | 'PRO' | 'ENTERPRISE';
  billingCycle?: 'monthly' | 'annual';
  contributorCount?: number;
}

export interface SubscriptionPreviewDto {
  planName: 'BASIC' | 'PRO' | 'ENTERPRISE';
  billingCycle?: 'monthly' | 'annual';
  contributorCount?: number;
}

// Joi validation schemas
export const updateSubscriptionSchema = Joi.object<UpdateSubscriptionDto>({
  planName: Joi.string().valid('BASIC', 'PRO', 'ENTERPRISE').required(),
  billingCycle: Joi.string().valid('monthly', 'annual').optional().default('monthly'),
  contributorCount: Joi.number().integer().min(1).max(50).optional().default(1)
});

export const subscriptionPreviewSchema = Joi.object<SubscriptionPreviewDto>({
  planName: Joi.string().valid('BASIC', 'PRO', 'ENTERPRISE').required(),
  billingCycle: Joi.string().valid('monthly', 'annual').optional().default('monthly'),
  contributorCount: Joi.number().integer().min(1).max(50).optional().default(1)
});