# Racky Backend API Documentation

**Last Updated:** 2025-08-19

## Overview
Racky is a marketplace management platform that allows users to connect and manage multiple e-commerce marketplaces from a single backend. This document provides the API specification for the frontend development team.

## Base URL
```
http://localhost:5000/api
```

## Authentication
The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### Authentication Endpoints

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201):**
```json
{
  "_id": "user_id",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "token": "jwt_token_here"
}
```

#### POST /auth/login
Authenticate an existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "_id": "user_id",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "token": "jwt_token_here"
}
```

### Marketplace Management Endpoints

#### GET /marketplaces
Get all available marketplaces with their requirements.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "shopify",
      "name": "Shopify",
      "description": "Connect to your Shopify store",
      "requiredCredentials": ["shop_url", "access_token"],
      "documentationUrl": "https://help.shopify.com/en/manual/apps/private-apps"
    },
    {
      "id": "amazon",
      "name": "Amazon",
      "description": "Connect to Amazon marketplace",
      "requiredCredentials": ["seller_id", "marketplace_id", "access_key", "secret_key", "region"],
      "documentationUrl": "https://developer-docs.amazon.com/sp-api/docs/sp-api-endpoints"
    }
  ]
}
```

#### GET /marketplaces/status
Get user's marketplace connection status.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "shopify",
      "name": "Shopify",
      "description": "Connect to your Shopify store",
      "requiredCredentials": ["shop_url", "access_token"],
      "documentationUrl": "https://help.shopify.com/en/manual/apps/private-apps",
      "connected": true,
      "connectionInfo": {
        "connectionId": "connection_id",
        "marketplaceId": "marketplace_id",
        "storeName": "My Store",
        "lastSync": "2025-08-19T10:00:00.000Z",
        "syncStatus": "completed"
      }
    }
  ]
}
```

#### POST /marketplaces/test
Test marketplace connection without saving.

**Request Body:**
```json
{
  "type": "shopify",
  "credentials": {
    "shop_url": "mystore.myshopify.com",
    "access_token": "shpat_xxxxx"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Shopify connection successful",
  "data": {
    "shop_name": "My Store",
    "domain": "mystore.myshopify.com",
    "plan": "Basic Shopify"
  }
}
```

#### POST /marketplaces/connect
Connect marketplace to existing store connection.

**Request Body:**
```json
{
  "storeConnectionId": "connection_id",
  "type": "amazon",
  "credentials": {
    "seller_id": "A1234567890",
    "marketplace_id": "ATVPDKIKX0DER",
    "access_key": "access_key_here",
    "secret_key": "secret_key_here",
    "region": "us-east-1"
  }
}
```

**Response (201):** Returns the updated connection object with test results.

#### POST /marketplaces/create-store
Create new store connection with marketplace.

**Request Body:**
```json
{
  "storeName": "New Store",
  "type": "woocommerce",
  "credentials": {
    "site_url": "https://mystore.com",
    "consumer_key": "ck_xxxxx",
    "consumer_secret": "cs_xxxxx"
  }
}
```

**Response (201):** Returns the created connection object with test results.

#### PUT /marketplaces/:connectionId/:marketplaceId/test
Test existing marketplace connection.

**Response (200):** Returns test results and updates sync status.

#### PUT /marketplaces/:connectionId/:marketplaceId/toggle
Toggle marketplace active status.

**Response (200):**
```json
{
  "success": true,
  "message": "Marketplace activated successfully",
  "data": {
    "isActive": true,
    "syncStatus": "pending"
  }
}
```

### Store Connection Endpoints

#### GET /connections
Get all store connections for the authenticated user.

**Response (200):**
```json
[
  {
    "_id": "connection_id",
    "userId": "user_id",
    "storeName": "My Store",
    "marketplaces": [
      {
        "_id": "marketplace_id",
        "type": "shopify",
        "credentials": { /* marketplace specific credentials */ },
        "isActive": true,
        "lastSync": "2025-08-19T10:00:00.000Z",
        "syncStatus": "completed"
      }
    ],
    "isActive": true,
    "createdAt": "2025-08-19T09:00:00.000Z",
    "updatedAt": "2025-08-19T10:00:00.000Z"
  }
]
```

#### GET /connections/:id
Get a specific store connection by ID.

**Response (200):** Same structure as individual connection above.

#### POST /connections
Create a new store connection.

**Request Body:**
```json
{
  "storeName": "My New Store",
  "marketplaces": [
    {
      "type": "shopify",
      "credentials": {
        "shop_url": "mystore.myshopify.com",
        "access_token": "shpat_xxxxx"
      }
    }
  ]
}
```

**Response (201):** Returns the created connection object.

#### PUT /connections/:id
Update an existing store connection.

**Request Body:**
```json
{
  "storeName": "Updated Store Name",
  "isActive": false
}
```

**Response (200):** Returns the updated connection object.

#### DELETE /connections/:id
Delete a store connection.

**Response (200):**
```json
{
  "message": "Connection deleted successfully"
}
```

#### POST /connections/:id/marketplace
Add a new marketplace to an existing connection.

**Request Body:**
```json
{
  "type": "amazon",
  "credentials": {
    "seller_id": "A1234567890",
    "marketplace_id": "ATVPDKIKX0DER",
    "access_key": "access_key_here",
    "secret_key": "secret_key_here"
  }
}
```

**Response (201):** Returns the updated connection object.

#### DELETE /connections/:id/marketplace/:marketplaceId
Remove a marketplace from a connection.

**Response (200):** Returns the updated connection object.

### Product Management Endpoints

These endpoints handle product data synchronization and management from connected marketplaces.

#### GET /products
Get all products for a user with pagination, filtering, and sorting.

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Products per page (default: 20)
- `search` (optional) - Search in title, SKU, or handle
- `marketplace` (optional) - Filter by marketplace type
- `store` (optional) - Filter by store connection ID
- `sortBy` (optional) - Sort field (default: 'createdAt')
- `sortOrder` (optional) - Sort direction 'asc' or 'desc' (default: 'desc')
- `status` (optional) - Filter by product status

**Response (200):**
```json
{
  "success": true,
  "data": {
    "products": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 100,
      "limit": 20,
      "hasNext": true,
      "hasPrev": false
    },
    "filters": {
      "marketplaces": [
        { "marketplace": "shopify", "count": 50 },
        { "marketplace": "amazon", "count": 30 }
      ]
    }
  }
}
```

#### GET /products/store/:connectionId
Get products for a specific store connection.

**Parameters:**
- `connectionId` - Store connection ID

**Response (200):**
```json
{
  "success": true,
  "data": [...]
}
```

#### GET /products/store/:connectionId/count
Check if products exist for a store connection and get count.

**Parameters:**
- `connectionId` - Store connection ID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "hasProducts": true,
    "count": 25
  }
}
```

