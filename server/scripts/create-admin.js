require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/modules/auth/models/User.ts').default;

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB');

    console.log('👑 Setting up Super Admin...');
    
    const existingSuperAdmin = await User.findOne({ email: 'admin@racky.app' });
    
    if (existingSuperAdmin) {
      existingSuperAdmin.role = 'SUPERADMIN';
      existingSuperAdmin.subscriptionStatus = 'ACTIVE';
      existingSuperAdmin.isActive = true;
      await existingSuperAdmin.save();
      console.log('✅ Updated existing user to SUPERADMIN role');
    } else {
      const superAdmin = await User.create({
        email: 'admin@racky.app',
        password: 'admin123!',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPERADMIN',
        subscriptionStatus: 'ACTIVE',
        subscriptionPlan: 'ENTERPRISE'
      });
      console.log('✅ Created new SUPERADMIN user');
      console.log(`   📧 Email: ${superAdmin.email}`);
      console.log(`   🔑 Password: admin123!`);
    }

    await mongoose.disconnect();
    console.log('✅ Admin setup complete!');
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
};

// Solo ejecutar si es llamado directamente
if (require.main === module) {
  createAdmin();
}

module.exports = createAdmin;