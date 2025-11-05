# Video Generation - Quick Reference Guide

## Error Message: "Failed to generate videos: Unknown error"

This error occurs when bulk video generation fails. It appears in these locations:

| Location | Line | Trigger | Context |
|----------|------|---------|---------|
| `/client/src/pages/products.tsx` | 201 | Bulk video generation error | Products page bulk action |
| `/client/src/components/product/VideoContentTab.tsx` | 54, 58 | Single video generation error | Product detail page |
| `/client/src/pages/videos/generate.tsx` | 143 | Any generation failure | Dedicated generation page |

---

## API Endpoints Quick Reference

### Main Endpoints
```
GET    /api/videos                      # List videos (paginated, filterable)
POST   /api/videos                      # Create video record (status: pending)
GET    /api/videos/:id                  # Get single video
PUT    /api/videos/:id                  # Update video
DELETE /api/videos/:id                  # Delete video
POST   /api/videos/:id/generate         # START GENERATION (main endpoint)
GET    /api/videos/templates            # Get available templates from RCK
GET    /api/videos/usage/stats          # Get quota usage
```

### Legacy/Simulated Endpoints
```
POST   /api/videos/generate-for-product  # Single product (simulated, no RCK call)
POST   /api/videos/bulk-generate         # Multiple products (simulated, no RCK call)
```

### Internal Webhooks (Not Protected)
```
POST   /internal/videos/success         # RCK service callback on completion
POST   /internal/videos/failure         # RCK service callback on failure
```

---

## Video Status Lifecycle

```
┌─────────┐
│ PENDING │  (created, waiting to generate)
└────┬────┘
     │ POST /api/videos/:id/generate
     ▼
┌──────────┐
│GENERATING│  (RCK service processing)
└────┬─────┘
     │
     ├─ Webhook /success ──► COMPLETED (video ready)
     │
     └─ Webhook /failure ──► FAILED (error stored)
```

---

## Frontend API Usage

### 1. Create & Generate Video (Two-Step Process)
```typescript
// Step 1: Create video record
const video = await videosApi.createVideo({
  productId: '123',
  template: 'product_showcase',
  customInstructions: 'Make it vibrant'
})

// Step 2: Start generation
await videosApi.generateVideo(video._id)
```

### 2. Fetch Videos List
```typescript
const response = await videosApi.getVideos({
  page: 1,
  limit: 20,
  status: 'completed',
  search: 'product name',
  sortBy: 'createdAt',
  sortOrder: 'desc'
})
```

### 3. Get Usage Stats
```typescript
const stats = await videosApi.getUsageStats()
// Returns: { used, limit, remaining, percentage }
```

### 4. Get Templates
```typescript
const templates = await videosApi.getVideoTemplates()
// Returns: { success, templates[], error }
```

---

## Backend Service Methods

### VideoService
```typescript
VideoService.createVideo(userId, workspaceId, data)
  // Creates pending video, checks quota
  
VideoService.generateVideo(userId, workspaceId, videoId)
  // Main logic: updates status, calls RCK service
  
VideoService.getVideos(userId, workspaceId, query)
  // List with filters and pagination

VideoService.getVideoById(userId, workspaceId, videoId)
  // Single video fetch

VideoService.updateVideo(userId, workspaceId, videoId, data)
  // Update video properties

VideoService.deleteVideo(userId, workspaceId, videoId)
  // Remove video record
```

### RCKDescriptionService
```typescript
rckDescriptionService.getVideoTemplates()
  // GET /api/v1/templates from RCK server
  
rckDescriptionService.generateVideo(params)
  // POST /api/v1/create-images-batch
  // Takes: product data + callback URL
  // Returns: { job_id, ... }
  
rckDescriptionService.bulkGenerateVideos(products)
  // Batch video generation
  
rckDescriptionService.getJobStatus(jobId)
  // Check generation progress
```

---

## Key Data Models

### AIVideo Schema (MongoDB)
```
{
  _id: ObjectId
  userId: ObjectId
  workspaceId: ObjectId
  productId: ObjectId
  template: 'product_showcase' | 'human_usage' | ...
  customInstructions?: string (max 500 chars)
  generatedDate: Date
  status: 'pending' | 'generating' | 'completed' | 'failed'
  metadata: {
    title?: string
    description?: string
    duration?: number
    videoUrl?: string
    youtubeVideoId?: string
    localFilename?: string
    externalJobId?: string
    completedAt?: Date
    failedAt?: Date
    [key: string]: any
  }
  error?: string
  createdAt: Date
  updatedAt: Date
}
```