#### POST /products/sync/:connectionId
Sync products from a marketplace. Supports both regular sync and force replacement.

**Parameters:**
- `connectionId` - Store connection ID

**Request Body:**
```json
{
  "force": false
}
```

**force: false (Regular Sync):**
- Updates existing products with new data
- Creates new products that don't exist locally
- Preserves local products not found in marketplace

**force: true (Force Replacement):**
- **⚠️ Deletes ALL existing products for the connection**
- Downloads fresh product data from marketplace
- Completely replaces local product database

**Response (200):**
```json
{
  "success": true,
  "message": "Successfully replaced 25 products with 30 fresh products from shopify",
  "data": {
    "totalProducts": 30,
    "newProducts": 30,
    "updatedProducts": 0,
    "deletedProducts": 25,
    "isForceSync": true
  }
}
```

**Important:** Force sync permanently deletes existing product data. Use with caution and ensure users are properly warned.

#### GET /products/:id
Get single product details by ID.

**Parameters:**
- `id` - Product ID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "product_id",
    "title": "Product Title",
    "description": "Product description...",
    "price": 29.99,
    "inventory": 100,
    "marketplace": "shopify",
    "platforms": {
      "shopify": {
        "platformId": "external_id",
        "platformPrice": 29.99,
        "platformInventory": 100,
        "platformStatus": "active",
        "lastSyncAt": "2025-08-20T05:00:00Z"
      }
    },
    "variants": [...],
    "images": [...],
    "tags": [...]
  }
}
```

#### PATCH /products/:id/description
Update product description in local database.

**Parameters:**
- `id` - Product ID

**Request Body:**
```json
{
  "description": "Updated product description"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Product description updated successfully",
  "data": {
    "description": "Updated product description"
  }
}
```

#### POST /products/:id/description/apply-to-marketplace
Apply product description to connected marketplace store.

**Parameters:**
- `id` - Product ID

**Request Body:**
```json
{
  "description": "Description to apply to marketplace",
  "marketplace": "shopify"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Shopify product description updated successfully"
  }
}
```

**Error Response (400/404):**
```json
{
  "success": false,
  "message": "No store connection found for this product"
}
```

### Product Optimization Endpoints

These endpoints provide AI-powered content optimization for products across different marketplaces.

#### GET /optimizations/products/:id/description/:platform
Get or generate AI-optimized description for a product on a specific platform.

**Parameters:**
- `id` - Product ID
- `platform` - Target marketplace (shopify, amazon, mercadolibre, woocommerce, vtex, facebook_shop, google_shopping)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "suggestion": {
      "id": "suggestion_id",
      "originalContent": "Original product description...",
      "suggestedContent": "AI-optimized description...",
      "status": "pending",
      "metadata": {
        "model": "gpt-3.5-turbo",
        "tokens": 150,
        "confidence": 0.85,
        "keywords": ["keyword1", "keyword2"],
        "prompt": "Platform-specific prompt used"
      },
      "createdAt": "2025-08-20T05:00:00Z"
    },
    "cached": true
  }
}
```

