import request from 'supertest';
import express from 'express';
import { setupTestDb, teardownTestDb, clearTestDb } from '../setup/testDb';
import { createTestUser, createTestUserWithWorkspace, getAuthHeaders } from '../helpers/testAuth';
import { testPlans } from '../fixtures/testData';
import plansRoutes from '../../modules/subscriptions/routes/plans';
import Plan from '../../modules/subscriptions/models/Plan';
import Subscription from '../../modules/subscriptions/models/Subscription';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/plans', plansRoutes);

describe('Subscription Plans Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    
    // Create test plans for each test
    await Plan.create(testPlans.basicPlan);
    await Plan.create(testPlans.proPlan);
    
    // Create an inactive plan for testing (using ENTERPRISE name but inactive)
    await Plan.create({
      ...testPlans.basicPlan,
      name: 'ENTERPRISE',
      displayName: 'Enterprise Plan (Inactive)',
      stripeMonthlyPriceId: 'price_test_enterprise_monthly',
      stripeYearlyPriceId: 'price_test_enterprise_yearly',
      isActive: false,
      isPublic: false,
      sortOrder: 99,
    });
  });

  describe('GET /api/plans', () => {
    it('should get all public and active subscription plans', async () => {
      const response = await request(app)
        .get('/api/plans')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            name: 'BASIC',
            displayName: 'Basic Plan',
            monthlyPrice: 2900,
            yearlyPrice: 29000,
            limits: expect.objectContaining({
              maxStores: 1,
              maxProducts: 100,
              apiCallsPerMonth: 1000,
            }),
            features: expect.arrayContaining([
              expect.objectContaining({
                name: 'Product Management',
                enabled: true,
              }),
            ]),
            isActive: true,
            isPublic: true,
          }),
          expect.objectContaining({
            name: 'PRO',
            displayName: 'Pro Plan',
            monthlyPrice: 7900,
            yearlyPrice: 79000,
            limits: expect.objectContaining({
              maxStores: 5,
              maxProducts: 1000,
              apiCallsPerMonth: 10000,
            }),
          }),
        ]),
      });

      // Should not include inactive plans
      expect(response.body.data).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'ENTERPRISE',
            isActive: false,
          }),
        ])
      );
    });

    it('should return plans in correct sort order', async () => {
      // Update one plan with different sort order
      await Plan.findOneAndUpdate(
        { name: 'PRO' },
        { sortOrder: 1 }
      );

      const response = await request(app)
        .get('/api/plans')
        .expect(200);

      // PRO plan should come first due to lower sortOrder
      expect(response.body.data[0].name).toBe('PRO');
    });

    it('should handle error when database fails', async () => {
      // Mock database error by closing connection
      const mongoose = require('mongoose');
      await mongoose.connection.close();

      const response = await request(app)
        .get('/api/plans')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Failed to fetch subscription plans',
        error: expect.any(String),
      });

      // Reconnect for other tests
      await setupTestDb();
      await Plan.create(testPlans.basicPlan);
      await Plan.create(testPlans.proPlan);
    });
  });

  describe('GET /api/plans/:name', () => {
    it('should get specific plan by name', async () => {
      const response = await request(app)
        .get('/api/plans/BASIC')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          name: 'BASIC',
          displayName: 'Basic Plan',
          description: 'Basic plan for small businesses',
          monthlyPrice: 2900,
          yearlyPrice: 29000,
          limits: expect.objectContaining({
            maxStores: 1,
            maxProducts: 100,
            maxMarketplaces: 2,
            maxSyncFrequency: 24,
            apiCallsPerMonth: 1000,
          }),
          features: expect.arrayContaining([
            expect.objectContaining({
              name: 'Product Management',
              description: 'Manage your products across marketplaces',
              enabled: true,
            }),
          ]),
        }),
      });
    });

    it('should get plan by name case-insensitive', async () => {
      const response = await request(app)
        .get('/api/plans/basic')
        .expect(200);

      expect(response.body.data.name).toBe('BASIC');
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .get('/api/plans/NONEXISTENT')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Plan not found',
      });
    });

    it('should find inactive plans by name', async () => {
      const response = await request(app)
        .get('/api/plans/ENTERPRISE')
        .expect(200);

      expect(response.body.data.name).toBe('ENTERPRISE');
      expect(response.body.data.isActive).toBe(false);
    });
  });

  describe('GET /api/plans/user/current', () => {
    it('should get current workspace plan with active subscription', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create subscription for the workspace
      const basicPlan = await Plan.findByName('BASIC');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      });

      const response = await request(app)
        .get('/api/plans/user/current')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          plan: expect.objectContaining({
            name: 'BASIC',
          }),
          userSubscription: expect.objectContaining({
            status: expect.any(String),
            plan: 'BASIC',
            hasActiveSubscription: true,
          }),
        }),
      });
    });

    it('should handle workspace without active subscription', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();

      const response = await request(app)
        .get('/api/plans/user/current')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'No active subscription found for this workspace',
      });
    });

    it('should require workspace context', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .get('/api/plans/user/current')
        .set(getAuthHeaders(user.token))
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Workspace context required',
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/plans/user/current')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle expired subscription', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create expired subscription
      const basicPlan = await Plan.findByName('BASIC');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        endsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago (expired)
      });

      const response = await request(app)
        .get('/api/plans/user/current')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'No active subscription found for this workspace',
      });
    });

    it('should handle cancelled subscription', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create cancelled subscription
      const basicPlan = await Plan.findByName('BASIC');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'CANCELLED',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelledAt: new Date(),
      });

      const response = await request(app)
        .get('/api/plans/user/current')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'No active subscription found for this workspace',
      });
    });
  });

  describe('Plan Model Methods', () => {
    it('should calculate monthly price formatted correctly', async () => {
      const basicPlan = await Plan.findByName('BASIC');
      expect(basicPlan!.getMonthlyPriceFormatted()).toBe('29.00');
    });

    it('should calculate yearly price formatted correctly', async () => {
      const basicPlan = await Plan.findByName('BASIC');
      expect(basicPlan!.getYearlyPriceFormatted()).toBe('290.00');
    });

    it('should calculate yearly savings correctly', async () => {
      const basicPlan = await Plan.findByName('BASIC');
      const monthlyTotal = basicPlan!.monthlyPrice * 12; // 2900 * 12 = 34800
      const savings = monthlyTotal - basicPlan!.yearlyPrice; // 34800 - 29000 = 5800
      const expectedPercentage = Math.round((savings / monthlyTotal) * 100); // ~17%
      
      expect(basicPlan!.getYearlySavings()).toBe(expectedPercentage);
    });

    it('should check if plan has specific feature', async () => {
      const basicPlan = await Plan.findByName('BASIC');
      expect(basicPlan!.hasFeature('Product Management')).toBe(true);
      expect(basicPlan!.hasFeature('AI Suggestions')).toBe(false);

      const proPlan = await Plan.findByName('PRO');
      expect(proPlan!.hasFeature('AI Suggestions')).toBe(true);
    });
  });

  describe('Plan Limits Validation', () => {
    it('should validate plan limits structure', async () => {
      const basicPlan = await Plan.findByName('BASIC');
      
      expect(basicPlan!.limits).toMatchObject({
        maxStores: expect.any(Number),
        maxProducts: expect.any(Number),
        maxMarketplaces: expect.any(Number),
        maxSyncFrequency: expect.any(Number),
        apiCallsPerMonth: expect.any(Number),
      });
    });

    it('should have different limits between plans', async () => {
      const basicPlan = await Plan.findByName('BASIC');
      const proPlan = await Plan.findByName('PRO');

      expect(proPlan!.limits.maxStores).toBeGreaterThan(basicPlan!.limits.maxStores);
      expect(proPlan!.limits.maxProducts).toBeGreaterThan(basicPlan!.limits.maxProducts);
      expect(proPlan!.limits.apiCallsPerMonth).toBeGreaterThan(basicPlan!.limits.apiCallsPerMonth);
    });
  });

  describe('Plan Features Validation', () => {
    it('should have required features for all plans', async () => {
      const plans = await Plan.find();
      
      plans.forEach(plan => {
        expect(plan.features).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              enabled: expect.any(Boolean),
            }),
          ])
        );
      });
    });

    it('should have more features in higher tier plans', async () => {
      const basicPlan = await Plan.findByName('BASIC');
      const proPlan = await Plan.findByName('PRO');

      expect(proPlan!.features.length).toBeGreaterThanOrEqual(basicPlan!.features.length);
      
      // PRO plan should have AI Suggestions feature
      expect(proPlan!.hasFeature('AI Suggestions')).toBe(true);
      expect(basicPlan!.hasFeature('AI Suggestions')).toBe(false);
    });
  });
});