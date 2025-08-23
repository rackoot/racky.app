// Register module aliases only for production builds
if (process.env.NODE_ENV === 'production') {
  require('module-alias/register');
}

// Import environment configuration (handles dotenv loading)
import getEnv from '@/common/config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import connectDB from '@/common/config/database';
import errorHandler from '@/common/middleware/errorHandler';

import authRoutes from '@/auth/routes/auth';
import connectionRoutes from '@/stores/routes/connections';
import marketplaceRoutes from '@/marketplaces/routes/marketplaces';
import productRoutes from '@/products/routes/products';
import dashboardRoutes from '@/dashboard/routes/dashboard';
import optimizationRoutes from '@/opportunities/routes/optimizations';
import opportunityRoutes from '@/opportunities/routes/opportunities';
import adminRoutes from '@/admin/routes/admin';
import planRoutes from '@/subscriptions/routes/plans';
import usageRoutes from '@/subscriptions/routes/usage';
import billingRoutes from '@/subscriptions/routes/billing';
import demoRoutes from '@/demo/routes/demo';
import workspaceRoutes from './modules/workspaces/routes/workspaces';
import { initializeNotificationScheduler } from '@/notifications/services/notificationScheduler';
import { protect, requireWorkspace } from '@/common/middleware/auth';


const app = express();

connectDB();

// Initialize notification scheduler after database connection
let notificationCleanup: (() => void) | undefined;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs (increased for development)
});

app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    getEnv().CLIENT_URL
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('tiny'));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes that don't require workspace context
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Workspace management routes (protected but don't require workspace context)
app.use('/api/workspaces', protect, workspaceRoutes);

// Routes that require workspace context
app.use('/api/plans', protect, requireWorkspace, planRoutes);
app.use('/api/connections', protect, requireWorkspace, connectionRoutes);
app.use('/api/marketplaces', protect, requireWorkspace, marketplaceRoutes);
app.use('/api/products', protect, requireWorkspace, productRoutes);
app.use('/api/dashboard', protect, requireWorkspace, dashboardRoutes);
app.use('/api/optimizations', protect, requireWorkspace, optimizationRoutes);
app.use('/api/opportunities', protect, requireWorkspace, opportunityRoutes);
app.use('/api/usage', protect, requireWorkspace, usageRoutes);
app.use('/api/billing', protect, requireWorkspace, billingRoutes);
app.use('/api/demo', protect, requireWorkspace, demoRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'Racky API is running with hot reload!' });
});

app.use(errorHandler);

const PORT = getEnv().PORT;
const server = app.listen(PORT, () => {
  console.log(`Racky server running on port ${PORT}`);
  
  // Initialize notification scheduler after server starts
  setTimeout(() => {
    notificationCleanup = initializeNotificationScheduler();
  }, 2000); // Wait 2 seconds for database to be fully ready
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  if (notificationCleanup) {
    notificationCleanup();
  }
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  if (notificationCleanup) {
    notificationCleanup();
  }
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});