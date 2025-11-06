# Video Generation Implementation - Comprehensive Overview

## Summary
The Racky application implements a complete AI-powered video generation system that integrates with an external RCK Description Server. Videos are created for marketplace products using AI templates and tracked through a MongoDB-based workflow with webhook callbacks.

---

## Frontend Implementation

### 1. Pages
#### `/client/src/pages/videos/generate.tsx`
- **Purpose**: Dedicated page for generating individual videos
- **Key Features**:
  - Product selection dropdown with marketplace info
  - 6 video template options (product_showcase, human_usage, store_display, lifestyle, technical_demo, unboxing)
  - Custom instructions textarea (max 500 chars)
  - Video usage progress tracking
  - Confirmation dialog before generation
  - Product preview with images and details
  - Workspace context integration via `useWorkspace()`

#### `/client/src/pages/videos.tsx`
- **Purpose**: Video management and listing page
- **Key Features**:
  - List all videos for current workspace with pagination (20 per page)
  - Filter by status: pending, generating, completed, failed
  - Search by title/description
  - Sort by createdAt or generatedDate
  - Status badges with animated icons
  - View completed videos or regenerate pending videos
  - Flash message for newly generated videos (auto-hides after 10s)
  - Video usage progress bar

#### `/client/src/pages/products.tsx`
- **Purpose**: Bulk video generation from products page
- **Key Features**:
  - Multi-select products for bulk operations
  - `handleBulkGenerateVideo()` function at line 170-206
  - Calls `videosApi.bulkGenerateVideos(productIds, templateId, templateName)`
  - **Error Message**: "Failed to generate videos: Unknown error" (line 201)
  - Shows success/error alerts to user

### 2. Components

#### `/client/src/components/videos/VideoUsageProgress.tsx`
- **Purpose**: Displays video quota consumption
- **Key Metrics**:
  - Used vs limit display
  - Progress bar with color coding (blue < 75%, yellow 75-90%, red > 90%)
  - Remaining count and percentage
  - Status badges: Available, Almost Full, Limit Reached
  - Warning message when approaching limit

#### `/client/src/components/videos/video-template-modal.tsx`
- **Purpose**: Template selection modal for video generation
- **Features**:
  - Fetches templates from RCK Description Server via `videosApi.getVideoTemplates()`
  - YouTube embed preview of template samples
  - Template description display
  - Error handling with retry option
  - Loading state with spinner
  - Dropdown for template selection
  - **Error Message Handling**: Shows RCK service errors or "Failed to load video templates"

#### `/client/src/components/product/VideoContentTab.tsx`
- **Purpose**: Video generation tab in product detail page
- **Features**:
  - Shows latest video status (pending, processing, completed, failed)
  - Displays generated video with controls
  - Shows product images used for generation
  - AI video generation info box
  - "Generate Product Video" or "Generate New Video" button
  - Opens VideoTemplateModal on click
  - Calls `videosApi.generateVideoForProduct(productId, templateId, templateName)`
  - **Error Message**: "Failed to generate video: Unknown error" (line 54, 58)

#### `/client/src/components/product/OptimizationTabs.tsx`
- **Purpose**: Product optimization features including video generation
- **Similar error handling** to VideoContentTab

### 3. API Services

#### `/client/src/api/resources/videos.ts`
- **Endpoints Configuration**:
  - `LIST`: `/videos` - Get all videos
  - `GET`: `/videos/{id}` - Get single video
  - `CREATE`: `/videos` - Create video record
  - `UPDATE`: `/videos/{id}` - Update video
  - `DELETE`: `/videos/{id}` - Delete video
  - `GENERATE`: `/videos/{id}/generate` - Start generation
  - `USAGE_STATS`: `/videos/usage/stats` - Get quota stats
  - `TEMPLATES`: `/videos/templates` - Get available templates
  - `GENERATE_FOR_PRODUCT`: `/videos/generate-for-product` - Single product generation
  - `BULK_GENERATE`: `/videos/bulk-generate` - Bulk generation

- **Key Methods**:
  ```typescript
  videosApi.getVideos(query)           // Fetch videos list
  videosApi.getVideoById(id)           // Get single video
  videosApi.createVideo(data)          // Create video record
  videosApi.generateVideo(id)          // Start generation
  videosApi.getUsageStats()            // Get quota info
  videosApi.getVideoTemplates()        // Get templates from RCK
  videosApi.generateVideoForProduct()  // Generate single product video
  videosApi.bulkGenerateVideos()       // Generate multiple videos
  ```

