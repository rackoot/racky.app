import request from 'supertest';
import express from 'express';
import { setupTestDb, teardownTestDb, clearTestDb } from '../setup/testDb';
import { createTestUserWithWorkspace, getAuthHeaders } from '../helpers/testAuth';
import { testStoreConnections, testPlans } from '../fixtures/testData';
import storeRoutes from '../../modules/stores/routes/connections';
import { protect, requireWorkspace } from '../../common/middleware/auth';
import Plan from '../../modules/subscriptions/models/Plan';
import Subscription from '../../modules/subscriptions/models/Subscription';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/connections', protect, requireWorkspace, storeRoutes);

describe('Store Connections Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    
    // Create test plans for subscription checks
    await Plan.create(testPlans.basicPlan);
    await Plan.create(testPlans.proPlan);
  });

  describe('GET /api/connections', () => {
    it('should get all connections for authenticated user', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create active subscription to pass subscription checks
      const basicPlan = await Plan.findByContributorType('JUNIOR');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const response = await request(app)
        .get('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
      });
    });

    it('should return empty array if user has no connections', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create active subscription
      const basicPlan = await Plan.findByContributorType('JUNIOR');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const response = await request(app)
        .get('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/connections')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/connections', () => {
    it('should create new store connection successfully', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create active subscription
      const basicPlan = await Plan.findByContributorType('JUNIOR');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const connectionData = {
        storeName: 'Test Shopify Store',
        marketplaceType: 'shopify',
        credentials: {
          storeDomain: 'test-store.myshopify.com',
          accessToken: 'test-access-token',
        },
      };

      const response = await request(app)
        .post('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(connectionData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          workspaceId: workspace._id.toString(),
          storeName: connectionData.storeName,
          marketplaces: expect.any(Array),
        }),
      });
    });

    it('should reject connection creation with invalid data', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create active subscription
      const basicPlan = await Plan.findByContributorType('JUNIOR');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const invalidData = {
        // Missing required storeName
        marketplaceType: 'shopify',
        credentials: {
          storeDomain: 'test-store.myshopify.com',
        },
      };

      const response = await request(app)
        .post('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('storeName'),
      });
    });

    it('should reject connection creation with invalid marketplace type', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create active subscription
      const basicPlan = await Plan.findByContributorType('JUNIOR');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const invalidData = {
        storeName: 'Test Store',
        marketplaceType: 'invalid_marketplace',
        credentials: { test: 'value' },
      };

      const response = await request(app)
        .post('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('type'),
      });
    });

    it('should require workspace subscription', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // No subscription created - should fail subscription check

      const connectionData = {
        storeName: 'Test Store',
        marketplaceType: 'shopify',
        credentials: { test: 'value' },
      };

      const response = await request(app)
        .post('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(connectionData)
        .expect(402);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });
  });

  describe('GET /api/connections/:id', () => {
    it('should get specific connection', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create active subscription
      const basicPlan = await Plan.findByContributorType('JUNIOR');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Create a connection first
      const connectionData = {
        storeName: 'Test Store',
        marketplaces: [
          {
            type: 'shopify',
            credentials: { test: 'value' },
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(connectionData)
        .expect(201);

      const connectionId = createResponse.body.data._id;

      const response = await request(app)
        .get(`/api/connections/${connectionId}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          _id: connectionId,
          storeName: connectionData.storeName,
        }),
      });
    });

    it('should return 404 for non-existent connection', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      const { Types } = require('mongoose');
      const nonExistentId = new Types.ObjectId();

      const response = await request(app)
        .get(`/api/connections/${nonExistentId}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Connection not found',
      });
    });
  });

  describe('PUT /api/connections/:id', () => {
    it('should update connection successfully', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create active subscription
      const basicPlan = await Plan.findByContributorType('JUNIOR');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Create connection
      const connectionData = {
        storeName: 'Original Store',
        marketplaces: [
          {
            type: 'shopify',
            credentials: { test: 'value' },
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(connectionData)
        .expect(201);

      const connectionId = createResponse.body.data._id;

      // Update connection
      const updateData = {
        storeName: 'Updated Store Name',
        isActive: true,
      };

      const response = await request(app)
        .put(`/api/connections/${connectionId}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          storeName: updateData.storeName,
          isActive: updateData.isActive,
        }),
      });
    });

    it('should return 404 for non-existent connection', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      const { Types } = require('mongoose');
      const nonExistentId = new Types.ObjectId();

      const updateData = {
        storeName: 'Updated Store',
      };

      const response = await request(app)
        .put(`/api/connections/${nonExistentId}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(updateData)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Connection not found',
      });
    });
  });

  describe('DELETE /api/connections/:id', () => {
    it('should soft delete connection (mark as inactive)', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create active subscription
      const basicPlan = await Plan.findByContributorType('JUNIOR');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Create connection
      const connectionData = {
        storeName: 'Store to Delete',
        marketplaces: [
          {
            type: 'shopify',
            credentials: { test: 'value' },
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(connectionData)
        .expect(201);

      const connectionId = createResponse.body.data._id;

      // Delete connection (soft delete by default)
      const response = await request(app)
        .delete(`/api/connections/${connectionId}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Marketplace connection disconnected successfully',
        data: expect.objectContaining({
          productsPreserved: true,
          deletedProductsCount: 0,
        }),
      });
    });

    it('should hard delete connection with deleteProducts=true', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create active subscription
      const basicPlan = await Plan.findByContributorType('JUNIOR');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Create connection
      const connectionData = {
        storeName: 'Store to Delete',
        marketplaces: [
          {
            type: 'shopify',
            credentials: { test: 'value' },
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(connectionData)
        .expect(201);

      const connectionId = createResponse.body.data._id;

      // Delete connection with products
      const response = await request(app)
        .delete(`/api/connections/${connectionId}?deleteProducts=true`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('Marketplace connection deleted successfully'),
        data: expect.objectContaining({
          productsPreserved: false,
          deletedProductsCount: expect.any(Number),
        }),
      });
    });

    it('should return 404 for non-existent connection', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      const { Types } = require('mongoose');
      const nonExistentId = new Types.ObjectId();

      const response = await request(app)
        .delete(`/api/connections/${nonExistentId}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Connection not found',
      });
    });
  });

  describe('POST /api/connections/:id/marketplace', () => {
    it('should add marketplace to existing connection', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create active subscription
      const basicPlan = await Plan.findByContributorType('JUNIOR');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Create initial connection
      const connectionData = {
        storeName: 'Test Store',
        marketplaces: [
          {
            type: 'shopify',
            credentials: { test: 'value' },
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(connectionData)
        .expect(201);

      const connectionId = createResponse.body.data._id;

      // Add another marketplace
      const marketplaceData = {
        type: 'vtex',
        credentials: {
          account_name: 'test-account',
          app_key: 'test-key',
          app_token: 'test-token',
        },
      };

      const response = await request(app)
        .post(`/api/connections/${connectionId}/marketplace`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(marketplaceData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Object),
      });
    });

    it('should reject invalid marketplace type', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create active subscription
      const basicPlan = await Plan.findByContributorType('JUNIOR');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Create connection
      const connectionData = {
        storeName: 'Test Store',
        marketplaces: [
          {
            type: 'shopify',
            credentials: { test: 'value' },
          },
        ],
      };

      const createResponse = await request(app)
        .post('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(connectionData)
        .expect(201);

      const connectionId = createResponse.body.data._id;

      // Try to add invalid marketplace
      const invalidMarketplaceData = {
        type: 'invalid_type',
        credentials: { test: 'value' },
      };

      const response = await request(app)
        .post(`/api/connections/${connectionId}/marketplace`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(invalidMarketplaceData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('type'),
      });
    });
  });

  describe('Subscription and Usage Limits', () => {
    it('should enforce store limits based on subscription plan', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create BASIC subscription with limit of 1 store
      const basicPlan = await Plan.findByContributorType('JUNIOR');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Create first connection (should succeed)
      const firstConnectionData = {
        storeName: 'First Store',
        marketplaces: [
          {
            type: 'shopify',
            credentials: { test: 'value1' },
          },
        ],
      };

      await request(app)
        .post('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(firstConnectionData)
        .expect(201);

      // Try to create second connection (should fail due to BASIC plan limit)
      const secondConnectionData = {
        storeName: 'Second Store',
        marketplaces: [
          {
            type: 'vtex',
            credentials: { test: 'value2' },
          },
        ],
      };

      const response = await request(app)
        .post('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(secondConnectionData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });

    it('should allow more stores with PRO subscription', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create PRO subscription with limit of 5 stores
      const proPlan = await Plan.findByContributorType('SENIOR');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: proPlan!._id,
        status: 'ACTIVE',
        amount: proPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Create multiple connections (should succeed with PRO plan)
      const storeNames = ['Store 1', 'Store 2', 'Store 3'];
      
      for (let i = 0; i < storeNames.length; i++) {
        const connectionData = {
          storeName: storeNames[i],
          marketplaces: [
            {
              type: 'shopify',
              credentials: { test: `value${i}` },
            },
          ],
        };

        await request(app)
          .post('/api/connections')
          .set(getAuthHeaders(user.token, workspace._id.toString()))
          .send(connectionData)
          .expect(201);
      }

      // Verify all connections were created
      const response = await request(app)
        .get('/api/connections')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body.data).toHaveLength(3);
    });
  });
});