import mongoose, { Document, Schema, Types } from 'mongoose';

// Type for marketplace types
export type MarketplaceType = 'shopify' | 'vtex' | 'mercadolibre' | 'amazon' | 'facebook_shop' | 'google_shopping' | 'woocommerce';

// Type for sync status
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed';

// Interface for StoreConnection document
export interface IStoreConnection extends Document {
  userId: Types.ObjectId;
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
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// Compound index to ensure one connection per marketplace type per user
storeConnectionSchema.index({ userId: 1, marketplaceType: 1 }, { unique: true });

export default mongoose.model<IStoreConnection>('StoreConnection', storeConnectionSchema);