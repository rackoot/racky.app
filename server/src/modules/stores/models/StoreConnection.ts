import mongoose, { Document, Schema, Types } from 'mongoose';

// Type for marketplace types
export type MarketplaceType = 'shopify' | 'vtex' | 'mercadolibre' | 'amazon' | 'facebook_shop' | 'google_shopping' | 'woocommerce';

// Type for sync status
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed';

// Interface for StoreConnection document
export interface IStoreConnection extends Document {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId; // Keep for backward compatibility during migration
  storeName: string;
  marketplaceType: MarketplaceType;
  credentials: Record<string, any>;
  isActive: boolean;
  lastSync: Date | null;
  syncStatus: SyncStatus;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const storeConnectionSchema = new Schema<IStoreConnection>({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false // Will be removed after migration
  },
  storeName: {
    type: String,
    required: true,
    trim: true
  },
  marketplaceType: {
    type: String,
    required: true,
    enum: ['shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce']
  },
  credentials: {
    type: Schema.Types.Mixed,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSync: {
    type: Date,
    default: null
  },
  syncStatus: {
    type: String,
    enum: ['pending', 'syncing', 'completed', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Compound index to ensure one connection per marketplace type per workspace
storeConnectionSchema.index({ workspaceId: 1, marketplaceType: 1 }, { unique: true });
// Keep old index for backward compatibility during migration
storeConnectionSchema.index({ userId: 1, marketplaceType: 1 });

export default mongoose.model<IStoreConnection>('StoreConnection', storeConnectionSchema);