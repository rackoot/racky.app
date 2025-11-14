const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../src/modules/auth/models/User.ts').default;

/**
 * Generate a permanent JWT token for the Super Admin
 * This token is intended for service-to-service communication
 * and does not expire.
 *
 * WARNING: Store this token securely. Anyone with this token
 * has full SUPERADMIN access to the API.
 */
const generatePermanentToken = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB');

    // Find the super admin user
    const superAdmin = await User.findOne({
      email: 'admin@racky.app',
      role: 'SUPERADMIN'
    });

    if (!superAdmin) {
      console.error('❌ Super admin user not found. Run "node scripts/create-admin.js" first.');
      process.exit(1);
    }

    // Generate token without expiration
    // IMPORTANT: Use 'id' not '_id' to match the protect middleware expectation
    const token = jwt.sign(
      {
        id: superAdmin._id.toString(),
        email: superAdmin.email,
        role: superAdmin.role
      },
      process.env.JWT_SECRET,
      // No expiration - token is permanent
      {}
    );

    console.log('\n✅ Permanent token generated successfully!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔑 PERMANENT ADMIN TOKEN (No Expiration):');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(token);
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('👤 User Details:');
    console.log(`   📧 Email: ${superAdmin.email}`);
    console.log(`   👑 Role: ${superAdmin.role}`);
    console.log(`   🆔 User ID: ${superAdmin._id}`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('⚠️  SECURITY WARNING:');
    console.log('   - This token NEVER expires');
    console.log('   - Store it securely (environment variables, secrets manager)');
    console.log('   - Anyone with this token has full SUPERADMIN access');
    console.log('   - Use only for trusted service-to-service communication\n');
    console.log('📝 Usage Example:');
    console.log('   Authorization: Bearer ' + token.substring(0, 50) + '...\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error generating token:', error);
    process.exit(1);
  }
};

// Solo ejecutar si es llamado directamente
if (require.main === module) {
  generatePermanentToken();
}

module.exports = generatePermanentToken;