#### POST /optimizations/products/:id/description/:platform
Force regenerate AI-optimized description for a product on a specific platform.

**Parameters:**
- `id` - Product ID  
- `platform` - Target marketplace

**Response (200):** Same as GET endpoint but with `cached: false`

#### PATCH /optimizations/products/:id/description/:platform
Update suggestion status (accept/reject).

**Request Body:**
```json
{
  "status": "accepted",
  "suggestionId": "suggestion_id"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "suggestion": {
      "id": "suggestion_id",
      "status": "accepted",
      "updatedAt": "2025-08-20T05:00:00Z"
    }
  }
}
```

#### POST /optimizations/products/:id/description/:platform/apply
Apply accepted description to the connected marketplace store.

**Request Body:**
```json
{
  "suggestionId": "suggestion_id"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "storeUpdateResult": {
      "success": true,
      "message": "Shopify product description updated successfully",
      "data": {
        "productId": "external_product_id",
        "updatedAt": "2025-08-20T05:00:00Z"
      }
    },
    "message": "Description successfully applied to store and updated locally"
  }
}
```

**Important:** The local product description is only updated if the marketplace update succeeds. This ensures data consistency.

#### GET /optimizations/products/:id/suggestions
Get suggestion history for a product.

**Query Parameters:**
- `platform` (optional) - Filter by marketplace platform
- `type` (optional) - Filter by suggestion type (e.g., "description")

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "suggestion_id",
      "platform": "shopify",
      "type": "description",
      "title": "Description Optimization",
      "description": "AI-optimized product description",
      "originalContent": "Original description...",
      "suggestedContent": "Optimized description...",
      "status": "accepted",
      "metadata": {
        "model": "gpt-3.5-turbo",
        "tokens": 150,
        "confidence": 0.85,
        "keywords": ["keyword1", "keyword2"]
      },
      "createdAt": "2025-08-20T05:00:00Z",
      "updatedAt": "2025-08-20T05:05:00Z"
    }
  ]
}
```

### Product Opportunities Endpoints

These endpoints provide AI-powered product improvement opportunities with caching and category-based organization.

#### GET /opportunities/categories
Get all available opportunity categories.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "category_id",
      "id": "pricing",
      "name": "Pricing",
      "description": "Price optimization and competitive analysis",
      "icon": "DollarSign",
      "color": "text-green-600 bg-green-100",
      "isMarketplace": false,
      "isActive": true,
      "createdAt": "2025-08-20T05:00:00Z",
      "updatedAt": "2025-08-20T05:00:00Z"
    }
  ]
}
```

#### GET /opportunities/products/:id
Get cached opportunities for a specific product.

**Parameters:**
- `id` - Product ID

**Query Parameters:**
- `category` (optional) - Filter by specific category

**Response (200):**
```json
{
  "success": true,
  "data": {
    "opportunities": {
      "pricing": [
        {
          "_id": "opportunity_id",
          "userId": "user_id",
          "productId": "product_id",
          "category": "pricing",
          "marketplace": "shopify",
          "title": "Optimize Product Pricing Strategy",
          "description": "Your current pricing is below market average. Consider increasing by 15-20% to improve margins.",
          "priority": "high",
          "status": "open",
          "potentialImpact": {
            "revenue": 0,
            "percentage": 25
          },
          "actionRequired": "Research competitor pricing and adjust your product price",
          "cachedAt": "2025-08-20T05:00:00Z",
          "expiresAt": "2025-08-21T05:00:00Z",
          "aiMetadata": {
            "model": "gpt-3.5-turbo",
            "prompt": "Analyze this product...",
            "tokens": 150,
            "confidence": 0.85
          },
          "createdAt": "2025-08-20T05:00:00Z",
          "updatedAt": "2025-08-20T05:00:00Z"
        }
      ]
    },
    "categoryCounts": {
      "pricing": 2,
      "description": 1,
      "marketing": 3
    },
    "availableMarketplaceTabs": ["shopify", "amazon"],
    "totalCount": 6,
    "productMarketplace": "shopify",
    "cached": true,
    "lastGenerated": "2025-08-20T05:00:00Z"
  }
}
```

#### POST /opportunities/products/:id/generate
Generate new AI-powered opportunities for a product.

