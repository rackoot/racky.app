#!/usr/bin/env node

/**
 * Test Script for Marketplace Filters Endpoints
 *
 * Tests unified categories and brands endpoints for both VTEX and Shopify
 * with the following credentials:
 *
 * - JWT Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * - Workspace ID: 68fb79abcfd13a405f7a8780
 * - VTEX Connection: 68fb7d2804fff853b84c19a9
 * - Shopify Connection: 68ffd5a50ba0d99e73404798
 */

const axios = require('axios');

// Test Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000/api';
const JWT_TOKEN = process.env.JWT_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZmI3OWFiY2ZkMTNhNDA1ZjdhODc3ZCIsImlhdCI6MTc2MTczOTYzOCwiZXhwIjoxNzYyMzQ0NDM4fQ.g_Kz5xkPSyzeNLtBD2WPpkU75PJmBDV4uyzaAcglmD4';
const WORKSPACE_ID = process.env.WORKSPACE_ID || '68fb79abcfd13a405f7a8780';
const VTEX_CONNECTION = process.env.VTEX_CONNECTION || '68fb7d2804fff853b84c19a9';
const SHOPIFY_CONNECTION = process.env.SHOPIFY_CONNECTION || '68ffd5a50ba0d99e73404798';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Test results tracker
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Make API request with proper headers
 */
async function makeRequest(url, method = 'GET') {
  const headers = {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'x-workspace-id': WORKSPACE_ID,
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios({
      method,
      url,
      headers,
      validateStatus: () => true // Don't throw on any status code
    });

    return {
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      data: response.data
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error.message
    };
  }
}

/**
 * Log test result
 */
function logTest(testName, passed, details = {}) {
  results.total++;

  if (passed) {
    results.passed++;
    console.log(`${colors.green}✓${colors.reset} ${testName}`);
  } else {
    results.failed++;
    console.log(`${colors.red}✗${colors.reset} ${testName}`);
  }

  results.tests.push({ testName, passed, details });

  if (details.message) {
    console.log(`  ${colors.yellow}${details.message}${colors.reset}`);
  }

  if (details.error) {
    console.log(`  ${colors.red}Error: ${details.error}${colors.reset}`);
  }
}

/**
 * Log section header
 */
