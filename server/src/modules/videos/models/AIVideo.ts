import mongoose, { Schema, Document } from 'mongoose'

export interface IAIVideo extends Document {
  userId: mongoose.Types.ObjectId
  workspaceId: mongoose.Types.ObjectId
  productId: mongoose.Types.ObjectId
  template: 'product_showcase' | 'human_usage' | 'store_display' | 'lifestyle' | 'technical_demo' | 'unboxing'
  customInstructions?: string
  generatedDate: Date
  status: 'pending' | 'generating' | 'completed' | 'failed'
  metadata: {
    title?: string // Will come from external service
    description?: string // Will come from external service
    duration?: number
    format?: string
    resolution?: string
    fileSize?: number
    videoUrl?: string
    thumbnailUrl?: string
    generationTime?: number
    aiModel?: string
    externalJobId?: string // Track external API job
    youtubeVideoId?: string // YouTube video ID from external service
    localFilename?: string // File path on external server
    [key: string]: any
  }
  error?: string
  createdAt: Date
  updatedAt: Date
}

const aiVideoSchema = new Schema<IAIVideo>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  template: {
    type: String,
    enum: ['product_showcase', 'human_usage', 'store_display', 'lifestyle', 'technical_demo', 'unboxing'],
    required: true,
    index: true
  },
  customInstructions: {
    type: String,
    required: false,
    maxlength: 500,
    trim: true
  },
  generatedDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'generating', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  error: {
    type: String
  }
}, {
  timestamps: true
})

// Compound indexes for efficient querying
aiVideoSchema.index({ userId: 1, workspaceId: 1, status: 1 })
aiVideoSchema.index({ workspaceId: 1, createdAt: -1 })
aiVideoSchema.index({ productId: 1, createdAt: -1 })

export const AIVideo = mongoose.model<IAIVideo>('AIVideo', aiVideoSchema)