**Parameters:**
- `id` - Product ID

**Request Body:**
```json
{
  "forceRefresh": false
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "opportunities": {
      "pricing": [...],
      "description": [...],
      "seo": [...]
    },
    "categoryCounts": {
      "pricing": 2,
      "description": 1,
      "seo": 1
    },
    "totalCount": 4,
    "cached": false,
    "generatedAt": "2025-08-20T05:00:00Z",
    "message": "Generated 4 new opportunities"
  }
}
```

#### PATCH /opportunities/:id/status
Update the status of a specific opportunity.

**Parameters:**
- `id` - Opportunity ID

**Request Body:**
```json
{
  "status": "in_progress"
}
```

**Valid Status Values:**
- `open` - Available to work on
- `in_progress` - Currently being worked on
- `completed` - Successfully implemented
- `dismissed` - Not relevant or ignored

**Response (200):**
```json
{
  "success": true,
  "data": {
    "opportunity": {
      "_id": "opportunity_id",
      "status": "in_progress",
      "updatedAt": "2025-08-20T05:05:00Z"
    },
    "message": "Opportunity marked as in_progress"
  }
}
```

#### GET /opportunities/products/:id/summary
Get opportunity summary statistics for a product.

**Parameters:**
- `id` - Product ID

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total": 8,
    "byPriority": {
      "critical": 1,
      "high": 3,
      "medium": 3,
      "low": 1
    },
    "byStatus": {
      "open": 5,
      "in_progress": 2,
      "completed": 1
    },
    "totalPotentialImpact": 120
  }
}
```

**Important Notes:**
- Opportunities are cached for 24 hours to improve performance
- AI generation requires OpenAI API key configuration
- Fallback suggestions are provided when AI is unavailable
- Categories include both general improvements and marketplace-specific suggestions
- Expired opportunities are automatically cleaned up

## Video Generation Endpoints

All video generation endpoints require authentication and workspace context.

### Generate Video for Single Product

#### POST /videos/generate-for-product
Generate an AI-powered video for a single product using a selected template.

**Request Body:**
```json
{
  "productId": "507f1f77bcf86cd799439011",
  "templateId": "uuid-template-123",
  "templateName": "Product Showcase",
  "aspect_ratio": "9:16"
}
```

**Field Descriptions:**
- `productId` - **Required**. MongoDB ObjectId of the product
- `templateId` - **Required**. UUID of the video template from external service
- `templateName` - **Required**. Display name of the template (e.g., "Product Showcase")
- `aspect_ratio` - **Required**. Video format: `"9:16"` (vertical), `"16:9"` (horizontal), or `"1:1"` (square)

**Response (200):**
```json
{
  "success": true,
  "message": "Video will process, we'll let you know when it's ready!",
  "data": {
    "productId": "507f1f77bcf86cd799439011",
    "productTitle": "Product Name",
    "templateId": "uuid-template-123",
    "templateName": "Product Showcase"
  }
}
```

**Error Responses:**
- `400` - Missing required fields (productId, templateId, templateName, aspect_ratio)
- `404` - Product not found
- `500` - Server error

**Notes:**
- Currently simulated (does not call external API)
- Creates video entry with 'processing' status
- Product must belong to authenticated user and workspace

---

### Bulk Generate Videos

#### POST /videos/bulk-generate
Generate AI-powered videos for multiple products simultaneously.

**Request Body:**
```json
{
  "productIds": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012"
  ],
  "templateId": "uuid-template-123",
  "templateName": "Product Showcase",
  "aspect_ratio": "16:9"
}
```

**Field Descriptions:**
- `productIds` - **Required**. Array of product MongoDB ObjectIds
- `templateId` - **Required**. UUID of the video template from external service
- `templateName` - **Required**. Display name of the template
- `aspect_ratio` - **Required**. Video format: `"9:16"`, `"16:9"`, or `"1:1"`

**Response (200):**
```json
{
  "success": true,
  "message": "Video generation started for 2 product(s). We'll notify you when they're ready!",
  "data": {
    "productCount": 2,
    "templateId": "uuid-template-123",
    "templateName": "Product Showcase",
    "videoIds": [
      "65a1b2c3d4e5f6789abcdef0",
      "65a1b2c3d4e5f6789abcdef1"
    ]
  }
}
```

**External API Request (RCK Description Server):**

This endpoint sends the following payload to the external video generation service (`POST /api/v1/create-images-batch`):

```json
[
  {
    "id_product": 134744072,
    "title": "Product Name",
    "img_urls": [
      "https://cdn.example.com/image1.jpg",
      "https://cdn.example.com/image2.jpg",
      "https://cdn.example.com/image3.jpg"
    ],
    "user_id": "507f1f77bcf86cd799439011",
    "sku": "PRODUCT-SKU-001",
    "template_name": "Product Showcase",
    "videoId": "65a1b2c3d4e5f6789abcdef0",
    "aspect_ratio": "16:9"
  }
]
```

**External API Field Descriptions:**
- `id_product` - Integer converted from MongoDB ObjectId (first 8 hex chars)
- `title` - Product title from database
- `img_urls` - **Array** of all product image URLs (changed from single `img_url`)
- `user_id` - MongoDB ObjectId of the user as string
- `sku` - Product SKU or MongoDB _id as fallback
- `template_name` - Template display name
- `videoId` - AIVideo MongoDB _id for webhook callbacks
- `aspect_ratio` - Video format specification

**Error Responses:**
- `400` - Missing or invalid productIds, templateId, templateName, or aspect_ratio
- `403` - Video generation limit exceeded for workspace
- `404` - No products found for given IDs
- `503` - RCK Description Server not configured
- `500` - Server error or external API failure

**Behavior:**
1. Validates all required parameters including aspect_ratio
2. Checks workspace video generation limits
3. Creates AIVideo records with 'generating' status
4. Increments workspace usage counter
5. Sends batch request to external API with **all product images**
6. Updates videos with external job IDs
7. External service calls webhooks on completion/failure

**Important Notes:**
- Requires RCK Description Server configuration (`RCK_DESCRIPTION_SERVER_URL`)
- Enforces subscription-based usage limits
- Creates AIVideo records before calling external API
- Now sends **all product images** instead of just the first image
- Aspect ratio is required and must be one of: `9:16`, `16:9`, or `1:1`
- If external API fails, all videos are marked as 'failed'
- Supports webhook callbacks for status updates

---

### Get Video Templates

#### GET /videos/templates
Fetch available video templates from the external RCK Description Server.

**Response (200):**
```json
{
  "success": true,
  "message": "Templates fetched successfully",
  "templates": [
    {
      "id": "uuid-template-123",
      "title": "Product Showcase",
      "name_file_video": "showcase_template.mp4",
      "name_file_background_image": "showcase_bg.jpg",
      "description": "Classic product presentation with rotating views",
      "url_video": "https://www.youtube.com/watch?v=example"
    }
  ],
  "error": null
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Failed to fetch templates",
  "templates": [],
  "error": "RCK Description Server connection failed"
}
```

---

### Get Video Usage Statistics

#### GET /videos/usage/stats
Get current workspace's video generation usage statistics for the billing period.

**Response (200):**
```json
{
  "used": 15,
  "limit": 50,
  "remaining": 35,
  "percentage": 30
}
```

**Field Descriptions:**
- `used` - Number of videos generated this billing period
- `limit` - Maximum videos allowed per billing period
- `remaining` - Videos remaining in quota
- `percentage` - Usage percentage (0-100)

---

## Admin Endpoints

**Note:** All admin endpoints require SUPERADMIN role and are protected by authentication middleware.

### User Management

#### GET /admin/users
List all users with pagination and filtering.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `search` - Search by email, firstName, lastName
- `role` - Filter by role (USER, SUPERADMIN)
- `subscriptionStatus` - Filter by subscription status (TRIAL, ACTIVE, SUSPENDED, CANCELLED)
- `subscriptionPlan` - Filter by plan (JUNIOR, SENIOR, EXECUTIVE)
- `sortBy` - Sort field (default: createdAt)
- `sortOrder` - Sort order (asc, desc, default: desc)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "user_id",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "USER",
        "isActive": true,
        "subscriptionStatus": "ACTIVE",
        "subscriptionPlan": "SENIOR",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "stats": {
          "storeCount": 2,
          "productCount": 150,
          "currentUsage": {
            "apiCalls": 1200,
            "productsSync": 150,
            "storageUsed": 50
          }
        },
        "subscriptionInfo": {
          "status": "Active",
          "plan": "Pro",
          "hasActiveSubscription": true,
          "isTrialExpired": false
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 100,
      "limit": 20,
      "hasNext": true,
      "hasPrev": false
    },
    "stats": {
      "totalUsers": 100,
      "activeUsers": 85,
      "trialUsers": 15,
      "activeSubscriptions": 70,
      "superAdmins": 2
    }
  }
}
```

