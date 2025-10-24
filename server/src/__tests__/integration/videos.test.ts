import request from 'supertest';
import express from 'express';
import { setupTestDb, teardownTestDb, clearTestDb } from '../setup/testDb';
import { createTestUserWithWorkspace } from '../helpers/testAuth';
import internalVideoRoutes from '../../modules/videos/routes/internal';
import { AIVideo } from '../../modules/videos/models/AIVideo';
import Product from '../../modules/products/models/Product';
import { Types } from 'mongoose';

// Create test app for internal webhook routes
const app = express();
app.use(express.json());
app.use('/internal', internalVideoRoutes);

describe('Video Webhook Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  describe('POST /internal/videos/success', () => {
    it('should update AIVideo record successfully with all fields', async () => {
      // Create test user and workspace
      const { user, workspace } = await createTestUserWithWorkspace();

      // Create test product
      const product = await Product.create({
        userId: user._id,
        workspaceId: workspace._id,
        title: 'Test Product',
        marketplace: 'shopify',
        externalId: 'test-123',
        sku: 'TEST-SKU',
        price: 99.99,
        images: [{ url: 'https://example.com/image.jpg', isPrimary: true }],
      });

      // Create test AIVideo
      const video = await AIVideo.create({
        userId: user._id,
        workspaceId: workspace._id,
        productId: product._id,
        template: 'product_showcase',
        status: 'generating',
        metadata: {
          externalJobId: 'job_12345'
        }
      });

      const webhookPayload = {
        videoId: video._id.toString(),
        youtubeVideoId: 'dQw4w9WgXcQ',
        localFilename: 'videos/test_video.mp4',
        video_url: 'https://example.com/videos/test.mp4'
      };

      const response = await request(app)
        .post('/internal/videos/success')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Video status updated successfully',
        data: {
          videoId: video._id.toString(),
          youtubeVideoId: 'dQw4w9WgXcQ',
          localFilename: 'videos/test_video.mp4',
          videoUrl: 'https://example.com/videos/test.mp4',
          productId: product._id.toString()
        }
      });

      // Verify AIVideo was updated
      const updatedVideo = await AIVideo.findById(video._id);
      expect(updatedVideo).toBeDefined();
      expect(updatedVideo!.status).toBe('completed');
      expect(updatedVideo!.metadata.youtubeVideoId).toBe('dQw4w9WgXcQ');
      expect(updatedVideo!.metadata.localFilename).toBe('videos/test_video.mp4');
      expect(updatedVideo!.metadata.videoUrl).toBe('https://example.com/videos/test.mp4');
      expect(updatedVideo!.metadata.completedAt).toBeDefined();
    });

    it('should update Product.videos array for dual storage', async () => {
      // Create test user and workspace
      const { user, workspace } = await createTestUserWithWorkspace();

      // Create test product with a pending video
      const product = await Product.create({
        userId: user._id,
        workspaceId: workspace._id,
        title: 'Test Product',
        marketplace: 'shopify',
        externalId: 'test-123',
        sku: 'TEST-SKU',
        price: 99.99,
        videos: [{
          templateId: new Types.ObjectId(),
          templateName: 'product_showcase',
          status: 'generating',
          createdAt: new Date()
        }]
      });

      // Create test AIVideo
      const video = await AIVideo.create({
        userId: user._id,
        workspaceId: workspace._id,
        productId: product._id,
        template: 'product_showcase',
        status: 'generating'
      });

      const webhookPayload = {
        videoId: video._id.toString(),
        youtubeVideoId: 'dQw4w9WgXcQ',
        video_url: 'https://example.com/videos/test.mp4'
      };

      await request(app)
        .post('/internal/videos/success')
        .send(webhookPayload)
        .expect(200);

      // Verify Product.videos array was updated
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct).toBeDefined();
      expect(updatedProduct!.videos).toHaveLength(1);
      expect(updatedProduct!.videos[0].status).toBe('completed');
      expect(updatedProduct!.videos[0].videoUrl).toBe('https://example.com/videos/test.mp4');
      expect(updatedProduct!.videos[0].youtubeUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(updatedProduct!.videos[0].completedAt).toBeDefined();
    });

    it('should reject request without videoId', async () => {
      const webhookPayload = {
        youtubeVideoId: 'dQw4w9WgXcQ',
        localFilename: 'videos/test_video.mp4'
      };

      const response = await request(app)
        .post('/internal/videos/success')
        .send(webhookPayload)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'videoId is required'
      });
    });

    it('should reject request with invalid videoId format', async () => {
      const webhookPayload = {
        videoId: 'invalid-id-format',
        youtubeVideoId: 'dQw4w9WgXcQ'
      };

      const response = await request(app)
        .post('/internal/videos/success')
        .send(webhookPayload)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid videoId format'
      });
    });

    it('should return 404 when video not found', async () => {
      const nonExistentVideoId = new Types.ObjectId();

      const webhookPayload = {
        videoId: nonExistentVideoId.toString(),
        youtubeVideoId: 'dQw4w9WgXcQ'
      };

      const response = await request(app)
        .post('/internal/videos/success')
        .send(webhookPayload)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Video not found'
      });
    });
  });

  describe('POST /internal/videos/failure', () => {
    it('should update AIVideo record as failed', async () => {
      // Create test user and workspace
      const { user, workspace } = await createTestUserWithWorkspace();

      // Create test product
      const product = await Product.create({
        userId: user._id,
        workspaceId: workspace._id,
        title: 'Test Product',
        marketplace: 'shopify',
        externalId: 'test-123',
        sku: 'TEST-SKU',
        price: 99.99
      });

      // Create test AIVideo
      const video = await AIVideo.create({
        userId: user._id,
        workspaceId: workspace._id,
        productId: product._id,
        template: 'product_showcase',
        status: 'generating'
      });

      const webhookPayload = {
        videoId: video._id.toString(),
        error: 'Video generation failed due to insufficient resources'
      };

      const response = await request(app)
        .post('/internal/videos/failure')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Video failure recorded successfully',
        data: {
          videoId: video._id.toString(),
          productId: product._id.toString(),
          error: 'Video generation failed due to insufficient resources'
        }
      });

      // Verify AIVideo was updated
      const updatedVideo = await AIVideo.findById(video._id);
      expect(updatedVideo).toBeDefined();
      expect(updatedVideo!.status).toBe('failed');
      expect(updatedVideo!.error).toBe('Video generation failed due to insufficient resources');
      expect(updatedVideo!.metadata.failedAt).toBeDefined();
    });

    it('should update Product.videos array as failed', async () => {
      // Create test user and workspace
      const { user, workspace } = await createTestUserWithWorkspace();

      // Create test product with a pending video
      const product = await Product.create({
        userId: user._id,
        workspaceId: workspace._id,
        title: 'Test Product',
        marketplace: 'shopify',
        externalId: 'test-123',
        sku: 'TEST-SKU',
        price: 99.99,
        videos: [{
          templateId: new Types.ObjectId(),
          templateName: 'product_showcase',
          status: 'generating',
          createdAt: new Date()
        }]
      });

      // Create test AIVideo
      const video = await AIVideo.create({
        userId: user._id,
        workspaceId: workspace._id,
        productId: product._id,
        template: 'product_showcase',
        status: 'generating'
      });

      const webhookPayload = {
        videoId: video._id.toString(),
        error: 'Processing error'
      };

      await request(app)
        .post('/internal/videos/failure')
        .send(webhookPayload)
        .expect(200);

      // Verify Product.videos array was updated
      const updatedProduct = await Product.findById(product._id);
      expect(updatedProduct).toBeDefined();
      expect(updatedProduct!.videos).toHaveLength(1);
      expect(updatedProduct!.videos[0].status).toBe('failed');
      expect(updatedProduct!.videos[0].error).toBe('Processing error');
      expect(updatedProduct!.videos[0].completedAt).toBeDefined();
    });

    it('should reject request without videoId', async () => {
      const webhookPayload = {
        error: 'Some error message'
      };

      const response = await request(app)
        .post('/internal/videos/failure')
        .send(webhookPayload)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'videoId is required'
      });
    });

    it('should reject request with invalid videoId format', async () => {
      const webhookPayload = {
        videoId: 'not-a-valid-objectid',
        error: 'Some error'
      };

      const response = await request(app)
        .post('/internal/videos/failure')
        .send(webhookPayload)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid videoId format'
      });
    });

    it('should return 404 when video not found', async () => {
      const nonExistentVideoId = new Types.ObjectId();

      const webhookPayload = {
        videoId: nonExistentVideoId.toString(),
        error: 'Some error'
      };

      const response = await request(app)
        .post('/internal/videos/failure')
        .send(webhookPayload)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Video not found'
      });
    });

    it('should use default error message when error field is missing', async () => {
      // Create test user and workspace
      const { user, workspace } = await createTestUserWithWorkspace();

      // Create test product
      const product = await Product.create({
        userId: user._id,
        workspaceId: workspace._id,
        title: 'Test Product',
        marketplace: 'shopify',
        externalId: 'test-123',
        sku: 'TEST-SKU',
        price: 99.99
      });

      // Create test AIVideo
      const video = await AIVideo.create({
        userId: user._id,
        workspaceId: workspace._id,
        productId: product._id,
        template: 'product_showcase',
        status: 'generating'
      });

      const webhookPayload = {
        videoId: video._id.toString()
      };

      await request(app)
        .post('/internal/videos/failure')
        .send(webhookPayload)
        .expect(200);

      // Verify default error message was used
      const updatedVideo = await AIVideo.findById(video._id);
      expect(updatedVideo).toBeDefined();
      expect(updatedVideo!.status).toBe('failed');
      expect(updatedVideo!.error).toBe('Video generation failed');
    });
  });
});
