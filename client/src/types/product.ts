export interface ProductVariant {
  id: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  sku?: string;
  inventory: number;
  weight?: number;
  weightUnit?: string;
}

export interface ProductPlatform {
  platformId: string;
  platformSku?: string;
  platformPrice?: number;
  platformInventory?: number;
  platformStatus?: string;
  lastSyncAt?: string;
}

export interface ProductImage {
  url: string;
  altText?: string;
}

export interface CachedDescription {
  platform: string;
  content: string;
  confidence?: number;
  keywords: string[];
  tokens?: number;
  createdAt: string;
  status: 'pending' | 'accepted' | 'rejected';
  _id?: string;
}

export interface ProductVideo {
  templateId: string;
  templateName: string;
  status: 'processing' | 'pending' | 'completed' | 'failed';
  videoUrl?: string;
  youtubeUrl?: string;
  imgS3Url?: string; // S3 URL for video thumbnail/cover image
  error?: string;
  createdAt: string;
  completedAt?: string;
  _id?: string;
}

export interface ProductDetail {
  _id: string;
  title: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  sku?: string;
  inventory: number;
  vendor?: string;
  productType?: string;
  tags: string[];
  images: (string | ProductImage)[];
  variants: ProductVariant[];
  platforms: Record<string, ProductPlatform>;
  status: 'active' | 'draft' | 'archived';
  marketplace: string;
  externalId?: string;
  marketplaceUrl?: string;
  handle?: string;
  createdAt: string;
  updatedAt: string;
  cachedDescriptions?: CachedDescription[];
  videos?: ProductVideo[]; // Marketplace videos (uploaded to VTEX, Shopify, etc.)
  aiGeneratedVideos?: ProductVideo[]; // AI-generated videos from AIVideo collection
  storeConnectionId?: {
    _id: string;
    storeName: string;
    marketplaceType: string;
    credentials?: {
      shop_url?: string;
      account_name?: string;
      site_url?: string;
      [key: string]: any;
    };
  };
}

export interface OptimizationSuggestion {
  id: string;
  originalContent: string;
  suggestedContent: string;
  status: 'pending' | 'accepted' | 'rejected';
  metadata: {
    model: string;
    tokens: number;
    confidence: number;
    keywords: string[];
    prompt?: string;
  };
  createdAt: string;
}

export interface SuggestionHistory {
  id: string;
  platform: string;
  type: string;
  title: string;
  description: string;
  originalContent: string;
  suggestedContent: string;
  status: 'pending' | 'accepted' | 'rejected';
  metadata: {
    model: string;
    tokens: number;
    confidence: number;
    keywords: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProductHistoryItem {
  action: string;
  details: string;
  platform?: string;
  timestamp: string;
  user?: string;
}