#### GET /admin/users/:id
Get detailed information about a specific user.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "isActive": true,
    "subscriptionStatus": "ACTIVE",
    "subscriptionPlan": "SENIOR",
    "storeConnections": [...],
    "recentProducts": [...],
    "usageHistory": [...],
    "subscription": {...},
    "subscriptionInfo": {...}
  }
}
```

#### PUT /admin/users/:id/status
Activate or deactivate a user account.

**Request Body:**
```json
{
  "isActive": true
}
```

#### PUT /admin/users/:id/role
Update user role.

**Request Body:**
```json
{
  "role": "SUPERADMIN"
}
```

#### PUT /admin/users/:id/subscription
Update user subscription details.

**Request Body:**
```json
{
  "subscriptionStatus": "ACTIVE",
  "subscriptionPlan": "SENIOR",
  "trialEndsAt": "2024-12-31T23:59:59.999Z",
  "subscriptionEndsAt": "2025-12-31T23:59:59.999Z"
}
```

#### DELETE /admin/users/:id?force=true
Delete a user account and all associated data.

**Query Parameters:**
- `force` - Set to true to delete user with all data

### Subscription Management

#### GET /admin/subscriptions
List all subscriptions with filtering and search.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `search` - Search by user email, firstName, lastName
- `status` - Filter by subscription status (TRIAL, ACTIVE, SUSPENDED, CANCELLED)
- `plan` - Filter by plan (JUNIOR, SENIOR, EXECUTIVE)
- `sortBy` - Sort field (default: createdAt)
- `sortOrder` - Sort order (asc, desc, default: desc)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subscriptions": [
      {
        "_id": "subscription_id",
        "userId": "user_id",
        "contributorType": "SENIOR",
        "status": "ACTIVE",
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2025-01-01T00:00:00.000Z",
        "amount": 79,
        "currency": "USD",
        "paymentMethod": "stripe",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "user": {
          "_id": "user_id",
          "email": "user@example.com",
          "firstName": "John",
          "lastName": "Doe",
          "subscriptionStatus": "ACTIVE",
          "subscriptionPlan": "SENIOR",
          "trialEndsAt": null,
          "subscriptionEndsAt": "2025-01-01T00:00:00.000Z",
          "isActive": true
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalCount": 50,
      "limit": 20,
      "hasNext": true,
      "hasPrev": false
    },
    "stats": {
      "totalSubscriptions": 50,
      "activeSubscriptions": 35,
      "trialSubscriptions": 10,
      "suspendedSubscriptions": 3,
      "cancelledSubscriptions": 2,
      "basicPlan": 15,
      "proPlan": 25,
      "enterprisePlan": 10
    }
  }
}
```

