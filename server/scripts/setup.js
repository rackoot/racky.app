require("dotenv").config();
const createAdmin = require("./create-admin");
const createPlans = require("./create-plans");

const setup = async () => {
  console.log("🚀 Initializing Racky Contributor-Based Platform...\n");

  try {
    // Paso 1: Crear super admin
    console.log("📋 Step 1: Creating Super Admin");
    await createAdmin();
    console.log("");

    // Paso 2: Crear planes de contribuidores
    console.log("📋 Step 2: Creating Contributor Plans");
    await createPlans();
    console.log("");

    // Resumen final
    console.log("🎉 ============================================");
    console.log("🎉 RACKY SETUP COMPLETED SUCCESSFULLY!");
    console.log("🎉 ============================================\n");

    console.log("🔐 Super Admin Account:");
    console.log("   📧 Email: admin@racky.app");
    console.log("   🔑 Password: admin123!\n");

    console.log("🤖 Contributor Plans Created:");
    console.log("   💼 Junior Contributor: $99/month each");
    console.log("   🎯 Senior Contributor: $199/month each");
    console.log("   👑 Executive Contributor: Contact Sales (Unlimited)\n");

    console.log("✅ Next Steps:");
    console.log("   1. Start the server: npm run dev");
    console.log("   2. Visit: http://localhost:5173/pricing");
    console.log("   3. Login as admin: http://localhost:5173/login");
    console.log("   4. Configure Stripe price IDs for live billing");
    console.log("   5. Test contributor hiring flow\n");

    console.log("🌐 Your contributor-based marketplace platform is ready!");
  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }
};

setup();
