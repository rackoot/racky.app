import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * Marketplace Catalog Cache
 *
 * Stores cached product counts for categories and brands from marketplace APIs.
 * Used to avoid expensive API calls on every request.
 * Cache is invalidated after product syncs.
 */

export type CatalogCacheType = 'category' | 'brand';
export type MarketplaceType = 'vtex' | 'shopify' | 'woocommerce' | 'mercadolibre' | 'amazon';

export interface ICatalogCacheItem {
  id: string;
  name: string;
  productCount: number;
  parentId?: string | null;
  level?: number;
}

export interface IMarketplaceCatalogCache extends Document {
  storeConnectionId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  marketplaceType: MarketplaceType;
  cacheType: CatalogCacheType;
  items: ICatalogCacheItem[];
  lastUpdated: Date;
  expiresAt: Date;

  // Methods
  isExpired(): boolean;
  invalidateCache(): Promise<this>;
}

export interface IMarketplaceCatalogCacheModel extends mongoose.Model<IMarketplaceCatalogCache> {
  findValidCache(
    storeConnectionId: Types.ObjectId,
    cacheType: CatalogCacheType
  ): Promise<IMarketplaceCatalogCache | null>;

  invalidateAll(storeConnectionId: Types.ObjectId): Promise<void>;

  createOrUpdate(
    storeConnectionId: Types.ObjectId,
    workspaceId: Types.ObjectId,
    marketplaceType: MarketplaceType,
    cacheType: CatalogCacheType,
    items: ICatalogCacheItem[],
    ttlHours?: number
  ): Promise<IMarketplaceCatalogCache>;
}

const CatalogCacheItemSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  productCount: {
    type: Number,
    required: true,
    default: 0
  },
  parentId: {
    type: String,
    default: null
  },
  level: {
    type: Number,
    default: 0
  }
}, { _id: false });

const MarketplaceCatalogCacheSchema = new Schema({
  storeConnectionId: {
    type: Schema.Types.ObjectId,
    ref: 'StoreConnection',
    required: true,
    index: true
  },
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  marketplaceType: {
    type: String,
    enum: ['vtex', 'shopify', 'woocommerce', 'mercadolibre', 'amazon'],
    required: true
  },
  cacheType: {
    type: String,
    enum: ['category', 'brand'],
    required: true
  },
  items: {
    type: [CatalogCacheItemSchema],
    default: []
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for efficient lookups
MarketplaceCatalogCacheSchema.index({
  storeConnectionId: 1,
  cacheType: 1
}, { unique: true });

// Index for automatic cleanup of expired caches
MarketplaceCatalogCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Methods
MarketplaceCatalogCacheSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt;
};

MarketplaceCatalogCacheSchema.methods.invalidateCache = async function(): Promise<IMarketplaceCatalogCache> {
  this.expiresAt = new Date();
  return await this.save();
};

// Static methods
MarketplaceCatalogCacheSchema.statics.findValidCache = async function(
  storeConnectionId: Types.ObjectId,
  cacheType: CatalogCacheType
): Promise<IMarketplaceCatalogCache | null> {
  return this.findOne({
    storeConnectionId,
    cacheType,
    expiresAt: { $gt: new Date() }
  });
};

MarketplaceCatalogCacheSchema.statics.invalidateAll = async function(
  storeConnectionId: Types.ObjectId
): Promise<void> {
  await this.updateMany(
    { storeConnectionId },
    { $set: { expiresAt: new Date() } }
  );
};

MarketplaceCatalogCacheSchema.statics.createOrUpdate = async function(
  storeConnectionId: Types.ObjectId,
  workspaceId: Types.ObjectId,
  marketplaceType: MarketplaceType,
  cacheType: CatalogCacheType,
  items: ICatalogCacheItem[],
  ttlHours: number = 24
): Promise<IMarketplaceCatalogCache> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);

  return this.findOneAndUpdate(
    { storeConnectionId, cacheType },
    {
      $set: {
        workspaceId,
        marketplaceType,
        items,
        lastUpdated: new Date(),
        expiresAt
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
};

const MarketplaceCatalogCache = mongoose.model<IMarketplaceCatalogCache, IMarketplaceCatalogCacheModel>(
  'MarketplaceCatalogCache',
  MarketplaceCatalogCacheSchema
);

export default MarketplaceCatalogCache;
