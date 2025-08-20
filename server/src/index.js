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

const app = express();

connectDB();

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Racky API is running' });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Racky server running on port ${PORT}`);
});