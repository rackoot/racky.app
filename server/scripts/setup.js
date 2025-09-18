require('dotenv').config();
const createAdmin = require('./create-admin');
const createPlans = require('./create-plans');
const createTaskTypes = require('./create-task-types');

const setup = async () => {
  console.log('🚀 Initializing Racky Contributor-Based Platform...\n');

  try {
    // Paso 1: Crear super admin
    console.log('📋 Step 1: Creating Super Admin');
    await createAdmin();
    console.log('');

    // Paso 2: Crear planes de contribuidores
    console.log('📋 Step 2: Creating Contributor Plans');
    await createPlans();
    console.log('');

    // Paso 3: Crear tipos de tareas básicas
    console.log('📋 Step 3: Creating Task Types');
    await createTaskTypes();
    console.log('');

    // Resumen final
    console.log('🎉 ============================================');
    console.log('🎉 RACKY SETUP COMPLETED SUCCESSFULLY!');
    console.log('🎉 ============================================\n');

    console.log('🔐 Super Admin Account:');
    console.log('   📧 Email: admin@racky.app');
    console.log('   🔑 Password: admin123!\n');

    console.log('🤖 Contributor Plans Created:');
    console.log('   💼 Junior Contributor: $29/month each (1K actions)');
    console.log('   🎯 Senior Contributor: $79/month each (5K actions)');
    console.log('   👑 Executive Contributor: Contact Sales (Unlimited)\n');

    console.log('🏷️ Task Types Created:');
    console.log('   📦 Product Optimization: 1 unit per task');
    console.log('   🔄 Product Sync: 1 unit per task');
    console.log('   📊 Inventory Update: 1 unit per task');
    console.log('   💰 Price Monitoring: 2 units per task');
    console.log('   📈 Market Analysis: 3 units per task\n');

    console.log('✅ Next Steps:');
    console.log('   1. Start the server: npm run dev');
    console.log('   2. Visit: http://localhost:5173/pricing');
    console.log('   3. Login as admin: http://localhost:5173/login');
    console.log('   4. Test task management: http://localhost:5173/usage');
    console.log('   5. Configure Stripe price IDs for live billing');
    console.log('   6. Test contributor hiring flow\n');

    console.log('🌐 Your contributor-based marketplace platform is ready!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
};

setup();