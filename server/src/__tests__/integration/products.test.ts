import request from 'supertest';
import express from 'express';
import { setupTestDb, teardownTestDb, clearTestDb } from '../setup/testDb';
import { createTestUserWithWorkspace, getAuthHeaders } from '../helpers/testAuth';
import { testProducts, testPlans } from '../fixtures/testData';
import productRoutes from '../../modules/products/routes/products';
import { protect, requireWorkspace } from '../../common/middleware/auth';
import Product from '../../modules/products/models/Product';
import StoreConnection from '../../modules/stores/models/StoreConnection';
import Plan from '../../modules/subscriptions/models/Plan';
import Subscription from '../../modules/subscriptions/models/Subscription';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/products', protect, requireWorkspace, productRoutes);

describe('Products Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    
    // Create test plans
    await Plan.create(testPlans.basicPlan);
    await Plan.create(testPlans.proPlan);
  });

  async function createTestProductSetup() {
    const { user, workspace } = await createTestUserWithWorkspace();
    
    // Create active subscription
    const basicPlan = await Plan.findByContributorType('JUNIOR');
    const subscription = await Subscription.create({
      workspaceId: workspace._id,
      planId: basicPlan!._id,
      status: 'ACTIVE',
      amount: basicPlan!.monthlyPrice,
      interval: 'month',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // Create store connection
    const storeConnection = await StoreConnection.create({
      workspaceId: workspace._id,
      storeName: 'Test Store',
      marketplaceType: 'shopify',
      credentials: {
        storeDomain: 'test-store.myshopify.com',
        accessToken: 'test-token',
      },
      isActive: true,
    });

    return { user, workspace, subscription, storeConnection };
  }

  describe('GET /api/products', () => {
    it('should get all products with pagination', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      // Create test products
      const products = await Promise.all([
        Product.create({
          ...testProducts.basicProduct,
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
        Product.create({
          ...testProducts.basicProduct,
          title: 'Second Product',
          sku: 'TEST-SKU-002',
          externalId: 'test-product-456',
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
      ]);

      const response = await request(app)
        .get('/api/products')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          products: expect.arrayContaining([
            expect.objectContaining({
              title: testProducts.basicProduct.title,
              sku: testProducts.basicProduct.sku,
            }),
            expect.objectContaining({
              title: 'Second Product',
              sku: 'TEST-SKU-002',
            }),
          ]),
          pagination: expect.objectContaining({
            currentPage: 1,
            totalCount: 2,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          }),
          filters: expect.objectContaining({
            marketplaces: expect.any(Array),
          }),
        }),
      });
    });

    it('should support search functionality', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      // Create test products
      await Promise.all([
        Product.create({
          ...testProducts.basicProduct,
          title: 'Unique Product Name',
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
        Product.create({
          ...testProducts.basicProduct,
          title: 'Another Product',
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
      ]);

      const response = await request(app)
        .get('/api/products?search=Unique')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body.data.products).toHaveLength(1);
      expect(response.body.data.products[0].title).toContain('Unique');
    });

    it('should support marketplace filtering', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      // Create products for different marketplaces
      await Promise.all([
        Product.create({
          ...testProducts.basicProduct,
          marketplace: 'shopify',
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
        Product.create({
          ...testProducts.basicProduct,
          title: 'VTEX Product',
          marketplace: 'vtex',
          externalId: 'vtex-123',
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
      ]);

      const response = await request(app)
        .get('/api/products?marketplace=vtex')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body.data.products).toHaveLength(1);
      expect(response.body.data.products[0].marketplace).toBe('vtex');
    });

    it('should support pagination', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      // Create multiple products
      const products = [];
      for (let i = 1; i <= 25; i++) {
        products.push(
          Product.create({
            ...testProducts.basicProduct,
            title: `Product ${i}`,
            sku: `SKU-${i.toString().padStart(3, '0')}`,
            externalId: `external-${i}`,
            workspaceId: workspace._id,
            storeConnectionId: storeConnection._id,
          })
        );
      }
      await Promise.all(products);

      // Test first page
      const firstPageResponse = await request(app)
        .get('/api/products?page=1&limit=10')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(firstPageResponse.body.data.products).toHaveLength(10);
      expect(firstPageResponse.body.data.pagination).toMatchObject({
        currentPage: 1,
        totalPages: 3,
        totalCount: 25,
        hasNext: true,
        hasPrev: false,
      });

      // Test second page
      const secondPageResponse = await request(app)
        .get('/api/products?page=2&limit=10')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(secondPageResponse.body.data.products).toHaveLength(10);
      expect(secondPageResponse.body.data.pagination).toMatchObject({
        currentPage: 2,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should support sorting', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      // Create products with different prices
      await Promise.all([
        Product.create({
          ...testProducts.basicProduct,
          title: 'Expensive Product',
          price: 99.99,
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
        Product.create({
          ...testProducts.basicProduct,
          title: 'Cheap Product',
          price: 9.99,
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
      ]);

      // Sort by price ascending
      const response = await request(app)
        .get('/api/products?sortBy=price&sortOrder=asc')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      const products = response.body.data.products;
      expect(products[0].price).toBeLessThan(products[1].price);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should get single product by ID', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      const product = await Product.create({
        ...testProducts.basicProduct,
        workspaceId: workspace._id,
        storeConnectionId: storeConnection._id,
      });

      const response = await request(app)
        .get(`/api/products/${product._id}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          _id: product._id.toString(),
          title: testProducts.basicProduct.title,
          price: testProducts.basicProduct.price,
          platforms: expect.any(Object),
          variants: expect.any(Array),
          tags: expect.any(Array),
          images: expect.any(Array),
        }),
      });
    });

    it('should return 404 for non-existent product', async () => {
      const { user, workspace } = await createTestProductSetup();
      const { Types } = require('mongoose');
      const nonExistentId = new Types.ObjectId();

      const response = await request(app)
        .get(`/api/products/${nonExistentId}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Product not found',
      });
    });

    it('should not allow access to products from other workspaces', async () => {
      const { user: user1, workspace: workspace1, storeConnection: store1 } = await createTestProductSetup();
      const { user: user2, workspace: workspace2 } = await createTestUserWithWorkspace();

      // Create subscription for second workspace
      const basicPlan = await Plan.findByContributorType('JUNIOR');
      await Subscription.create({
        workspaceId: workspace2._id,
        planId: basicPlan!._id,
        status: 'ACTIVE',
        amount: basicPlan!.monthlyPrice,
        interval: 'month',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Create product in first workspace
      const product = await Product.create({
        ...testProducts.basicProduct,
        workspaceId: workspace1._id,
        storeConnectionId: store1._id,
      });

      // Try to access with second user
      const response = await request(app)
        .get(`/api/products/${product._id}`)
        .set(getAuthHeaders(user2.token, workspace2._id.toString()))
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Product not found',
      });
    });
  });

  describe('GET /api/products/store/:connectionId', () => {
    it('should get products for specific store connection', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      // Create another store connection
      const anotherStore = await StoreConnection.create({
        workspaceId: workspace._id,
        storeName: 'Another Store',
        marketplaceType: 'vtex',
        credentials: { test: 'value' },
        isActive: true,
      });

      // Create products for both stores
      await Promise.all([
        Product.create({
          ...testProducts.basicProduct,
          title: 'Product in First Store',
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
        Product.create({
          ...testProducts.basicProduct,
          title: 'Product in Second Store',
          workspaceId: workspace._id,
          storeConnectionId: anotherStore._id,
        }),
      ]);

      const response = await request(app)
        .get(`/api/products/store/${storeConnection._id}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Product in First Store');
    });

    it('should return 404 for non-existent store connection', async () => {
      const { user, workspace } = await createTestProductSetup();
      const { Types } = require('mongoose');
      const nonExistentId = new Types.ObjectId();

      const response = await request(app)
        .get(`/api/products/store/${nonExistentId}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Store connection not found',
      });
    });
  });

  describe('GET /api/products/store/:connectionId/count', () => {
    it('should get product count for store connection', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      // Create products
      await Promise.all([
        Product.create({
          ...testProducts.basicProduct,
          title: 'Product 1',
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
        Product.create({
          ...testProducts.basicProduct,
          title: 'Product 2',
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
      ]);

      const response = await request(app)
        .get(`/api/products/store/${storeConnection._id}/count`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          hasProducts: true,
          count: 2,
        },
      });
    });

    it('should return zero count for store with no products', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      const response = await request(app)
        .get(`/api/products/store/${storeConnection._id}/count`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          hasProducts: false,
          count: 0,
        },
      });
    });
  });

  describe('PATCH /api/products/:id/description', () => {
    it('should update product description', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      const product = await Product.create({
        ...testProducts.basicProduct,
        workspaceId: workspace._id,
        storeConnectionId: storeConnection._id,
      });

      const newDescription = 'Updated product description';

      const response = await request(app)
        .patch(`/api/products/${product._id}/description`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send({ description: newDescription })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Product description updated successfully',
        data: {
          description: newDescription,
        },
      });

      // Verify the product was updated in the database
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct!.description).toBe(newDescription);
    });

    it('should return 404 for non-existent product', async () => {
      const { user, workspace } = await createTestProductSetup();
      const { Types } = require('mongoose');
      const nonExistentId = new Types.ObjectId();

      const response = await request(app)
        .patch(`/api/products/${nonExistentId}/description`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send({ description: 'New description' })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Product not found',
      });
    });
  });

  describe('POST /api/products/sync/:connectionId', () => {
    it('should handle sync request for valid connection', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      const response = await request(app)
        .post(`/api/products/sync/${storeConnection._id}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send({ force: false })
        .expect(500); // Expected to fail since we don't have actual API credentials

      expect(response.body).toMatchObject({
        success: false,
        message: 'Failed to sync products',
        error: expect.any(String),
      });
    });

    it('should return 404 for non-existent connection', async () => {
      const { user, workspace } = await createTestProductSetup();
      const { Types } = require('mongoose');
      const nonExistentId = new Types.ObjectId();

      const response = await request(app)
        .post(`/api/products/sync/${nonExistentId}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send({ force: false })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Store connection not found',
      });
    });

    it('should require active subscription for sync', async () => {
      const { user, workspace } = await createTestUserWithWorkspace();

      // Create store connection without subscription
      const storeConnection = await StoreConnection.create({
        workspaceId: workspace._id,
        storeName: 'Test Store',
        marketplaceType: 'shopify',
        credentials: { test: 'value' },
        isActive: true,
      });

      const response = await request(app)
        .post(`/api/products/sync/${storeConnection._id}`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send({ force: false })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });
  });

  describe('POST /api/products/:id/description/apply-to-marketplace', () => {
    it('should require PRO plan for marketplace description updates', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      const product = await Product.create({
        ...testProducts.basicProduct,
        workspaceId: workspace._id,
        storeConnectionId: storeConnection._id,
      });

      const response = await request(app)
        .post(`/api/products/${product._id}/description/apply-to-marketplace`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send({
          description: 'New description',
          marketplace: 'shopify',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });

    it('should work with PRO plan subscription', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      // Upgrade to PRO plan
      const proPlan = await Plan.findByContributorType('SENIOR');
      await Subscription.findOneAndUpdate(
        { workspaceId: workspace._id },
        { planId: proPlan!._id, amount: proPlan!.monthlyPrice }
      );

      const product = await Product.create({
        ...testProducts.basicProduct,
        workspaceId: workspace._id,
        storeConnectionId: storeConnection._id,
      });

      const response = await request(app)
        .post(`/api/products/${product._id}/description/apply-to-marketplace`)
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .send({
          description: 'New description',
          marketplace: 'shopify',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Object),
      });
    });
  });

  describe('Product Data Isolation', () => {
    it('should only return products for authenticated workspace', async () => {
      const { user: user1, workspace: workspace1, storeConnection: store1 } = await createTestProductSetup();
      const { user: user2, workspace: workspace2, storeConnection: store2 } = await createTestProductSetup();

      // Create products in both workspaces
      await Product.create({
        ...testProducts.basicProduct,
        title: 'Workspace 1 Product',
        workspaceId: workspace1._id,
        storeConnectionId: store1._id,
      });

      await Product.create({
        ...testProducts.basicProduct,
        title: 'Workspace 2 Product',
        workspaceId: workspace2._id,
        storeConnectionId: store2._id,
      });

      // User 1 should only see their product
      const response1 = await request(app)
        .get('/api/products')
        .set(getAuthHeaders(user1.token, workspace1._id.toString()))
        .expect(200);

      expect(response1.body.data.products).toHaveLength(1);
      expect(response1.body.data.products[0].title).toBe('Workspace 1 Product');

      // User 2 should only see their product
      const response2 = await request(app)
        .get('/api/products')
        .set(getAuthHeaders(user2.token, workspace2._id.toString()))
        .expect(200);

      expect(response2.body.data.products).toHaveLength(1);
      expect(response2.body.data.products[0].title).toBe('Workspace 2 Product');
    });
  });

  describe('Product Marketplace Statistics', () => {
    it('should provide marketplace filter statistics', async () => {
      const { user, workspace, storeConnection } = await createTestProductSetup();

      // Create products for different marketplaces
      await Promise.all([
        Product.create({
          ...testProducts.basicProduct,
          marketplace: 'shopify',
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
        Product.create({
          ...testProducts.basicProduct,
          title: 'VTEX Product 1',
          marketplace: 'vtex',
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
        Product.create({
          ...testProducts.basicProduct,
          title: 'VTEX Product 2',
          marketplace: 'vtex',
          workspaceId: workspace._id,
          storeConnectionId: storeConnection._id,
        }),
      ]);

      const response = await request(app)
        .get('/api/products')
        .set(getAuthHeaders(user.token, workspace._id.toString()))
        .expect(200);

      const marketplaceStats = response.body.data.filters.marketplaces;
      expect(marketplaceStats).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ marketplace: 'shopify', count: 1 }),
          expect.objectContaining({ marketplace: 'vtex', count: 2 }),
        ])
      );
    });
  });
});