---

## Backend Implementation

### 1. Data Model

#### `/server/src/modules/videos/models/AIVideo.ts`
- **Database Collection**: `aivideos`
- **Fields**:
  ```
  _id: ObjectId (primary key)
  userId: ObjectId (ref: User) - required
  workspaceId: ObjectId (ref: Workspace) - required
  productId: ObjectId (ref: Product) - required
  template: String (enum: product_showcase, human_usage, store_display, lifestyle, technical_demo, unboxing)
  customInstructions: String (optional, max 500 chars)
  generatedDate: Date
  status: String (enum: pending, generating, completed, failed)
  metadata: Mixed (flexible object storing generation details):
    - title?: string (from external service)
    - description?: string (from external service)
    - duration?: number (seconds)
    - format?: string (video format)
    - resolution?: string (1080p, 4K, etc.)
    - fileSize?: number (bytes)
    - videoUrl?: string (final video URL)
    - thumbnailUrl?: string
    - generationTime?: number (ms)
    - aiModel?: string (which AI model)
    - externalJobId?: string (RCK service job ID)
    - youtubeVideoId?: string (YouTube video ID)
    - localFilename?: string (file path on server)
    - completedAt?: Date
    - failedAt?: Date
  error?: string (error message if failed)
  createdAt: Date
  updatedAt: Date
  ```

- **Indexes**:
  - Single: userId, workspaceId, status, template
  - Compound: (userId, workspaceId, status), (workspaceId, createdAt DESC), (productId, createdAt DESC)

### 2. API Routes

#### `/server/src/modules/videos/routes/videos.ts`

**GET /api/videos**
- Fetch all videos for workspace
- Query params: page, limit, status, productId, search, sortBy, sortOrder
- Returns: `{ success: true, data: { videos: [], pagination: {...} } }`

**GET /api/videos/templates**
- Fetch available templates from RCK Description Server
- **Service Call**: `rckDescriptionService.getVideoTemplates()`
- **Error Handling**: Returns 503 if RCK server not configured
- Returns RCK response: `{ success, message, templates, error }`

**GET /api/videos/usage/stats**
- Get video quota usage for current workspace
- Returns: `{ success: true, data: { used, limit, remaining, percentage } }`

**GET /api/videos/:id**
- Fetch single video by ID
- **Error Handling**: 404 if not found

**POST /api/videos**
- Create new video record (status: pending)
- **Request**: `{ productId, template, customInstructions?, metadata? }`
- **Checks**:
  1. Video generation limit validation
  2. Product existence and workspace ownership
- **Side Effect**: Increments workspace usage counter
- Returns: VideoResponse

**POST /api/videos/generate-for-product**
- Legacy endpoint for single product video generation
- **Request**: `{ productId, templateId, templateName }`
- **Status**: Currently simulated (external API call commented out)
- Adds video to Product.videos array with "processing" status

**POST /api/videos/bulk-generate**
- Legacy endpoint for bulk video generation
- **Request**: `{ productIds[], templateId, templateName }`
- **Status**: Currently simulated (external API call commented out)
- Updates multiple products with "processing" videos
- **Error Message at Line 344**: "Failed to generate videos"

**POST /api/videos/:id/generate**
- **MAIN GENERATION ENDPOINT**
- Transitions video from pending → generating
- **Key Logic**:
  1. Validates video exists and status is "pending"
  2. Sets status to "generating" and generatedDate
  3. Calls `rckDescriptionService.generateVideo()` with:
     - Product details (id, title, image URL)
     - Template name
     - Video ID (for webhook callback)
     - Callback URL: `{SERVER_URL}/internal/videos/success`
  4. Stores external job ID from RCK service
  5. **Error Handling** (lines 266-274):
     - Catches any error from RCK service
     - Sets video status to "failed"
     - Stores error message in video.error field
     - Throws error to client

**PUT /api/videos/:id**
- Update video metadata
- **Request**: `{ template?, customInstructions?, status?, metadata?, error? }`

**DELETE /api/videos/:id**
- Delete video record

### 3. Service Layer

#### `/server/src/modules/videos/services/videoService.ts`

**VideoService.createVideo(userId, workspaceId, data)**
- Creates pending video record
- **Checks**:
  - Video generation quota against Usage model
  - Product ownership (userId + workspaceId)
