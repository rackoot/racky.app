# Bulk Actions UX Pattern - Reference for Future Features

This document describes the UI/UX pattern implemented for bulk AI description generation, which can be used as a template for other bulk operations like video generation.

---

## Overview

The bulk action pattern allows users to select multiple products and trigger background processing jobs for each. The UI provides immediate feedback and real-time status updates through visual badges.

---

## Components Involved

### 1. **Products List Page** (`/client/src/pages/products.tsx`)

#### Selection State Management
```typescript
const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

// Toggle individual product selection
const handleSelectProduct = (productId: string) => {
  setSelectedProducts(prev =>
    prev.includes(productId)
      ? prev.filter(id => id !== productId)
      : [...prev, productId]
  );
};

// Select all products on current page
const handleSelectAll = () => {
  if (selectedProducts.length === products.length) {
    setSelectedProducts([]);
  } else {
    setSelectedProducts(products.map(p => p._id));
  }
};
```

#### Bulk Action Button
```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" disabled={selectedProducts.length === 0}>
      <CheckSquare className="w-4 h-4 mr-2" />
      Bulk Actions ({selectedProducts.length})
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handleBulkGenerateDescription}>
      <Sparkles className="w-4 h-4 mr-2" />
      Generate AI Descriptions
    </DropdownMenuItem>
    {/* Future: Add video generation here */}
  </DropdownMenuContent>
</DropdownMenu>
```

#### Status Badge Display
Products show their current AI description status with visual indicators:

```typescript
{product.aiDescriptionStatus === 'processing' ? (
  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
    Processing...
  </Badge>
) : product.aiDescriptionStatus === 'pending' ? (
  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
    <Clock className="w-3 h-3 mr-1" />
    Pending Approval
  </Badge>
) : product.aiDescriptionStatus === 'accepted' ? (
  <Badge variant="default" className="bg-green-50 text-green-700 border-green-300">
    <Check className="w-3 h-3 mr-1" />
    Accepted
  </Badge>
) : product.aiDescriptionStatus === 'rejected' ? (
  <Badge variant="destructive">
    <X className="w-3 h-3 mr-1" />
    Rejected
  </Badge>
) : null}
```

#### Bulk Action Handler
```typescript
const handleBulkGenerateDescription = async () => {
  if (selectedProducts.length === 0) return;

  try {
    const response = await optimizationsApi.bulkGenerateDescriptions(selectedProducts);

    if (response.success) {
      toast({
        title: "Success",
        description: `Queued ${response.data.queuedCount} product(s) for AI description generation`,
      });

      // Clear selection
      setSelectedProducts([]);

      // Refresh product list to show "Processing..." badges
      loadProducts();
    }
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.message || "Failed to queue products for description generation",
      variant: "destructive"
    });
  }
};
```

---

## Backend Implementation

### 2. **API Endpoint** (`/server/src/modules/opportunities/routes/optimizations.ts`)

```typescript
// POST /api/optimizations/products/bulk/description
router.post('/products/bulk/description', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await protect(req, res, async () => {
      const { productIds } = req.body;
      const workspaceId = req.workspace!._id;
      const userId = req.user!._id;

      // Validate input
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Product IDs array is required'
        });
      }

      // Verify all products belong to this workspace
      const products = await Product.find({
        _id: { $in: productIds },
        workspaceId
      });

      if (products.length !== productIds.length) {
        return res.status(404).json({
          success: false,
          message: 'Some products not found or do not belong to this workspace'
        });
      }

      // Import RabbitMQ service
      const rabbitMQService = (await import('@/common/services/rabbitMQService')).default;

      // Generate unique batch ID for tracking
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Queue each product for processing
      const queuedProducts: string[] = [];
      const failedProducts: string[] = [];

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const marketplace = product.marketplace || 'shopify';

        try {
          const jobData = {
            productId: product._id.toString(),
            workspaceId: workspaceId.toString(),
            userId: userId.toString(),
            marketplace,
            batchId,
            totalInBatch: products.length,
            currentIndex: i + 1
          };

          // Add job to RabbitMQ queue
          const jobId = await rabbitMQService.addJob(
            'ai-description',
            JobType.AI_DESCRIPTION_GENERATION,
            jobData
          );

          if (jobId) {
            queuedProducts.push(product._id.toString());

            // Mark product as "processing" immediately in database
            const cachedIndex = product.cachedDescriptions?.findIndex(
              (cached: any) => cached.platform === marketplace
            );

            if (cachedIndex !== undefined && cachedIndex >= 0 && product.cachedDescriptions) {
              product.cachedDescriptions[cachedIndex].status = 'processing';
              product.cachedDescriptions[cachedIndex].content = '';
            } else {
              product.cachedDescriptions = product.cachedDescriptions || [];
              product.cachedDescriptions.push({
                platform: marketplace as any,
                content: '',
                confidence: 0,
                keywords: [],
                tokens: 0,
                createdAt: new Date(),
                status: 'processing'
              });
            }

            await product.save();
          } else {
            failedProducts.push(product._id.toString());
          }
        } catch (error: any) {
          console.error(`Failed to queue product ${product._id}:`, error);
          failedProducts.push(product._id.toString());
        }
      }

      res.json({
        success: true,
        message: `Queued ${queuedProducts.length} product(s) for AI description generation`,
        data: {
          batchId,
          queuedCount: queuedProducts.length,
          failedCount: failedProducts.length,
          queuedProducts,
          failedProducts
        }
      });
    });
  } catch (error: any) {
    console.error('Error bulk generating descriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk generate descriptions'
    });
  }
});
```

