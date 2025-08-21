require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const connectionRoutes = require('./routes/connections');
const marketplaceRoutes = require('./routes/marketplaces');
const productRoutes = require('./routes/products');
const dashboardRoutes = require('./routes/dashboard');
const optimizationRoutes = require('./routes/optimizations');
const opportunityRoutes = require('./routes/opportunities');
const adminRoutes = require('./routes/admin');
const planRoutes = require('./routes/plans');
const usageRoutes = require('./routes/usage');

const app = express();

connectDB();

// Initialize notification scheduler after database connection
const { initializeNotificationScheduler } = require('./services/notificationScheduler');
let notificationCleanup;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs (increased for development)
});

app.use(helmet());
app.use(cors());
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/marketplaces', marketplaceRoutes);
app.use('/api/products', productRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/optimizations', optimizationRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/usage', usageRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Racky API is running' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
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