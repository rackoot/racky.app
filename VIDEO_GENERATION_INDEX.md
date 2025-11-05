# Video Generation Implementation - Complete Index

## Quick Navigation

This index provides quick access to all video generation documentation and source files.

### Documentation Files
1. **[VIDEO_GENERATION_GUIDE.md](./VIDEO_GENERATION_GUIDE.md)** - Comprehensive 500+ line detailed documentation
   - Full implementation overview
   - All components and services
   - API endpoints reference
   - Data models and schemas
   - Complete workflow diagrams
   - Error handling patterns
   - Subscription limits
   - Testing information

2. **[VIDEO_GENERATION_QUICK_REFERENCE.md](./VIDEO_GENERATION_QUICK_REFERENCE.md)** - Quick lookup guide
   - Error message locations
   - API endpoint quick reference
   - Status lifecycle diagram
   - Code examples
   - Common error messages and solutions
   - Template types
   - Subscription limits
   - Debugging tips
   - File locations summary

---

## Frontend Files

### Pages
| File | Purpose | Key Features |
|------|---------|--------------|
| [/client/src/pages/videos.tsx](./client/src/pages/videos.tsx) | Video management & listing | List, filter, search, pagination |
| [/client/src/pages/videos/generate.tsx](./client/src/pages/videos/generate.tsx) | Dedicated video generation | Product selection, template choice, custom instructions |
| [/client/src/pages/products.tsx](./client/src/pages/products.tsx) | Bulk video generation | Multi-select, batch operations |

### Components
| File | Purpose | Used By |
|------|---------|---------|
| [/client/src/components/videos/VideoUsageProgress.tsx](./client/src/components/videos/VideoUsageProgress.tsx) | Quota tracking display | Generate page, Videos page |
| [/client/src/components/videos/video-template-modal.tsx](./client/src/components/videos/video-template-modal.tsx) | Template selection modal | VideoContentTab, Products page |
| [/client/src/components/product/VideoContentTab.tsx](./client/src/components/product/VideoContentTab.tsx) | Product detail integration | Product detail page |
| [/client/src/components/product/OptimizationTabs.tsx](./client/src/components/product/OptimizationTabs.tsx) | Product optimization UI | Product detail page |

### API Client
| File | Purpose | Methods |
|------|---------|---------|
| [/client/src/api/resources/videos.ts](./client/src/api/resources/videos.ts) | Video API client | getVideos, createVideo, generateVideo, getUsageStats, etc. |

---

## Backend Files

### Routes
| File | Endpoints |
|------|-----------|
| [/server/src/modules/videos/routes/videos.ts](./server/src/modules/videos/routes/videos.ts) | GET/POST /api/videos, /api/videos/:id, /api/videos/templates, etc. |
| [/server/src/modules/videos/routes/internal.ts](./server/src/modules/videos/routes/internal.ts) | POST /internal/videos/success, /internal/videos/failure |

### Services
| File | Purpose |
|------|---------|
| [/server/src/modules/videos/services/videoService.ts](./server/src/modules/videos/services/videoService.ts) | Business logic: create, fetch, generate, update, delete videos |
| [/server/src/common/services/rckDescriptionService.ts](./server/src/common/services/rckDescriptionService.ts) | External RCK Description Server client |

### Models & Interfaces
| File | Purpose |
|------|---------|
| [/server/src/modules/videos/models/AIVideo.ts](./server/src/modules/videos/models/AIVideo.ts) | MongoDB AIVideo schema |
| [/server/src/modules/videos/interfaces/video.interface.ts](./server/src/modules/videos/interfaces/video.interface.ts) | TypeScript types and DTOs |

### Testing
| File | Purpose |
|------|---------|
| [/server/src/__tests__/integration/videos.test.ts](./server/src/__tests__/integration/videos.test.ts) | Integration tests for webhook endpoints |

---

## Error Message Reference

### "Failed to generate videos: Unknown error"
This error appears in three frontend locations and indicates video generation failure:

```
ERROR LOCATIONS:
├─ /client/src/pages/products.tsx (line 201)
│  └─ Bulk video generation catch block
│
├─ /client/src/components/product/VideoContentTab.tsx (line 54)
│  └─ Single product video generation
│
└─ /client/src/pages/videos/generate.tsx (line 143)
   └─ Dedicated generation page
```

**Root Cause:** Propagated from backend when RCK Description Server fails or is unreachable

**Error Flow:**
1. Frontend calls API endpoint
2. Backend calls external RCK service
3. RCK service fails/returns error
4. Backend catches error, sets video.status = "failed"
5. Frontend catches API error response
6. Displays generic error message to user

---

## API Endpoints Quick Reference

### Core Endpoints
```
GET    /api/videos                      # List videos (paginated)
POST   /api/videos                      # Create video record
GET    /api/videos/:id                  # Get single video
PUT    /api/videos/:id                  # Update video
DELETE /api/videos/:id                  # Delete video
POST   /api/videos/:id/generate         # START GENERATION
```

### Supporting Endpoints
```
GET    /api/videos/templates            # Get available templates
GET    /api/videos/usage/stats          # Get quota usage
```

### Webhook Endpoints (Unprotected)
```
POST   /internal/videos/success         # RCK success callback
POST   /internal/videos/failure         # RCK failure callback
```

### Legacy/Simulated Endpoints
```
POST   /api/videos/generate-for-product # Single product (simulated)
POST   /api/videos/bulk-generate        # Multiple products (simulated)
```

---

## Video Status Lifecycle