- **Side Effect**: Increments Usage.videoGenerations counter
- **Error if limit reached**: "Video generation limit reached. You have used X/Y videos for this billing period..."

**VideoService.getVideos(userId, workspaceId, query)**
- Lists videos with filters and pagination
- Joins with Product data
- Returns formatted VideoResponse array

**VideoService.getVideoById(userId, workspaceId, videoId)**
- Fetch single video with product details

**VideoService.updateVideo(userId, workspaceId, videoId, data)**
- Update video properties

**VideoService.deleteVideo(userId, workspaceId, videoId)**
- Delete video record

**VideoService.generateVideo(userId, workspaceId, videoId)**
- **CORE GENERATION LOGIC** (lines 205-278)
- **Steps**:
  1. Find video with status = "pending"
  2. Update status to "generating"
  3. Fetch product data
  4. Create callback URL: `{SERVER_URL}/internal/videos/success`
  5. Call `rckDescriptionService.generateVideo()` with:
     ```
     {
       id_product: product._id,
       title: product.title,
       img_url: product.images[0]?.url,
       user_id: userId,
       sku: product.sku,
       template_name: video.template,
       video_id: videoId (for webhook),
       callback_url: callbackUrl
     }
     ```
  6. Store external job ID in metadata
  7. **Error Handling**:
     - Catches RCK service errors
     - Sets video.status = "failed"
     - Sets video.error = error message
     - Throws error to controller

### 4. Internal Webhook Routes

#### `/server/src/modules/videos/routes/internal.ts`
- **Not Protected** - Called by external RCK service

**POST /internal/videos/success**
- Called when video generation completes
- **Payload**:
  ```json
  {
    "videoId": "MongoDB video ID",
    "youtubeVideoId": "YouTube ID (optional)",
    "localFilename": "file path (optional)",
    "video_url": "direct video URL (optional)",
    "id_product": "product ID (backward compat)"
  }
  ```
- **Logic**:
  1. Validates videoId is valid MongoDB ObjectId
  2. Finds AIVideo record
  3. Updates status to "completed"
  4. Stores metadata: youtubeVideoId, localFilename, videoUrl, completedAt
  5. Also updates Product.videos array (dual storage)
  6. Returns success response

**POST /internal/videos/failure**
- Called when video generation fails
- **Payload**:
  ```json
  {
    "videoId": "MongoDB video ID",
    "error": "error message (optional)",
    "id_product": "product ID (backward compat)"
  }
  ```
- **Logic**:
  1. Validates videoId
  2. Finds AIVideo record
  3. Updates status to "failed"
  4. Stores error message and failedAt timestamp
  5. Also updates Product.videos array
  6. Returns success response

### 5. External Service Integration

#### `/server/src/common/services/rckDescriptionService.ts`
- **Purpose**: Communication with external RCK Description Server
- **Configuration**: 
  - Base URL from `env.RCK_DESCRIPTION_SERVER_URL`
  - Axios client with 60s timeout
  - SSL certificate validation disabled (for self-signed certs)

**Key Methods**:

`async getVideoTemplates()`
- **Endpoint**: `POST /api/v1/templates`
- **Returns**: `{ success, message, templates[], error }`

`async generateVideo(params)`
- **Endpoint**: `POST /api/v1/create-images-batch`
- **Params**: Video generation request with product data and callback URL
- **Returns**: `{ job_id, ... }` or throws error

`async getJobStatus(jobId)`
- **Endpoint**: `GET /api/jobs/:jobId`
- **Returns**: Job status and results

`async bulkGenerateVideos(products)`
- **Endpoint**: `POST /api/v1/create-images-batch`
- **Params**: Array of product video requests
- **Returns**: Bulk job details

**Error Handling**:
- Server response errors: Returns message from RCK service
- Request made but no response: "RCK Description Server is unreachable"
- Request error: "RCK Description Service error: {error message}"

### 6. Video Generation Flow (Complete Workflow)

