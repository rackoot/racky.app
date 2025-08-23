import request from 'supertest';
import express from 'express';
import { setupTestDb, teardownTestDb, clearTestDb } from '../setup/testDb';
import { createTestUser, getAuthHeaders } from '../helpers/testAuth';
import { testUsers } from '../fixtures/testData';
import authRoutes from '../../modules/auth/routes/auth';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = testUsers.validUser;

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Account created successfully',
        data: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: 'USER',
          token: expect.any(String),
        },
      });

      // Password should not be included in response
      expect(response.body.data.password).toBeUndefined();
    });

    it('should reject registration with invalid email', async () => {
      const invalidUserData = {
        ...testUsers.validUser,
        email: 'invalid-email',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUserData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('email'),
      });
    });

    it('should reject registration with short password', async () => {
      const invalidUserData = {
        ...testUsers.validUser,
        password: '123',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUserData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('password'),
      });
    });

    it('should reject registration with existing email', async () => {
      const userData = testUsers.validUser;

      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'User already exists',
      });
    });

    it('should reject registration with missing required fields', async () => {
      const incompleteUserData = {
        email: testUsers.validUser.email,
        // Missing password, firstName, lastName
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteUserData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;

    beforeEach(async () => {
      testUser = await createTestUser(testUsers.validUser);
    });

    it('should login user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.validUser.email,
          password: testUsers.validUser.password,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        data: {
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role,
          token: expect.any(String),
        },
      });
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUsers.validUser.password,
        })
        .expect(401);

      expect(response.body).toMatchObject({
        message: 'Invalid credentials',
      });
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toMatchObject({
        message: 'Invalid credentials',
      });
    });

    it('should reject login with malformed request', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email-format',
          password: testUsers.validUser.password,
        })
        .expect(400);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('email'),
      });
    });
  });

  describe('GET /api/auth/me', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;

    beforeEach(async () => {
      testUser = await createTestUser(testUsers.validUser);
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set(getAuthHeaders(testUser.token))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          _id: testUser._id.toString(),
          email: testUser.email,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
          role: testUser.role,
        },
      });

      // Ensure password is not returned
      expect(response.body.data.password).toBeUndefined();
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'No token provided',
      });
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid token',
      });
    });

    it('should reject request with malformed token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'No token provided',
      });
    });
  });

  describe('PUT /api/auth/profile', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;

    beforeEach(async () => {
      testUser = await createTestUser(testUsers.validUser);
    });

    it('should update user profile successfully', async () => {
      const updatedData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com',
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set(getAuthHeaders(testUser.token))
        .send(updatedData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Profile updated successfully',
        data: {
          firstName: updatedData.firstName,
          lastName: updatedData.lastName,
          email: updatedData.email,
        },
      });
    });

    it('should reject profile update without authentication', async () => {
      const updatedData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com',
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .send(updatedData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Not authorized, no token',
      });
    });

    it('should reject profile update with invalid email', async () => {
      const invalidData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'invalid-email',
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set(getAuthHeaders(testUser.token))
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('email'),
      });
    });
  });

  describe('PUT /api/auth/password', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;

    beforeEach(async () => {
      testUser = await createTestUser(testUsers.validUser);
    });

    it('should update password successfully', async () => {
      const passwordData = {
        currentPassword: testUsers.validUser.password,
        newPassword: 'newPassword123',
      };

      const response = await request(app)
        .put('/api/auth/password')
        .set(getAuthHeaders(testUser.token))
        .send(passwordData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Password updated successfully',
      });
    });

    it('should reject password update with wrong current password', async () => {
      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newPassword123',
      };

      const response = await request(app)
        .put('/api/auth/password')
        .set(getAuthHeaders(testUser.token))
        .send(passwordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Current password is incorrect',
      });
    });

    it('should reject password update without authentication', async () => {
      const passwordData = {
        currentPassword: testUsers.validUser.password,
        newPassword: 'newPassword123',
      };

      const response = await request(app)
        .put('/api/auth/password')
        .send(passwordData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Not authorized, no token',
      });
    });

    it('should reject password update with short new password', async () => {
      const passwordData = {
        currentPassword: testUsers.validUser.password,
        newPassword: '123',
      };

      const response = await request(app)
        .put('/api/auth/password')
        .set(getAuthHeaders(testUser.token))
        .send(passwordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('newPassword'),
      });
    });
  });
});