// Re-export marketplacesApi as marketplaceService for backward compatibility
export { marketplacesApi as marketplaceService } from '@/api'

// Export types for backward compatibility
export type { Marketplace, TestConnectionResponse, ConnectMarketplaceRequest, MarketplaceCredentials } from '@/types/marketplace'