### Analytics

#### GET /admin/analytics?period=30d
Get platform usage analytics.

**Query Parameters:**
- `period` - Time period (7d, 30d, 90d, default: 30d)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "totalUsage": {
      "totalApiCalls": 15000,
      "totalProductsSync": 2500,
      "totalStorageUsed": 500,
      "totalUsers": 100,
      "totalProducts": 17,
      "totalStoreConnections": 1
    },
    "userGrowth": [...],
    "subscriptionBreakdown": [...],
    "revenueData": [...],
    "generatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Supported Marketplaces

The system supports the following marketplace types with their required credentials:

### Shopify
- **Type:** `shopify`
- **Documentation:** https://help.shopify.com/en/manual/apps/private-apps
- **Required Credentials:**
  - `shop_url` - Your shop URL (e.g., "mystore.myshopify.com")
  - `access_token` - Private app access token

### VTEX  
- **Type:** `vtex`
- **Documentation:** https://developers.vtex.com/vtex-rest-api/docs/getting-started-authentication
- **Required Credentials:**
  - `account_name` - VTEX account name
  - `app_key` - Application key
  - `app_token` - Application token

### MercadoLibre
- **Type:** `mercadolibre`
- **Documentation:** https://developers.mercadolibre.com/en/authentication-and-authorization
- **Required Credentials:**
  - `client_id` - Application client ID
  - `client_secret` - Application client secret
  - `access_token` - User access token
  - `user_id` - User ID

### Amazon
- **Type:** `amazon`
- **Documentation:** https://developer-docs.amazon.com/sp-api/docs/sp-api-endpoints
- **Required Credentials:**
  - `seller_id` - Amazon seller ID
  - `marketplace_id` - Marketplace ID (e.g., "ATVPDKIKX0DER" for US)
  - `access_key` - AWS access key
  - `secret_key` - AWS secret key
  - `region` - AWS region (e.g., "us-east-1")

### Facebook Shop
- **Type:** `facebook_shop`
- **Documentation:** https://developers.facebook.com/docs/commerce-platform
- **Required Credentials:**
  - `page_id` - Facebook page ID
  - `access_token` - Page access token

### Google Shopping
- **Type:** `google_shopping`
- **Documentation:** https://developers.google.com/shopping-content/guides/quickstart
- **Required Credentials:**
  - `merchant_id` - Google Merchant Center ID
  - `client_email` - Service account email
  - `private_key` - Service account private key