---

## Error Handling Flow

### When RCK Service Fails

```
POST /api/videos/:id/generate
  ↓
VideoService.generateVideo()
  ↓
rckDescriptionService.generateVideo()
  ↓ [ERROR - RCK unreachable/error response]
  ↓
Catch block updates:
  - video.status = 'failed'
  - video.error = error message
  ↓
Throws error to controller
  ↓
Controller responds 500 with error message
  ↓
Frontend shows: "Failed to generate video: {error message}"
```

---

## Video Generation Timeline

| Time | Component | Action |
|------|-----------|--------|
| 0s | Frontend | User submits video generation |
| 0s | Backend | POST /api/videos/generate |
| 0s | Service | Video status = "generating" |
| 0s | RCK Service | Receives request, queues for processing |
| 30s-120s | RCK Service | Generates video file |
| 30s-120s | RCK Service | Calls callback webhook |
| 30s-120s | Backend | POST /internal/videos/success webhook |
| 30s-120s | Database | Video status = "completed", metadata saved |
| 30s-120s | Frontend | User sees "Completed" badge, video URL available |

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Video generation limit reached" | Monthly quota exceeded | Upgrade subscription |
| "RCK Description Server is not configured" | Env var missing | Set RCK_DESCRIPTION_SERVER_URL |
| "RCK Description Server is unreachable" | Service down | Check RCK service status |
| "Product not found" | Invalid product ID | Verify product exists |
| "Video not found or already generating" | Invalid video ID or wrong status | Check video status |
| "Failed to load video templates" | RCK service error | Retry, check RCK service |

---

## Video Templates (6 Types)

| Template | Description |
|----------|-------------|
| `product_showcase` | Classic rotating product presentation |
| `human_usage` | Product being used by real people |
| `store_display` | Product in retail environment |
| `lifestyle` | Product in daily life scenarios |
| `technical_demo` | Feature/functionality demonstration |
| `unboxing` | Engaging unboxing experience |

---

## Subscription Limits

| Plan | Monthly Videos |
|------|----------------|
| Junior Contributors | 30 |
| Senior Contributors | 100 |
| Executive Contributors | 500 |

Tracked via `Usage.videoGenerations` field per workspace.

---

## Frontend Components Tree

```
videosApi (service)
  ├─ pages/videos.tsx (list page)
  │   └─ VideoUsageProgress (quota bar)
  │
  ├─ pages/videos/generate.tsx (dedicated generator)
  │   └─ VideoUsageProgress
  │
  ├─ components/videos/video-template-modal.tsx
  │   └─ Uses getVideoTemplates()
  │
  └─ components/product/VideoContentTab.tsx
      └─ Uses generateVideoForProduct()
```

---

## Important Notes

1. **Two-Step Generation**: Create record first (POST /api/videos), then trigger generation (POST /api/videos/:id/generate)
2. **Asynchronous**: Generation takes 2-5 minutes, user sees status updates in real-time
3. **Webhook Driven**: RCK service calls /internal/videos/success when done
4. **Workspace Scoped**: All operations filtered by workspace and user
5. **Dual Storage**: Videos stored in both AIVideo collection AND Product.videos array
6. **Custom Instructions**: 500 character limit, optional
7. **Product Images Required**: Video generation needs at least one product image

---

## Debugging Tips

### Check Video Status
```bash
# Get all videos for a workspace
GET /api/videos?page=1&limit=100&status=generating

# Get specific video
GET /api/videos/:id
```

### Check External Service
```bash
# In server, test RCK connection
const health = await rckDescriptionService.healthCheck()
console.log(health)

# Test template fetch
const templates = await rckDescriptionService.getVideoTemplates()
console.log(templates)
```

### Monitor Logs
- Backend: Look for `[VideoService]` and `[RCK Description Service]` logs
- Frontend: Check browser console for API call errors
- Database: Check AIVideo collection status field

---

## File Locations Summary

| Component | Path |
|-----------|------|
| Pages | `/client/src/pages/videos*.tsx` |
| Components | `/client/src/components/videos/` |
| API Service | `/client/src/api/resources/videos.ts` |
| Routes | `/server/src/modules/videos/routes/*.ts` |
| Service Logic | `/server/src/modules/videos/services/videoService.ts` |
| Model | `/server/src/modules/videos/models/AIVideo.ts` |
| Interfaces | `/server/src/modules/videos/interfaces/video.interface.ts` |
| RCK Client | `/server/src/common/services/rckDescriptionService.ts` |
| Tests | `/server/src/__tests__/integration/videos.test.ts` |