### 3. **Background Worker** (`/server/src/modules/opportunities/services/descriptionWorker.ts`)

```typescript
export async function processAIDescriptionJob(
  job: { id: string; data: AIDescriptionJob; progress: (value: number) => Promise<void> }
): Promise<void> {
  const { productId, workspaceId, userId, marketplace, totalInBatch, currentIndex } = job.data;

  console.log(`[Worker] Processing AI description for product ${productId} (${currentIndex}/${totalInBatch || '?'})`);

  try {
    // 1. Find the product
    const product = await Product.findOne({ _id: productId, workspaceId });
    if (!product) {
      console.error(`[Worker] Product not found: ${productId}`);
      return;
    }

    // 2. Mark as processing if not already
    const existingCached = product.cachedDescriptions?.find(
      (cached: any) => cached.platform === marketplace
    );

    if (!existingCached) {
      product.cachedDescriptions = product.cachedDescriptions || [];
      product.cachedDescriptions.push({
        platform: marketplace as any,
        content: '',
        confidence: 0,
        keywords: [],
        tokens: 0,
        createdAt: new Date(),
        status: 'processing'
      });
      await product.save();
    }

    // 3. Generate AI content
    const productData = {
      title: product.title,
      description: product.description,
      price: product.price || 0,
      marketplace: product.marketplace || marketplace,
      inventory: product.inventory,
      sku: product.sku,
      productType: product.productType,
      images: product.images?.map((img: any) => img.url),
      tags: product.tags
    };

    const result = await aiService.generateProductDescription(productData);

    // 4. Update product with generated content (status: pending)
    const cachedIndex = product.cachedDescriptions?.findIndex(
      (cached: any) => cached.platform === marketplace
    );

    if (cachedIndex !== undefined && cachedIndex >= 0 && product.cachedDescriptions) {
      product.cachedDescriptions[cachedIndex] = {
        platform: marketplace as any,
        content: result.description,
        confidence: result.confidence,
        keywords: extractKeywords(result.description, product.tags || []),
        tokens: result.tokens,
        createdAt: new Date(),
        status: 'pending' // User must accept/reject
      };
    }

    await product.save();

    // 5. Create history entry
    await ProductHistoryService.markCompleted(
      historyEntry._id.toString(),
      'SUCCESS',
      {
        confidence: result.confidence,
        tokensUsed: result.tokens,
        newContent: result.description
      }
    );

    console.log(`✅ [Worker] AI description generated for product ${productId}`);

  } catch (error: any) {
    console.error(`❌ [Worker] Failed to generate AI description:`, error);

    // Update product with error status
    const product = await Product.findOne({ _id: productId, workspaceId });
    if (product) {
      const cachedIndex = product.cachedDescriptions?.findIndex(
        (cached: any) => cached.platform === marketplace
      );

      if (cachedIndex !== undefined && cachedIndex >= 0 && product.cachedDescriptions) {
        product.cachedDescriptions[cachedIndex].status = 'rejected';
        product.cachedDescriptions[cachedIndex].content = `Error: ${error.message}`;
        await product.save();
      }
    }
  }
}
```

### 4. **RabbitMQ Job Setup** (`/server/src/jobs/rabbitMQJobSetup.ts`)

```typescript
// Register the worker processor with RabbitMQ
rabbitMQService.process(
  'ai-description',                        // Queue name
  JobType.AI_DESCRIPTION_GENERATION,       // Job type enum
  3,                                        // Concurrency: 3 workers
  processAIDescriptionJob as any           // Worker function
);
```