### WooCommerce
- **Type:** `woocommerce`
- **Documentation:** https://woocommerce.github.io/woocommerce-rest-api-docs/
- **Required Credentials:**
  - `site_url` - WooCommerce site URL
  - `consumer_key` - REST API consumer key
  - `consumer_secret` - REST API consumer secret

## Data Models

### User
```json
{
  "_id": "ObjectId",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "isActive": "boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Store Connection
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "storeName": "string",
  "marketplaces": [
    {
      "_id": "ObjectId",
      "type": "enum: [shopify, vtex, mercadolibre, amazon, facebook_shop, google_shopping, woocommerce]",
      "credentials": "Object",
      "isActive": "boolean",
      "lastSync": "Date",
      "syncStatus": "enum: [pending, syncing, completed, failed]"
    }
  ],
  "isActive": "boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Product
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "storeConnectionId": "ObjectId",
  "marketplace": "string",
  "externalId": "string",
  "title": "string",
  "description": "string",
  "price": "number",
  "currency": "string",
  "sku": "string",
  "stock": "number",
  "images": ["string"],
  "category": "string",
  "status": "enum: [active, inactive, draft]",
  "lastSyncedAt": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Opportunity
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "productId": "ObjectId",
  "type": "enum: [price_optimization, inventory_alert, competitor_analysis, market_expansion]",
  "title": "string",
  "description": "string",
  "priority": "enum: [low, medium, high, critical]",
  "status": "enum: [open, in_progress, completed, dismissed]",
  "potentialImpact": {
    "revenue": "number",
    "percentage": "number"
  },
  "actionRequired": "string",
  "dueDate": "Date",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Suggestion
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "productId": "ObjectId",
  "type": "enum: [pricing, inventory, description, images, keywords, cross_selling]",
  "title": "string",
  "description": "string",
  "currentValue": "mixed",
  "suggestedValue": "mixed",
  "confidence": "number (0-100)",
  "status": "enum: [pending, accepted, rejected, applied]",
  "estimatedImpact": "enum: [low, medium, high]",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

## Webhook Endpoints (Internal)

These endpoints are NOT protected by authentication and are designed to be called by external services (like the RCK Description Server). They are used for asynchronous callback notifications.

**Base URL:** `http://localhost:5000/internal`

### Video Generation Webhooks

#### POST /internal/videos/success
Webhook endpoint for external video generation service to notify video completion.

**Request Body:**
```json
{
  "videoId": "507f1f77bcf86cd799439011",
  "youtubeVideoId": "dQw4w9WgXcQ",
  "localFilename": "videos/test_video.mp4",
  "video_url": "https://example.com/videos/test.mp4",
  "img_s3_url": "https://s3.amazonaws.com/bucket/video-thumbnail.jpg"
}
```

**Field Descriptions:**
- `videoId` - **Required**. AIVideo MongoDB _id (must be a valid ObjectId)
- `youtubeVideoId` - Optional. YouTube video ID for the generated video
- `localFilename` - Optional. File path on external server where video is stored
- `video_url` - Optional. Direct URL to access the generated video
- `img_s3_url` - Optional. S3 URL for video thumbnail/cover image

**Response (200):**
```json
{
  "success": true,
  "message": "Video status updated successfully",
  "data": {
    "videoId": "507f1f77bcf86cd799439011",
    "youtubeVideoId": "dQw4w9WgXcQ",
    "localFilename": "videos/test_video.mp4",
    "videoUrl": "https://example.com/videos/test.mp4",
    "imgS3Url": "https://s3.amazonaws.com/bucket/video-thumbnail.jpg",
    "productId": "507f1f77bcf86cd799439012"
  }
}
```

**Error Responses:**
- `400` - Bad Request (missing videoId or invalid format)
```json
{
  "success": false,
  "message": "videoId is required"
}
```
- `404` - Not Found (video not found)
```json
{
  "success": false,
  "message": "Video not found"
}
```
- `500` - Internal Server Error
```json
{
  "success": false,
  "message": "Failed to process video completion"
}
```

**Behavior:**
- Updates the AIVideo record status to `completed`
- Stores YouTube video ID, local filename, video URL, and S3 image URL in metadata
- Also updates Product.videos array for dual storage compatibility
- Idempotent - can be called multiple times safely
- The `img_s3_url` is displayed in the UI alongside the video in a 2-column layout

#### POST /internal/videos/failure
Webhook endpoint for external video generation service to notify video generation failure.

**Request Body:**
```json
{
  "videoId": "507f1f77bcf86cd799439011",
  "error": "Video generation failed due to insufficient resources"
}
```

**Field Descriptions:**
- `videoId` - **Required**. AIVideo MongoDB _id (must be a valid ObjectId)
- `error` - Optional. Error message describing why generation failed (defaults to "Video generation failed")