function logSection(title) {
  console.log(`\n${colors.cyan}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

/**
 * Log data with indentation
 */
function logData(label, data, indent = 2) {
  const indentation = ' '.repeat(indent);
  console.log(`${indentation}${colors.blue}${label}:${colors.reset}`);

  if (typeof data === 'object') {
    console.log(JSON.stringify(data, null, 2).split('\n').map(line => `${indentation}  ${line}`).join('\n'));
  } else {
    console.log(`${indentation}  ${data}`);
  }
}

/**
 * Test VTEX Categories
 */
async function testVtexCategories() {
  logSection('VTEX - Get Categories');

  // Test without includeCount
  const url1 = `${BASE_URL}/marketplaces/${VTEX_CONNECTION}/categories`;
  const result1 = await makeRequest(url1);

  if (result1.ok && result1.data.success) {
    logTest('GET /categories (VTEX)', true, {
      message: `Found ${result1.data.data.totalCount} categories`
    });

    if (result1.data.data.items.length > 0) {
      logData('Sample Category', result1.data.data.items[0]);
      logData('Response Meta', {
        marketplace: result1.data.data.marketplace,
        includeCount: result1.data.data.includeCount,
        source: result1.data.data.source
      });
    }
  } else {
    logTest('GET /categories (VTEX)', false, {
      error: result1.data?.message || result1.error || 'Unknown error'
    });
  }

  // Test with includeCount (cache)
  console.log('');
  const url2 = `${BASE_URL}/marketplaces/${VTEX_CONNECTION}/categories?includeCount=true`;
  const result2 = await makeRequest(url2);

  if (result2.ok && result2.data.success) {
    logTest('GET /categories?includeCount=true (VTEX)', true, {
      message: `Found ${result2.data.data.totalCount} categories with counts`
    });

    if (result2.data.data.items.length > 0) {
      logData('Top 3 Categories', result2.data.data.items.slice(0, 3));
      logData('Cache Info', {
        source: result2.data.data.source,
        includeCount: result2.data.data.includeCount
      });
    }
  } else {
    logTest('GET /categories?includeCount=true (VTEX)', false, {
      error: result2.data?.message || result2.error || 'Unknown error'
    });
  }
}

/**
 * Test VTEX Brands
 */
async function testVtexBrands() {
  logSection('VTEX - Get Brands');

  // Test without includeCount
  const url1 = `${BASE_URL}/marketplaces/${VTEX_CONNECTION}/brands`;
  const result1 = await makeRequest(url1);

  if (result1.ok && result1.data.success) {
    logTest('GET /brands (VTEX)', true, {
      message: `Found ${result1.data.data.totalCount} brands`
    });

    if (result1.data.data.items.length > 0) {
      logData('Sample Brand', result1.data.data.items[0]);
      logData('Response Meta', {
        marketplace: result1.data.data.marketplace,
        includeCount: result1.data.data.includeCount,
        source: result1.data.data.source
      });
    }
  } else {
    logTest('GET /brands (VTEX)', false, {
      error: result1.data?.message || result1.error || 'Unknown error'
    });
  }

  // Test with includeCount (cache)
  console.log('');
  const url2 = `${BASE_URL}/marketplaces/${VTEX_CONNECTION}/brands?includeCount=true`;
  const result2 = await makeRequest(url2);

  if (result2.ok && result2.data.success) {
    logTest('GET /brands?includeCount=true (VTEX)', true, {
      message: `Found ${result2.data.data.totalCount} brands with counts`
    });

    if (result2.data.data.items.length > 0) {
      logData('Top 3 Brands', result2.data.data.items.slice(0, 3));
      logData('Cache Info', {
        source: result2.data.data.source,
        includeCount: result2.data.data.includeCount
      });
    }
  } else {
    logTest('GET /brands?includeCount=true (VTEX)', false, {
      error: result2.data?.message || result2.error || 'Unknown error'
    });
  }
}

/**
 * Test Shopify Categories (Product Types)
 */
async function testShopifyCategories() {
  logSection('SHOPIFY - Get Categories (Product Types)');

  // Test without includeCount
  const url1 = `${BASE_URL}/marketplaces/${SHOPIFY_CONNECTION}/categories`;
  const result1 = await makeRequest(url1);

  if (result1.ok && result1.data.success) {
    logTest('GET /categories (Shopify)', true, {
      message: `Found ${result1.data.data.totalCount} product types`
    });

    if (result1.data.data.items.length > 0) {
      logData('Sample Product Type', result1.data.data.items[0]);
      logData('Response Meta', {
        marketplace: result1.data.data.marketplace,
        includeCount: result1.data.data.includeCount,
        source: result1.data.data.source
      });

      // Highlight the difference: Shopify uses name as value, VTEX uses ID
      console.log(`\n  ${colors.yellow}Note: Shopify uses 'name' as value (e.g., "${result1.data.data.items[0].value}")${colors.reset}`);
      console.log(`  ${colors.yellow}      VTEX uses numeric ID as value (e.g., "123")${colors.reset}`);
    }
  } else {
    logTest('GET /categories (Shopify)', false, {
      error: result1.data?.message || result1.error || 'Unknown error'
    });
  }

  // Test with includeCount (cache)
  console.log('');
  const url2 = `${BASE_URL}/marketplaces/${SHOPIFY_CONNECTION}/categories?includeCount=true`;
  const result2 = await makeRequest(url2);

  if (result2.ok && result2.data.success) {
    logTest('GET /categories?includeCount=true (Shopify)', true, {
      message: `Found ${result2.data.data.totalCount} product types with counts`
    });

    if (result2.data.data.items.length > 0) {
      logData('Top 3 Product Types', result2.data.data.items.slice(0, 3));
      logData('Cache Info', {
        source: result2.data.data.source,
        includeCount: result2.data.data.includeCount
      });
    }
  } else {
    logTest('GET /categories?includeCount=true (Shopify)', false, {
      error: result2.data?.message || result2.error || 'Unknown error'
    });
  }
}

/**
 * Test Shopify Brands (Vendors)
 */
async function testShopifyBrands() {
  logSection('SHOPIFY - Get Brands (Vendors)');

  // Test without includeCount
  const url1 = `${BASE_URL}/marketplaces/${SHOPIFY_CONNECTION}/brands`;
  const result1 = await makeRequest(url1);

  if (result1.ok && result1.data.success) {
    logTest('GET /brands (Shopify)', true, {
      message: `Found ${result1.data.data.totalCount} vendors`
    });

    if (result1.data.data.items.length > 0) {
      logData('Sample Vendor', result1.data.data.items[0]);
      logData('Response Meta', {
        marketplace: result1.data.data.marketplace,
        includeCount: result1.data.data.includeCount,
        source: result1.data.data.source
      });

      // Highlight the difference: Shopify uses name as value, VTEX uses ID
      console.log(`\n  ${colors.yellow}Note: Shopify uses 'name' as value (e.g., "${result1.data.data.items[0].value}")${colors.reset}`);
      console.log(`  ${colors.yellow}      VTEX uses numeric ID as value (e.g., "123")${colors.reset}`);
    }
  } else {
    logTest('GET /brands (Shopify)', false, {
      error: result1.data?.message || result1.error || 'Unknown error'
    });
  }

  // Test with includeCount (cache)
  console.log('');
  const url2 = `${BASE_URL}/marketplaces/${SHOPIFY_CONNECTION}/brands?includeCount=true`;
  const result2 = await makeRequest(url2);

  if (result2.ok && result2.data.success) {
    logTest('GET /brands?includeCount=true (Shopify)', true, {
      message: `Found ${result2.data.data.totalCount} vendors with counts`
    });

    if (result2.data.data.items.length > 0) {
      logData('Top 3 Vendors', result2.data.data.items.slice(0, 3));
      logData('Cache Info', {
        source: result2.data.data.source,
        includeCount: result2.data.data.includeCount
      });
    }
  } else {
    logTest('GET /brands?includeCount=true (Shopify)', false, {
      error: result2.data?.message || result2.error || 'Unknown error'
    });
  }
}

/**
 * Show final summary
 */
function showSummary() {
  console.log(`\n${colors.cyan}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  TEST SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  console.log(`  Total Tests:  ${results.total}`);
  console.log(`  ${colors.green}Passed:       ${results.passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed:       ${results.failed}${colors.reset}`);

  const passRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0;
  console.log(`  Pass Rate:    ${passRate}%\n`);

  if (results.failed > 0) {
    console.log(`${colors.red}${colors.bright}Failed Tests:${colors.reset}`);
    results.tests
      .filter(t => !t.passed)
      .forEach(t => {
        console.log(`  ${colors.red}✗${colors.reset} ${t.testName}`);
        if (t.details.error) {
          console.log(`    ${colors.red}${t.details.error}${colors.reset}`);
        }
      });
    console.log('');
  }

  // Exit with error code if tests failed
  process.exit(results.failed > 0 ? 1 : 0);
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(`${colors.bright}${colors.magenta}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  MARKETPLACE FILTERS ENDPOINT TEST SUITE                  ║');
  console.log('║  Testing unified categories and brands endpoints           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  console.log(`${colors.bright}Configuration:${colors.reset}`);
  console.log(`  Base URL:         ${BASE_URL}`);
  console.log(`  Workspace ID:     ${WORKSPACE_ID}`);
  console.log(`  VTEX Connection:  ${VTEX_CONNECTION}`);
  console.log(`  Shopify Connection: ${SHOPIFY_CONNECTION}`);

  try {
    // Run all tests
    await testVtexCategories();
    await testVtexBrands();
    await testShopifyCategories();
    await testShopifyBrands();

    // Show summary
    showSummary();

  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}Fatal Error:${colors.reset} ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
