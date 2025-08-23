import request from 'supertest';
import express from 'express';
import { setupTestDb, teardownTestDb, clearTestDb } from '../setup/testDb';
import { createTestUser, createTestWorkspace, createTestUserWithWorkspace, getAuthHeaders } from '../helpers/testAuth';
import { testWorkspaces, testPlans } from '../fixtures/testData';
import workspacesRoutes from '../../modules/workspaces/routes/workspaces';
import Plan from '../../modules/subscriptions/models/Plan';
import Subscription from '../../modules/subscriptions/models/Subscription';
import { Types } from 'mongoose';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/workspaces', workspacesRoutes);

describe('Workspaces Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDb();
    
    // Create test plans
    await Plan.create(testPlans.basicPlan);
    await Plan.create(testPlans.proPlan);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    
    // Recreate test plans for each test
    await Plan.create(testPlans.basicPlan);
    await Plan.create(testPlans.proPlan);
  });

  describe('GET /api/workspaces', () => {
    it('should get all workspaces for authenticated user', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();

      const response = await request(app)
        .get('/api/workspaces')
        .set(getAuthHeaders(user.token))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workspaces retrieved successfully',
        data: expect.arrayContaining([
          expect.objectContaining({
            name: workspace.name,
            slug: workspace.slug,
          }),
        ]),
      });
    });

    it('should return empty array if user has no workspaces', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .get('/api/workspaces')
        .set(getAuthHeaders(user.token))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workspaces retrieved successfully',
        data: [],
      });
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/workspaces')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/workspaces', () => {
    it('should create a new workspace successfully', async () => {
      const user = await createTestUser();
      const workspaceData = testWorkspaces.validWorkspace;

      const response = await request(app)
        .post('/api/workspaces')
        .set(getAuthHeaders(user.token))
        .send(workspaceData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workspace created successfully',
        data: expect.objectContaining({
          name: workspaceData.name,
          description: workspaceData.description,
          slug: expect.any(String),
          settings: workspaceData.settings,
          owner: expect.objectContaining({
            _id: user._id.toString(),
          }),
        }),
      });
    });

    it('should create workspace with auto-generated slug', async () => {
      const user = await createTestUser();
      const workspaceData = {
        name: 'Test Workspace With Spaces & Special!@# Characters',
        description: 'Test description',
      };

      const response = await request(app)
        .post('/api/workspaces')
        .set(getAuthHeaders(user.token))
        .send(workspaceData)
        .expect(201);

      expect(response.body.data.slug).toMatch(/^[a-z0-9-]+$/);
      expect(response.body.data.slug).not.toContain(' ');
      expect(response.body.data.slug).not.toContain('!');
      expect(response.body.data.slug).not.toContain('@');
    });

    it('should reject workspace creation with invalid data', async () => {
      const user = await createTestUser();
      const invalidWorkspaceData = testWorkspaces.invalidWorkspace;

      const response = await request(app)
        .post('/api/workspaces')
        .set(getAuthHeaders(user.token))
        .send(invalidWorkspaceData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation error',
        error: expect.stringContaining('name'),
      });
    });

    it('should reject workspace creation without authentication', async () => {
      const workspaceData = testWorkspaces.validWorkspace;

      const response = await request(app)
        .post('/api/workspaces')
        .send(workspaceData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/workspaces/:workspaceId', () => {
    it('should get specific workspace', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();

      const response = await request(app)
        .get(`/api/workspaces/${workspace._id}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workspace retrieved successfully',
        data: expect.objectContaining({
          _id: workspace._id.toString(),
          name: workspace.name,
          slug: workspace.slug,
        }),
      });
    });

    it('should return 404 for non-existent workspace', async () => {
      const user = await createTestUser();
      const nonExistentId = new Types.ObjectId();

      const response = await request(app)
        .get(`/api/workspaces/${nonExistentId}`)
        .set(getAuthHeaders(user.token))
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Workspace not found or inactive',
      });
    });
  });

  describe('PUT /api/workspaces/:workspaceId', () => {
    it('should update workspace successfully', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      const updateData = {
        name: 'Updated Workspace Name',
        description: 'Updated description',
        settings: {
          timezone: 'America/New_York',
          currency: 'EUR',
          language: 'es',
        },
      };

      const response = await request(app)
        .put(`/api/workspaces/${workspace._id}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workspace updated successfully',
        data: expect.objectContaining({
          name: updateData.name,
          description: updateData.description,
          settings: updateData.settings,
        }),
      });
    });

    it('should reject update with invalid data', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      const invalidUpdateData = {
        name: '', // Empty name should fail validation
      };

      const response = await request(app)
        .put(`/api/workspaces/${workspace._id}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation error',
      });
    });
  });

  describe('DELETE /api/workspaces/:workspaceId', () => {
    it('should delete workspace successfully as owner', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();

      const response = await request(app)
        .delete(`/api/workspaces/${workspace._id}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workspace deleted successfully',
      });
    });

    it('should return 404 for non-existent workspace', async () => {
      const user = await createTestUser();
      const nonExistentId = new Types.ObjectId();

      const response = await request(app)
        .delete(`/api/workspaces/${nonExistentId}`)
        .set(getAuthHeaders(user.token))
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Workspace not found or inactive',
      });
    });
  });

  describe('GET /api/workspaces/:workspaceId/subscription', () => {
    it('should get workspace subscription info', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create a subscription for the workspace
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
        .get(`/api/workspaces/${workspace._id}/subscription`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workspace subscription retrieved successfully',
        data: expect.objectContaining({
          workspaceId: workspace._id.toString(),
          hasActiveSubscription: true,
          currentPlan: expect.objectContaining({
            name: 'BASIC',
          }),
          limits: expect.objectContaining({
            maxStores: 1,
            maxProducts: 100,
          }),
        }),
      });
    });

    it('should handle workspace without subscription', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();

      const response = await request(app)
        .get(`/api/workspaces/${workspace._id}/subscription`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workspace subscription retrieved successfully',
        data: expect.objectContaining({
          workspaceId: workspace._id.toString(),
          hasActiveSubscription: false,
          currentPlan: null,
          limits: null,
        }),
      });
    });
  });

  describe('PUT /api/workspaces/:workspaceId/subscription', () => {
    it('should create workspace subscription', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      const subscriptionData = {
        planName: 'PRO',
        billingCycle: 'monthly',
      };

      const response = await request(app)
        .put(`/api/workspaces/${workspace._id}/subscription`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(subscriptionData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workspace subscription updated to PRO plan',
        data: expect.objectContaining({
          workspaceId: workspace._id.toString(),
          subscription: expect.objectContaining({
            status: 'ACTIVE',
          }),
          plan: expect.objectContaining({
            name: 'PRO',
          }),
        }),
      });
    });

    it('should update existing workspace subscription', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create initial subscription
      const basicPlan = await Plan.findByName('BASIC');
      await Subscription.create({
        workspaceId: workspace._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const updateData = {
        planName: 'PRO',
        billingCycle: 'annual',
      };

      const response = await request(app)
        .put(`/api/workspaces/${workspace._id}/subscription`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(updateData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workspace subscription updated to PRO plan',
        data: expect.objectContaining({
          subscription: expect.objectContaining({
            status: 'ACTIVE',
          }),
          plan: expect.objectContaining({
            name: 'PRO',
          }),
        }),
      });
    });

    it('should reject invalid plan name', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      const invalidData = {
        planName: 'INVALID_PLAN',
      };

      const response = await request(app)
        .put(`/api/workspaces/${workspace._id}/subscription`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation error',
      });
    });
  });

  describe('DELETE /api/workspaces/:workspaceId/subscription', () => {
    it('should cancel workspace subscription', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create subscription to cancel
      const basicPlan = await Plan.findByName('BASIC');
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
        .delete(`/api/workspaces/${workspace._id}/subscription`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workspace subscription cancelled successfully',
        data: expect.objectContaining({
          subscription: expect.objectContaining({
            status: 'CANCELLED',
            cancelledAt: expect.any(String),
          }),
        }),
      });
    });

    it('should return 404 if no active subscription exists', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();

      const response = await request(app)
        .delete(`/api/workspaces/${workspace._id}/subscription`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'No active subscription found for this workspace',
      });
    });
  });

  describe('GET /api/workspaces/:workspaceId/usage', () => {
    it('should get workspace usage statistics', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();
      
      // Create subscription for usage limits
      const basicPlan = await Plan.findByName('BASIC');
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
        .get(`/api/workspaces/${workspace._id}/usage`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Workspace usage retrieved successfully',
        data: expect.objectContaining({
          workspaceId: workspace._id.toString(),
          workspaceName: workspace.name,
          currentPeriod: expect.objectContaining({
            month: expect.any(String),
            apiCalls: expect.any(Number),
            productSyncs: expect.any(Number),
            storesConnected: expect.any(Number),
            totalProducts: expect.any(Number),
          }),
          limits: expect.objectContaining({
            maxStores: 1,
            maxProducts: 100,
            apiCallsPerMonth: 1000,
          }),
          percentageUsed: expect.objectContaining({
            stores: expect.any(Number),
            products: expect.any(Number),
            apiCalls: expect.any(Number),
          }),
        }),
      });
    });

    it('should handle workspace without subscription for usage', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();

      const response = await request(app)
        .get(`/api/workspaces/${workspace._id}/usage`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body.data).toMatchObject({
        limits: null,
        percentageUsed: null,
      });
    });
  });

  describe('Workspace Members Management', () => {
    describe('GET /api/workspaces/:workspaceId/members', () => {
      it('should get workspace members', async () => {
        const { user, workspace } = await createTestUserWithWorkspace();

        const response = await request(app)
          .get(`/api/workspaces/${workspace._id}/members`)
          .set(getAuthHeaders(user.token, workspace._id.toString()))
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: 'Workspace members retrieved successfully',
          data: expect.arrayContaining([
            expect.objectContaining({
              role: 'OWNER',
              user: expect.objectContaining({
                _id: user._id.toString(),
              }),
            }),
          ]),
        });
      });
    });

    describe('POST /api/workspaces/:workspaceId/invite', () => {
      it('should invite user to workspace', async () => {
        const { user, workspace } = await createTestUserWithWorkspace();
        
        // Create user to invite
        const userToInvite = await createTestUser({
          email: 'newmember@example.com',
        });
        
        const inviteData = {
          email: userToInvite.email,
          role: 'OPERATOR',
          message: 'Welcome to our workspace!',
        };

        const response = await request(app)
          .post(`/api/workspaces/${workspace._id}/invite`)
          .set(getAuthHeaders(user.token, workspace._id.toString()))
          .send(inviteData)
          .expect(201);

        expect(response.body).toMatchObject({
          success: true,
          message: 'User invited successfully',
          data: expect.objectContaining({
            role: inviteData.role,
            user: expect.objectContaining({
              email: inviteData.email,
            }),
          }),
        });
      });

      it('should reject invalid role in invite', async () => {
        const { user, workspace } = await createTestUserWithWorkspace();
        const invalidInviteData = {
          email: 'newmember@example.com',
          role: 'INVALID_ROLE',
        };

        const response = await request(app)
          .post(`/api/workspaces/${workspace._id}/invite`)
          .set(getAuthHeaders(user.token, workspace._id.toString()))
          .send(invalidInviteData)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          message: 'Validation error',
        });
      });
    });
  });
});