```
┌──────────┐
│ PENDING  │  (created, awaiting generation trigger)
└────┬─────┘
     │
     │ POST /api/videos/:id/generate
     ▼
┌──────────┐
│GENERATING│  (RCK service processing, ~30-120s)
└────┬─────┘
     │
     ├─────────────────────────┬──────────────────────┐
     │                         │                      │
     ▼                         ▼                      │
┌──────────┐            ┌────────┐                   │
│COMPLETED │            │ FAILED │                   │
│(video    │            │(error  │                   │
│ready)    │            │stored) │                   │
└──────────┘            └────────┘                   │
                                                     │
     On webhook /success ───────────────────────────┘
     or /failure
```

---

## Data Model Reference

### AIVideo Collection
```
_id: ObjectId
userId: ObjectId
workspaceId: ObjectId
productId: ObjectId
template: String (6 types: product_showcase, human_usage, etc.)
customInstructions: String (optional, max 500 chars)
generatedDate: Date
status: String (pending | generating | completed | failed)
metadata: Mixed (flexible object for generation details)
error: String (error message if failed)
createdAt: Date
updatedAt: Date
```

### Metadata Fields (stored during/after generation)
```
title: string
description: string
duration: number (seconds)
videoUrl: string
youtubeVideoId: string
localFilename: string
externalJobId: string (from RCK service)
completedAt: Date
failedAt: Date
[...other fields as needed]
```

---

## Workflow Steps

### 1. Video Creation (Frontend)
```typescript
await videosApi.createVideo({
  productId: 'xxx',
  template: 'product_showcase',
  customInstructions: 'optional text'
})
// Returns: AIVideo with status = "pending"
```

### 2. Generation Trigger (Frontend)
```typescript
await videosApi.generateVideo(videoId)
// Calls: POST /api/videos/:id/generate
// Returns: AIVideo with status = "generating"
```

### 3. RCK Processing (External)
```
RCK Service receives callback URL
Processes video asynchronously (30-120s)
When ready: calls POST /internal/videos/success
```

### 4. Status Update (Backend Webhook)
```
Webhook endpoint receives success payload
Validates videoId
Updates AIVideo: status = "completed", metadata populated
Also updates Product.videos array
Returns success response
```

### 5. Status Display (Frontend)
```
Frontend polls GET /api/videos/:id
Displays status badge
When completed: shows video with playback controls
```

---

## Subscription Plans & Limits

| Plan | Videos/Month | Description |
|------|--------------|-------------|
| Junior Contributors | 30 | Basic plan |
| Senior Contributors | 100 | Advanced features |
| Executive Contributors | 500 | Premium unlimited |

**Enforcement:** Checked in `VideoService.createVideo()` before creating record

**Tracking:** Via `Usage.videoGenerations` counter per workspace

---

## Development Checklist

### When Implementing Video Features
- [ ] Use `videosApi` service for API calls
- [ ] Include workspace context via `useWorkspace()`
- [ ] Check quota before user-facing generation
- [ ] Display `VideoUsageProgress` component
- [ ] Handle both success and error states
- [ ] Surface error messages from backend
- [ ] Test with webhook callbacks

### When Debugging
- [ ] Check video status: GET /api/videos/:id
- [ ] Verify RCK service: `rckDescriptionService.healthCheck()`
- [ ] Review backend logs for `[VideoService]` messages
- [ ] Check database for AIVideo records
- [ ] Verify webhook endpoint is accessible to RCK service
- [ ] Confirm workspace isolation in queries

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Failed to generate videos" | RCK service error | Check RCK service status, verify callback URL |
| "Video generation limit reached" | Quota exceeded | User needs plan upgrade |
| "RCK Description Server is not configured" | Missing env var | Set RCK_DESCRIPTION_SERVER_URL |
| Status stuck on "generating" | Webhook not called | Check RCK service, verify network |
| Templates not loading | RCK service unreachable | Retry, check service connectivity |

---

## Testing Strategy

### Unit Tests
- Service methods with mocked database
- API response formatting
- Error handling

### Integration Tests
- See: `/server/src/__tests__/integration/videos.test.ts`
- Webhook success callback
- Webhook failure callback
- Database updates
- Validation schemas

### E2E Tests
- Complete user flow from generation to completion
- Status updates in real-time
- Error recovery

---

## Performance Considerations

1. **Pagination**: Videos endpoint supports pagination (default 20 per page)
2. **Filtering**: Use status/productId filters to reduce result set
3. **Indexing**: Compound indexes on (userId, workspaceId, status)
4. **Async Processing**: Generation happens in background, not blocking
5. **Webhook Updates**: Direct database updates, no frontend polling required

---

## Security Notes

1. **Workspace Isolation**: All queries filtered by userId + workspaceId
2. **Webhook Validation**: VideoId validated as MongoDB ObjectId
3. **Unprotected Webhooks**: Intentional for external service callbacks
4. **Quota Enforcement**: Checked server-side, not client-side
5. **Error Details**: Generic error message to frontend, full details in logs

---

## File Summary Table

| Category | File | Lines |
|----------|------|-------|
| Frontend Pages | 3 files | ~1500 |
| Frontend Components | 4 files | ~1000 |
| Frontend API | 1 file | ~217 |
| Backend Routes | 2 files | ~423 |
| Backend Service | 1 file | ~307 |
| Backend Model | 1 file | ~89 |
| Backend Interfaces | 1 file | ~65 |
| RCK Client | 1 file | ~252 |
| Tests | 1 file | ~200+ |

**Total Implementation**: ~4000+ lines across 15 core files

---

## Related Files

- **Usage Tracking**: `/server/src/modules/subscriptions/models/Usage.ts`
- **Product Model**: `/server/src/modules/products/models/Product.ts`
- **RCK Config**: `/server/src/common/config/env.ts`
- **Plan Limits**: `/client/src/common/data/contributor-data.ts`

---

Last Updated: November 5, 2025
