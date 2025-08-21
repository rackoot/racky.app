require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@example.com' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    // Create admin user with SUPERADMIN role
    const adminUser = await User.create({
      email: 'admin@example.com',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'SUPERADMIN',
      subscriptionStatus: 'ACTIVE',
      subscriptionPlan: 'ENTERPRISE'
    });

    console.log('Admin user created successfully:');
    console.log(`Email: ${adminUser.email}`);
    console.log(`ID: ${adminUser._id}`);
    console.log(`Created at: ${adminUser.createdAt}`);

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
};

createAdmin();