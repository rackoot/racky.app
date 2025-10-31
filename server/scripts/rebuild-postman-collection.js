#!/usr/bin/env node

/**
 * Rebuild Postman Collection - Clean and Unified
 *
 * Creates a clean, organized Postman collection for Racky API with:
 * - Automatic setup flow (login → workspace → connections)
 * - Unified async sync endpoints for VTEX and Shopify
 * - Clear examples with proper filter formats
 * - No duplicate or outdated endpoints
 */

const fs = require('fs');
const path = require('path');

// Collection metadata
const collection = {
  info: {
    name: "Racky API - Clean & Unified",
    description: "Clean Postman collection for Racky marketplace management platform.\n\n**Quick Setup Flow:**\n1. Run 'Login' to authenticate\n2. Run 'Setup Flow' folder to configure workspace and connections\n3. Use marketplace filter endpoints to get categories/brands\n4. Use unified async sync endpoints to sync products\n\n**Key Features:**\n- Auto-saves JWT token, workspace ID, and connection IDs\n- Unified async sync endpoint for both VTEX and Shopify\n- Clear filter format examples (VTEX: numeric IDs, Shopify: strings)\n- Real-time job monitoring",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "base_url", value: "http://localhost:5000/api", type: "string" },
    { key: "jwt_token", value: "", type: "string" },
    { key: "workspace_id", value: "", type: "string" },
    { key: "vtex_connection_id", value: "", type: "string" },
    { key: "shopify_connection_id", value: "", type: "string" },
    { key: "job_id", value: "", type: "string" }
  ],
  item: []
};

// Helper function to create a request
function createRequest(name, method, endpoint, body = null, description = "", tests = "") {
  const request = {
    name,
    request: {
      method,
      header: [
        { key: "Content-Type", value: "application/json" },
        { key: "Authorization", value: "Bearer {{jwt_token}}" },
        { key: "x-workspace-id", value: "{{workspace_id}}" }
      ],
      url: {
        raw: `{{base_url}}${endpoint}`,
        host: ["{{base_url}}"],
        path: endpoint.split('/').filter(p => p)
      }
    },
    response: []
  };

  if (body) {
    request.request.body = {
      mode: "raw",
      raw: JSON.stringify(body, null, 2)
    };
  }

  if (description) {
    request.request.description = description;
  }

  if (tests) {
    request.event = [{
      listen: "test",
      script: {
        type: "text/javascript",
        exec: tests.split('\n')
      }
    }];
  }

  return request;
}

// 1. AUTHENTICATION
const authFolder = {
  name: "1. Authentication",
  description: "User authentication endpoints. Run 'Login' to start - it will automatically save your JWT token.",
  item: [
    createRequest(
      "Register User",
      "POST",
      "/auth/register",
      {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
        password: "password123"
      },
      "Register a new user account. Creates a default workspace automatically.",
      ""
    ),
    createRequest(
      "Login",
      "POST",
      "/auth/login",
      {
        email: "tobias.e.loustau@gmail.com",
        password: "Tobi1234"
      },
      "Login with credentials. **Auto-saves JWT token to {{jwt_token}} variable.**",
      `pm.test("Login successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;

    // Save JWT token
    if (response.data && response.data.token) {
        pm.collectionVariables.set("jwt_token", response.data.token);
        console.log("✅ JWT token saved:", response.data.token.substring(0, 20) + "...");
    }
});`
    )
  ]
};

// Remove auth headers from auth endpoints
authFolder.item.forEach(item => {
  item.request.header = item.request.header.filter(h => h.key !== "Authorization" && h.key !== "x-workspace-id");
});