---

## Data Model Changes

### 5. **Product Model** (`/server/src/modules/products/models/Product.ts`)

```typescript
export type CachedDescriptionStatus = 'processing' | 'pending' | 'accepted' | 'rejected';

export interface ICachedDescription {
  platform: CachedDescriptionPlatform;
  content: string;
  confidence?: number;
  keywords: string[];
  tokens?: number;
  createdAt: Date;
  status: CachedDescriptionStatus;
}

// In schema
cachedDescriptions: [{
  platform: {
    type: String,
    enum: ['shopify', 'amazon', 'mercadolibre', 'woocommerce', 'vtex', 'facebook_shop', 'google_shopping'],
    required: true
  },
  content: { type: String, required: false, default: '' },
  confidence: { type: Number, min: 0, max: 1 },
  keywords: [{ type: String }],
  tokens: { type: Number },
  createdAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['processing', 'pending', 'accepted', 'rejected'],
    default: 'processing'
  }
}]

// Virtual field for quick status check
productSchema.virtual('aiDescriptionStatus').get(function() {
  if (this.cachedDescriptions.length === 0) {
    return null;
  }
  const latest = this.cachedDescriptions[this.cachedDescriptions.length - 1];
  return latest.status;
});
```

---

## Job Type Configuration

### 6. **Job Types** (`/server/src/common/types/jobTypes.ts`)

```typescript
export enum JobType {
  // ... other types
  AI_DESCRIPTION_GENERATION = 'ai-description-generation',
  // Future: VIDEO_GENERATION = 'video-generation',
}

export interface AIDescriptionGenerationJobData {
  userId: string;
  workspaceId: string;
  productId: string;
  marketplace: string;
  createdAt: Date;
  priority: JobPriority;
  metadata?: Record<string, any>;
}

// Add to union type
export type JobData =
  | AIDescriptionGenerationJobData
  | ... other job types
```

### 7. **RabbitMQ Queue Configuration** (`/server/src/common/services/rabbitMQService.ts`)

```typescript
// Queue mapping
private readonly queueMapping = {
  'ai-description': 'ai.description',
  // Future: 'video-generation': 'video.generation',
};

// Exchange mapping
private readonly exchangeMapping = {
  'ai.description': 'racky.ai.exchange',
  // Future: 'video.generation': 'racky.media.exchange',
};

// In setupExchangesAndQueues()
const queues = [
  'ai.description',
  // Future: 'video.generation',
];

const bindings = [
  { exchange: 'racky.ai.exchange', queue: 'ai.description', routingKey: 'ai.description.#' },
  // Future: { exchange: 'racky.media.exchange', queue: 'video.generation', routingKey: 'video.generation.#' },
];
```

---

## API Client

### 8. **Optimizations API** (`/client/src/api/resources/optimizations.ts`)

```typescript
async bulkGenerateDescriptions(productIds: string[]): Promise<{
  success: boolean;
  message: string;
  data: {
    batchId: string;
    queuedCount: number;
    failedCount: number;
    queuedProducts: string[];
    failedProducts: string[];
  };
}> {
  const response = await fetch(`${this.baseUrl}/products/bulk/description`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ productIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to generate descriptions');
  }

  const data = await response.json();
  return data;
}

// Future: Similar method for video generation
// async bulkGenerateVideos(productIds: string[], templateId: string): Promise<...>
```

---

## Status Flow Diagram

```
User Action
    ↓
[Select Products] → [Click "Generate AI Descriptions"]
    ↓
Frontend: Call bulkGenerateDescriptions API
    ↓
Backend: Create RabbitMQ jobs for each product
    ↓
Backend: Mark products as "processing" (empty content)
    ↓
Backend: Return success response
    ↓
Frontend: Show success toast & refresh list
    ↓
Products List: Show purple "Processing..." badges
    ↓
RabbitMQ Workers: Process jobs in background (3 concurrent)
    ↓
For each product:
  - Fetch product data
  - Call OpenAI API
  - Generate optimized description
  - Update product status to "pending"
  - Save generated content
    ↓
Products List: Auto-refresh shows yellow "Pending Approval" badges
    ↓
User: Click product → See AI description in comparison view
    ↓
User: Accept or Reject
    ↓
If Accepted:
  - Status: "accepted" (green badge)
  - Apply to marketplace (optional)
  - Update local product description
    ↓
If Rejected:
  - Status: "rejected" (red badge)
  - User can request new generation
```

---

## Key UX Principles