```
1. FRONTEND: User selects product, template, custom instructions
   └─> POST /api/videos (creates pending video record)
       └─> Service creates AIVideo with status = "pending"
       └─> Usage counter incremented
       └─> Returns VideoResponse

2. FRONTEND: User clicks "Generate Video"
   └─> POST /api/videos/:id/generate (start generation)
       └─> Service.generateVideo()
           └─> Validates video status = "pending"
           └─> Updates status = "generating"
           └─> Calls rckDescriptionService.generateVideo()
               └─> HTTP POST /api/v1/create-images-batch
               └─> RCK Service receives product data & callback URL
               └─> Returns job_id

3. RCK SERVICE (External): Processes video generation asynchronously
   └─> ~2 minutes processing time
   └─> Generates video file
   └─> Calls callback URL with video details

4. BACKEND: Webhook receives completion callback
   └─> POST /internal/videos/success (from RCK service)
       └─> Validates videoId
       └─> Finds AIVideo record
       └─> Updates status = "completed"
       └─> Stores metadata (videoUrl, youtubeVideoId, etc.)
       └─> Also updates Product.videos array

5. FRONTEND: Polls video status or listens for updates
   └─> GET /api/videos (shows completed video)
   └─> Or GET /api/videos/:id (individual video details)
   └─> Status badge changes from "Generating" to "Completed"
   └─> Video URL available for playback
```

---

## Error Handling & Error Messages

### Frontend Error Messages

1. **"Failed to generate videos: Unknown error"** 
   - Location: `/client/src/pages/products.tsx` line 201
   - Trigger: Bulk video generation catch block
   - User sees: Alert dialog with error message

2. **"Failed to generate video: Unknown error"**
   - Location: `/client/src/components/product/VideoContentTab.tsx` line 54
   - Trigger: Single product video generation error
   - Surfaces API error message or generic fallback

3. **"Failed to load video templates. The RCK Description Server may be offline."**
   - Location: `/client/src/components/videos/video-template-modal.tsx` line 88
   - Trigger: Template fetch error
   - Shows retry button

### Backend Error Responses

1. **Video Creation Errors**:
   - Quota limit reached: "Video generation limit reached. You have used X/Y videos..."
   - Product not found: 404 "Product not found"
   - Missing productId: 400 "Product ID is required"

2. **Generation Errors**:
   - Video not found/already generating: 400 "Video not found or already generating"
   - RCK service failure: 500 with error message from external service
   - Invalid request: 400 with validation error

3. **Template Fetch Errors**:
   - Service not configured: 503 "RCK Description Server is not configured"
   - Service unreachable: 500 "RCK Description Server is unreachable..."
   - Service error: 500 with message from RCK

4. **Webhook Errors**:
   - Invalid videoId: 400 "Invalid videoId format"
   - Video not found: 404 "Video not found"
   - Generic error: 500 "Failed to process video completion/failure"

---

## Status Lifecycle

```
PENDING
  ↓
GENERATING (when POST /api/videos/:id/generate called)
  ├─→ COMPLETED (when webhook receives success callback)
  └─→ FAILED (when webhook receives failure callback OR RCK call throws error)
```

**Status Meanings**:
- **pending**: Video created, waiting to be generated
- **generating**: RCK service is processing the video
- **completed**: Video successfully generated, URL available
- **failed**: Generation failed, error message stored

---

## Subscription Limits & Usage Tracking

### Usage Model Integration
- Each workspace has monthly video generation limit
- Tracked in Usage model via `Usage.incrementWorkspaceUsage(workspaceId, 'videoGenerations', 1)`
- **Limits by Plan** (see `client/src/common/data/contributor-data.ts`):
  - Junior Contributors: 30 videos/month
  - Senior Contributors: 100 videos/month
  - Executive Contributors: 500 videos/month

### Quota Check (Before Generation)
```typescript
// In VideoService.createVideo()
const currentUsage = await Usage.getCurrentMonthUsage(workspaceId)
if (videoCount >= videoLimit) {
  throw new Error(`Video generation limit reached...`)
}
```

---

## Testing

### Test Coverage
- Location: `/server/src/__tests__/integration/videos.test.ts`
- Tests webhook success and failure callbacks
- Verifies AIVideo and Product.videos updates
- Validates JSON schema of webhook payloads

---

## Key Integration Points

1. **RCK Description Server**: External AI service for video generation
2. **Usage Model**: Tracks quota consumption per workspace
3. **Product Model**: Stores dual video array for legacy compatibility
4. **Workspace Context**: Frontend ensures workspace-scoped operations
5. **Webhook System**: External service notifies completion/failure

---

## Development Notes

- Video generation is asynchronous (2-5 minute typical processing time)
- Bulk operations are not atomic - some may succeed while others fail
- Template list is cached from RCK server in frontend
- Product images must exist for video generation
- Custom instructions limited to 500 characters
- Error messages are surfaced from RCK service when available