// 2. SETUP FLOW
const setupFolder = {
  name: "2. Setup Flow",
  description: "**Run these in order after login to auto-configure your environment:**\n\n1. Get Workspaces → Saves workspace_id\n2. Get VTEX Connection → Saves vtex_connection_id\n3. Get Shopify Connection → Saves shopify_connection_id\n\nAfter running this folder, all variables will be ready for testing!",
  item: [
    createRequest(
      "Get Workspaces",
      "GET",
      "/workspaces",
      null,
      "Fetch user's workspaces. **Auto-saves first workspace ID to {{workspace_id}}.**",
      `pm.test("Get workspaces successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;

    // Save first workspace ID
    if (response.data && response.data.length > 0) {
        const workspaceId = response.data[0]._id;
        pm.collectionVariables.set("workspace_id", workspaceId);
        console.log("✅ Workspace ID saved:", workspaceId);
        console.log("   Workspace name:", response.data[0].name);
    }
});`
    ),
    createRequest(
      "Get VTEX Connection",
      "GET",
      "/connections",
      null,
      "Fetch VTEX store connection. **Auto-saves VTEX connection ID to {{vtex_connection_id}}.**",
      `pm.test("Get connections successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;

    // Find and save VTEX connection
    if (response.data && response.data.length > 0) {
        const vtexConn = response.data.find(c => c.marketplaceType === 'vtex');
        if (vtexConn) {
            pm.collectionVariables.set("vtex_connection_id", vtexConn._id);
            console.log("✅ VTEX Connection ID saved:", vtexConn._id);
            console.log("   Store name:", vtexConn.name);
        } else {
            console.log("⚠️  No VTEX connection found");
        }
    }
});`
    ),
    createRequest(
      "Get Shopify Connection",
      "GET",
      "/connections",
      null,
      "Fetch Shopify store connection. **Auto-saves Shopify connection ID to {{shopify_connection_id}}.**",
      `pm.test("Get connections successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;

    // Find and save Shopify connection
    if (response.data && response.data.length > 0) {
        const shopifyConn = response.data.find(c => c.marketplaceType === 'shopify');
        if (shopifyConn) {
            pm.collectionVariables.set("shopify_connection_id", shopifyConn._id);
            console.log("✅ Shopify Connection ID saved:", shopifyConn._id);
            console.log("   Store name:", shopifyConn.name);
        } else {
            console.log("⚠️  No Shopify connection found");
        }
    }
});`
    )
  ]
};

// 3. STORE SETUP (OPTIONAL)
const storeSetupFolder = {
  name: "3. Store Setup (Optional)",
  description: "Optional endpoints to test credentials and create new store connections. Skip if you already have connections configured in Setup Flow.",
  item: []
};

// 4. MARKETPLACE FILTERS
const filtersFolder = {
  name: "4. Marketplace Filters",
  description: "Get categories and brands from marketplaces. Use `includeCount=true` to get product counts (cached for 24h).\n\n**Key Difference:**\n- VTEX returns numeric IDs as values\n- Shopify returns string names as values",
  item: [
    {
      name: "VTEX Filters",
      item: [
        createRequest(
          "Get VTEX Categories",
          "GET",
          "/marketplaces/{{vtex_connection_id}}/categories",
          null,
          "Get all VTEX categories. Returns basic list without product counts.",
          `pm.test("Get categories successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    pm.expect(response.data.marketplace).to.equal("vtex");
    console.log("✅ Found", response.data.totalCount, "categories");
    if (response.data.items.length > 0) {
        console.log("   Example:", response.data.items[0].name, "(ID:", response.data.items[0].value + ")");
    }
});`
        ),
        createRequest(
          "Get VTEX Categories (with count)",
          "GET",
          "/marketplaces/{{vtex_connection_id}}/categories?includeCount=true",
          null,
          "Get VTEX categories WITH product counts. **Cached for 24 hours.** Use these IDs for filtered sync.",
          `pm.test("Get categories with count successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    pm.expect(response.data.includeCount).to.be.true;
    console.log("✅ Found", response.data.totalCount, "categories with products");
    console.log("   Cache source:", response.data.source);
    if (response.data.items.length > 0) {
        console.log("   Top category:", response.data.items[0].name,
                    "(" + response.data.items[0].productCount + " products)");
    }
});`
        ),
        createRequest(
          "Get VTEX Brands",
          "GET",
          "/marketplaces/{{vtex_connection_id}}/brands",
          null,
          "Get all VTEX brands. Returns basic list without product counts.",
          `pm.test("Get brands successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    pm.expect(response.data.marketplace).to.equal("vtex");
    console.log("✅ Found", response.data.totalCount, "brands");
});`
        ),
        createRequest(
          "Get VTEX Brands (with count)",
          "GET",
          "/marketplaces/{{vtex_connection_id}}/brands?includeCount=true",
          null,
          "Get VTEX brands WITH product counts. **Cached for 24 hours.** Use these IDs for filtered sync.",
          `pm.test("Get brands with count successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    pm.expect(response.data.includeCount).to.be.true;
    console.log("✅ Found", response.data.totalCount, "brands with products");
    console.log("   Cache source:", response.data.source);
});`
        )
      ]
    },
    {
      name: "Shopify Filters",
      item: [
        createRequest(
          "Get Shopify Categories (Product Types)",
          "GET",
          "/marketplaces/{{shopify_connection_id}}/categories",
          null,
          "Get Shopify product types (categories). Returns string names as values.",
          `pm.test("Get categories successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    pm.expect(response.data.marketplace).to.equal("shopify");
    console.log("✅ Found", response.data.totalCount, "product types");
    if (response.data.items.length > 0) {
        console.log("   Example:", response.data.items[0].value,
                    "(" + response.data.items[0].productCount + " products)");
    }
});`
        ),
        createRequest(
          "Get Shopify Categories (with count)",
          "GET",
          "/marketplaces/{{shopify_connection_id}}/categories?includeCount=true",
          null,
          "Get Shopify product types WITH counts. **Cached for 24 hours.** Use these names for filtered sync.",
          `pm.test("Get categories with count successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    pm.expect(response.data.includeCount).to.be.true;
    console.log("✅ Found", response.data.totalCount, "product types with products");
    console.log("   Cache source:", response.data.source);
    if (response.data.items.length > 0) {
        console.log("   Top type:", response.data.items[0].value,
                    "(" + response.data.items[0].productCount + " products)");
    }
});`
        ),
        createRequest(
          "Get Shopify Brands (Vendors)",
          "GET",
          "/marketplaces/{{shopify_connection_id}}/brands",
          null,
          "Get Shopify vendors (brands). Returns string names as values.",
          `pm.test("Get brands successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    pm.expect(response.data.marketplace).to.equal("shopify");
    console.log("✅ Found", response.data.totalCount, "vendors");
});`
        ),
        createRequest(
          "Get Shopify Brands (with count)",
          "GET",
          "/marketplaces/{{shopify_connection_id}}/brands?includeCount=true",
          null,
          "Get Shopify vendors WITH counts. **Cached for 24 hours.** Use these names for filtered sync.",
          `pm.test("Get brands with count successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    pm.expect(response.data.includeCount).to.be.true;
    console.log("✅ Found", response.data.totalCount, "vendors with products");
    console.log("   Cache source:", response.data.source);
});`
        )
      ]
    }
  ]
};