### Immediate Feedback
- Products are marked as "processing" **immediately** when the API returns success
- Users see visual confirmation (purple badge with spinner) without waiting for AI generation
- Clear toast notification shows how many products were queued

### Visual Status Hierarchy
1. **Processing** (purple, spinner): Job is in queue or being processed
2. **Pending Approval** (yellow, clock): AI generated, waiting for user action
3. **Accepted** (green, checkmark): User approved the AI content
4. **Rejected** (red, X): User rejected the AI content

### Non-Blocking Operation
- Users can continue working while AI generates descriptions
- No loading screens or modal dialogs
- Products can be filtered, sorted, and managed during processing

### Batch Context
- Each bulk operation gets a unique `batchId` for tracking
- Workers know their position in the batch (`currentIndex`/`totalInBatch`)
- Useful for progress reporting and debugging

### Error Handling
- Individual failures don't block the entire batch
- Failed products show "rejected" status with error message
- Users can retry individual products

---

## Applying This Pattern to Video Generation

### Changes Needed:

1. **Product Model**: Add `videos` array similar to `cachedDescriptions`
   ```typescript
   videos: [{
     templateId: string;
     templateName: string;
     status: 'processing' | 'completed' | 'failed';
     videoUrl?: string;
     error?: string;
     createdAt: Date;
     completedAt?: Date;
   }]
   ```

2. **UI Changes**: Add "Generate Videos" option to bulk actions dropdown
   - Include template selector in a dialog
   - Show video status badges (purple "Processing...", green "Ready", red "Failed")

3. **API Endpoint**: `POST /api/products/bulk/videos`
   - Accept `productIds` and `templateId`
   - Queue jobs to `video-generation` queue
   - Mark products with `status: 'processing'`

4. **Worker**: Create `videoWorker.ts` similar to `descriptionWorker.ts`
   - Call external video API (Creatomate, etc.)
   - Poll for video completion if async
   - Update product with video URL when ready

5. **Job Type**: Add `VIDEO_GENERATION` to JobType enum

6. **Queue Setup**: Add `video.generation` queue to RabbitMQ configuration

### Implementation Checklist:
- [ ] Add `videos` array to Product model
- [ ] Create `VideoStatus` type enum
- [ ] Add virtual field `hasVideo` to Product schema
- [ ] Create bulk video generation API endpoint
- [ ] Create video generation worker
- [ ] Register VIDEO_GENERATION job type
- [ ] Add video.generation queue to RabbitMQ
- [ ] Update frontend with video status badges
- [ ] Add "Generate Videos" to bulk actions dropdown
- [ ] Create video template selector dialog
- [ ] Update products list to show video status

---

## Important Implementation Notes

### Worker Function Signature
**CRITICAL**: RabbitMQ passes jobs in Bull.js format:
```typescript
// Correct worker signature
export async function processJob(
  job: {
    id: string;
    data: YourJobData;
    progress: (value: number) => Promise<void>
  }
): Promise<void> {
  const { productId, workspaceId, ... } = job.data;  // ← Access via job.data
  // ... processing logic
}
```

### Status Transitions
- **Never skip the "processing" status** - Always mark immediately when queueing
- **Empty content during processing** - Don't show placeholder text, leave content empty
- **Atomic updates** - Use proper MongoDB operators to avoid race conditions

### Queue Configuration
- **Queue naming**: Use descriptive names like `ai.description`, `video.generation`
- **Exchange routing**: All similar jobs can share an exchange (e.g., `racky.media.exchange` for videos and images)
- **Concurrency**: Start with 3 workers, adjust based on API rate limits

### Error Recovery
- **Retry logic**: Let RabbitMQ handle retries (configured with `maxAttempts`)
- **Dead letter queue**: Failed jobs go to `racky.failed` queue for manual inspection
- **User visibility**: Show error messages in UI, allow manual retry

---

## Testing Checklist

- [ ] Select multiple products and trigger bulk action
- [ ] Verify products show "processing" status immediately
- [ ] Check RabbitMQ logs for job creation
- [ ] Wait for workers to process jobs
- [ ] Verify products update to "pending" with generated content
- [ ] Test accept/reject actions
- [ ] Test with API failures (network errors, rate limits)
- [ ] Test with invalid product IDs
- [ ] Test with products from different workspaces (should fail)
- [ ] Test concurrent bulk operations
- [ ] Verify workspace data isolation
- [ ] Check performance with 10, 50, 100 products

---

**Date Created**: 2025-01-13
**Pattern Used In**: AI Description Generation
**Ready to Apply To**: Video Generation (when requested)