**Response (200):**
```json
{
  "success": true,
  "message": "Video failure recorded successfully",
  "data": {
    "videoId": "507f1f77bcf86cd799439011",
    "productId": "507f1f77bcf86cd799439012",
    "error": "Video generation failed due to insufficient resources"
  }
}
```

**Error Responses:**
- `400` - Bad Request (missing videoId or invalid format)
```json
{
  "success": false,
  "message": "videoId is required"
}
```
- `404` - Not Found (video not found)
```json
{
  "success": false,
  "message": "Video not found"
}
```
- `500` - Internal Server Error
```json
{
  "success": false,
  "message": "Failed to process video failure"
}
```

**Behavior:**
- Updates the AIVideo record status to `failed`
- Stores error message in the error field
- Also updates Product.videos array for dual storage compatibility
- Idempotent - can be called multiple times safely

**Security Notes:**
- These endpoints are NOT protected by JWT authentication
- They should only be accessible from trusted external services
- Consider implementing IP whitelisting or API key validation in production
- Always validate the videoId format and existence before processing

**Webhook Event Logging:**
- All webhook calls are automatically logged to the `WebhookEvent` collection
- Logs include the endpoint path and complete payload received
- Events can be queried via the Webhook Events endpoints (SUPERADMIN only)

---

## Webhook Events Endpoints

### GET /api/webhook-events
List all webhook events with pagination and filtering (SUPERADMIN only).

**Authentication:** Required (SUPERADMIN role)

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20, max: 100)
- `endpoint` - Filter by specific endpoint (optional)

**Example Request:**
```
GET /api/webhook-events?page=1&limit=20&endpoint=/videos/success
Authorization: Bearer <superadmin_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "_id": "65def456abc789012345",
        "endpoint": "/videos/success",
        "payload": {
          "videoId": "65abc123def456789012",
          "youtubeVideoId": "dQw4w9WgXcQ",
          "video_url": "https://cdn.example.com/video.mp4"
        },
        "createdAt": "2025-01-17T10:35:42.123Z"
      },
      {
        "_id": "65def456abc789012346",
        "endpoint": "/videos/failure",
        "payload": {
          "videoId": "65abc123def456789013",
          "error": "Processing timeout"
        },
        "createdAt": "2025-01-17T10:33:15.456Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "totalPages": 1
    }
  }
}
```

**Use Cases:**
- Audit trail of all webhook calls
- Debugging webhook integration issues
- Analyzing success/failure rates
- Historical webhook data retrieval

### GET /api/webhook-events/:id
Get a specific webhook event by ID (SUPERADMIN only).

**Authentication:** Required (SUPERADMIN role)

**Example Request:**
```
GET /api/webhook-events/65def456abc789012345
Authorization: Bearer <superadmin_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "65def456abc789012345",
    "endpoint": "/videos/success",
    "payload": {
      "videoId": "65abc123def456789012",
      "youtubeVideoId": "dQw4w9WgXcQ",
      "video_url": "https://cdn.example.com/video.mp4",
      "img_s3_url": "https://s3.amazonaws.com/thumbnail.jpg"
    },
    "createdAt": "2025-01-17T10:35:42.123Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Webhook event not found"
}
```

**Use Cases:**
- Inspect detailed webhook payload
- Verify what data was received for a specific event
- Troubleshooting individual webhook calls

## Error Responses

All error responses follow this format:
```json
{
  "message": "Error description"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `404` - Not Found
- `500` - Internal Server Error

## Health Check

#### GET /health
Check if the API is running.

**Response (200):**
```json
{
  "status": "OK",
  "message": "Racky API is running"
}
```

## Environment Setup

The backend requires the following environment variables:
- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `JWT_EXPIRES_IN` - Token expiration time

## Rate Limiting

The API implements rate limiting:
- 100 requests per 15 minutes per IP address

## Notes for Frontend Development

1. **Authentication**: Store the JWT token in localStorage or secure httpOnly cookies
2. **Error Handling**: Always check for error responses and handle them appropriately
3. **Loading States**: Implement loading indicators for API calls
4. **Real-time Updates**: Consider implementing WebSocket connections for real-time sync status updates
5. **Marketplace Credentials**: Handle sensitive marketplace credentials securely
6. **Pagination**: Future versions may implement pagination for large datasets

## Security Considerations

- All passwords are hashed using bcrypt
- JWT tokens expire after 7 days by default
- Rate limiting is implemented to prevent abuse
- Input validation is enforced on all endpoints
- CORS is configured for frontend domains

---

**Important:** This documentation will be updated as new features are added to the backend. Always refer to this file for the latest API specifications.