// 5. ASYNC PRODUCT SYNC
const asyncSyncFolder = {
  name: "5. Async Product Sync (UNIFIED)",
  description: "**Unified async sync endpoint for both VTEX and Shopify.**\n\n**Key Differences:**\n- VTEX: categoryIds and brandIds use numeric strings [\"1\", \"2\"]\n- Shopify: categoryIds and brandIds use string names [\"snowboard\", \"Nike\"]\n\n**All requests use the same endpoint:** POST /products/sync/start",
  item: [
    {
      name: "VTEX Sync Examples",
      description: "VTEX async sync examples with different filter combinations. Uses numeric IDs for categories and brands.",
      item: [
        createRequest(
          "Start Sync - No Filters",
          "POST",
          "/products/sync/start",
          {
            connectionId: "{{vtex_connection_id}}",
            marketplace: "vtex",
            estimatedProducts: 200,
            batchSize: 75,
            filters: {
              includeActive: true,
              includeInactive: false
            }
          },
          "Sync all active VTEX products without filters.",
          `pm.test("Sync started successfully", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    if (response.data && response.data.jobId) {
        pm.collectionVariables.set("job_id", response.data.jobId);
        console.log("✅ Sync job started! Job ID:", response.data.jobId);
    }
});`
        ),
        createRequest(
          "Start Sync - Active Only",
          "POST",
          "/products/sync/start",
          {
            connectionId: "{{vtex_connection_id}}",
            marketplace: "vtex",
            estimatedProducts: 150,
            batchSize: 50,
            filters: {
              includeActive: true,
              includeInactive: false
            }
          },
          "Sync only active VTEX products.",
          `pm.test("Sync started successfully", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    if (response.data && response.data.jobId) {
        pm.collectionVariables.set("job_id", response.data.jobId);
        console.log("✅ Sync job started! Job ID:", response.data.jobId);
    }
});`
        ),
        createRequest(
          "Start Sync - Category Filter",
          "POST",
          "/products/sync/start",
          {
            connectionId: "{{vtex_connection_id}}",
            marketplace: "vtex",
            estimatedProducts: 50,
            batchSize: 25,
            filters: {
              includeActive: true,
              includeInactive: false,
              categoryIds: ["1", "3", "5"]
            }
          },
          "Sync VTEX products filtered by categories. **Use numeric IDs from 'Get VTEX Categories (with count)' endpoint.**",
          `pm.test("Sync started successfully", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    if (response.data && response.data.jobId) {
        pm.collectionVariables.set("job_id", response.data.jobId);
        console.log("✅ Sync job started with category filters!");
        console.log("   Categories:", ["1", "3", "5"]);
        console.log("   Job ID:", response.data.jobId);
    }
});`
        ),
        createRequest(
          "Start Sync - Brand Filter",
          "POST",
          "/products/sync/start",
          {
            connectionId: "{{vtex_connection_id}}",
            marketplace: "vtex",
            estimatedProducts: 30,
            batchSize: 25,
            filters: {
              includeActive: true,
              includeInactive: false,
              brandIds: ["2000000", "2000001"]
            }
          },
          "Sync VTEX products filtered by brands. **Use numeric IDs from 'Get VTEX Brands (with count)' endpoint.**",
          `pm.test("Sync started successfully", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    if (response.data && response.data.jobId) {
        pm.collectionVariables.set("job_id", response.data.jobId);
        console.log("✅ Sync job started with brand filters!");
        console.log("   Brands:", ["2000000", "2000001"]);
        console.log("   Job ID:", response.data.jobId);
    }
});`
        ),
        createRequest(
          "Start Sync - ALL Filters",
          "POST",
          "/products/sync/start",
          {
            connectionId: "{{vtex_connection_id}}",
            marketplace: "vtex",
            estimatedProducts: 20,
            batchSize: 20,
            filters: {
              includeActive: true,
              includeInactive: false,
              categoryIds: ["1"],
              brandIds: ["2000000"]
            }
          },
          "Sync VTEX products with both category AND brand filters. Products must match ALL criteria.",
          `pm.test("Sync started successfully", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    if (response.data && response.data.jobId) {
        pm.collectionVariables.set("job_id", response.data.jobId);
        console.log("✅ Sync job started with ALL filters!");
        console.log("   Categories:", ["1"]);
        console.log("   Brands:", ["2000000"]);
        console.log("   Job ID:", response.data.jobId);
    }
});`
        )
      ]
    },
    {
      name: "Shopify Sync Examples",
      description: "Shopify async sync examples with different filter combinations. Uses string names for product types (categories) and vendors (brands).",
      item: [
        createRequest(
          "Start Sync - No Filters",
          "POST",
          "/products/sync/start",
          {
            connectionId: "{{shopify_connection_id}}",
            marketplace: "shopify",
            estimatedProducts: 50,
            batchSize: 25,
            filters: {
              includeActive: true,
              includeInactive: false
            }
          },
          "Sync all active Shopify products without filters.",
          `pm.test("Sync started successfully", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    if (response.data && response.data.jobId) {
        pm.collectionVariables.set("job_id", response.data.jobId);
        console.log("✅ Sync job started! Job ID:", response.data.jobId);
    }
});`
        ),
        createRequest(
          "Start Sync - Vendor Filter (Brand)",
          "POST",
          "/products/sync/start",
          {
            connectionId: "{{shopify_connection_id}}",
            marketplace: "shopify",
            estimatedProducts: 25,
            batchSize: 25,
            filters: {
              includeActive: true,
              includeInactive: false,
              brandIds: ["Racky test store", "Snowboard Vendor"]
            }
          },
          "Sync Shopify products filtered by vendors (brands). **Use string names from 'Get Shopify Brands (with count)' endpoint.**",
          `pm.test("Sync started successfully", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    if (response.data && response.data.jobId) {
        pm.collectionVariables.set("job_id", response.data.jobId);
        console.log("✅ Sync job started with vendor filters!");
        console.log("   Vendors:", ["Racky test store", "Snowboard Vendor"]);
        console.log("   Job ID:", response.data.jobId);
    }
});`
        ),
        createRequest(
          "Start Sync - Product Type Filter (Category)",
          "POST",
          "/products/sync/start",
          {
            connectionId: "{{shopify_connection_id}}",
            marketplace: "shopify",
            estimatedProducts: 15,
            batchSize: 15,
            filters: {
              includeActive: true,
              includeInactive: false,
              categoryIds: ["snowboard", "accessories"]
            }
          },
          "Sync Shopify products filtered by product types (categories). **Use string names from 'Get Shopify Categories (with count)' endpoint.**",
          `pm.test("Sync started successfully", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    if (response.data && response.data.jobId) {
        pm.collectionVariables.set("job_id", response.data.jobId);
        console.log("✅ Sync job started with product type filters!");
        console.log("   Product Types:", ["snowboard", "accessories"]);
        console.log("   Job ID:", response.data.jobId);
    }
});`
        ),
        createRequest(
          "Start Sync - ALL Filters",
          "POST",
          "/products/sync/start",
          {
            connectionId: "{{shopify_connection_id}}",
            marketplace: "shopify",
            estimatedProducts: 10,
            batchSize: 10,
            filters: {
              includeActive: true,
              includeInactive: false,
              categoryIds: ["snowboard"],
              brandIds: ["Snowboard Vendor"]
            }
          },
          "Sync Shopify products with both product type AND vendor filters. Products must match ALL criteria.",
          `pm.test("Sync started successfully", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    if (response.data && response.data.jobId) {
        pm.collectionVariables.set("job_id", response.data.jobId);
        console.log("✅ Sync job started with ALL filters!");
        console.log("   Product Type:", ["snowboard"]);
        console.log("   Vendor:", ["Snowboard Vendor"]);
        console.log("   Job ID:", response.data.jobId);
    }
});`
        )
      ]
    },
    {
      name: "Monitor Sync Jobs",
      description: "Endpoints to monitor async sync job progress and health.",
      item: [
        createRequest(
          "Get Job Status & Progress",
          "GET",
          "/products/sync/status/{{job_id}}",
          null,
          "Get real-time status and progress of a specific sync job. Job ID is auto-saved from 'Start Sync' requests.",
          `pm.test("Get job status successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    if (response.data) {
        console.log("📊 Job Status:", response.data.status);
        console.log("   Progress:", response.data.progress + "%");
        console.log("   Products processed:", response.data.productsProcessed);
        console.log("   Total batches:", response.data.totalBatches);
    }
});`
        ),
        createRequest(
          "Get All My Sync Jobs",
          "GET",
          "/products/sync/jobs",
          null,
          "Get list of all sync jobs for current workspace. Supports filtering by status, marketplace, etc.",
          `pm.test("Get sync jobs successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    console.log("📋 Total jobs found:", response.data.totalCount);
    if (response.data.jobs && response.data.jobs.length > 0) {
        console.log("   Latest job:", response.data.jobs[0].jobId);
        console.log("   Status:", response.data.jobs[0].status);
    }
});`
        ),
        createRequest(
          "Get System Health",
          "GET",
          "/products/sync/health",
          null,
          "Get queue health and system statistics.",
          `pm.test("Get system health successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    if (response.data) {
        console.log("🏥 Queue Health:", response.data.queueHealth);
        console.log("   Active jobs:", response.data.activeJobs || 0);
        console.log("   Pending jobs:", response.data.pendingJobs || 0);
    }
});`
        )
      ]
    }
  ]
};

// 6. PRODUCTS
const productsFolder = {
  name: "6. Products",
  description: "View synced products from database.",
  item: [
    createRequest(
      "Get All Products",
      "GET",
      "/products",
      null,
      "Get all synced products for current workspace.",
      `pm.test("Get products successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    console.log("📦 Total products:", response.data.totalCount || response.data.length);
});`
    ),
    createRequest(
      "Get Products by Marketplace",
      "GET",
      "/products?marketplace=vtex",
      null,
      "Get products filtered by marketplace (vtex, shopify, etc.).",
      `pm.test("Get products by marketplace successful", function() {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    console.log("📦 VTEX products:", response.data.totalCount || response.data.length);
});`
    )
  ]
};

// Build final collection
collection.item.push(authFolder);
collection.item.push(setupFolder);
collection.item.push(storeSetupFolder);
collection.item.push(filtersFolder);
collection.item.push(asyncSyncFolder);
collection.item.push(productsFolder);

// Write to file
const outputPath = path.join(__dirname, '..', 'postman_vtex_filters_testing.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));

console.log('✅ Postman collection rebuilt successfully!');
console.log('📁 Output:', outputPath);
console.log('');
console.log('📊 Collection Statistics:');
console.log('   Total folders:', collection.item.length);
console.log('   1. Authentication:', authFolder.item.length, 'endpoints');
console.log('   2. Setup Flow:', setupFolder.item.length, 'endpoints');
console.log('   3. Store Setup:', storeSetupFolder.item.length, 'endpoints');
console.log('   4. Marketplace Filters:', filtersFolder.item.length, 'folders');
console.log('   5. Async Product Sync:', asyncSyncFolder.item.length, 'folders');
console.log('   6. Products:', productsFolder.item.length, 'endpoints');
console.log('');
console.log('🎯 Key Features:');
console.log('   ✓ Auto-save JWT token on login');
console.log('   ✓ Auto-save workspace ID');
console.log('   ✓ Auto-save VTEX and Shopify connection IDs');
console.log('   ✓ Unified async sync endpoint for both marketplaces');
console.log('   ✓ Clear filter format examples');
console.log('   ✓ Automatic test scripts for all endpoints');
console.log('');
console.log('🚀 Quick Start:');
console.log('   1. Run "Login" to authenticate');
console.log('   2. Run "Setup Flow" folder to configure environment');
console.log('   3. Start syncing with unified async endpoints!');
