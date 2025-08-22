export interface Marketplace {
  id: string;
  name: string;
  description: string;
  requiredCredentials: string[];
  testEndpoint: string | null;
  documentationUrl: string;
}

export interface OpportunityCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isMarketplace?: boolean;
}

export interface MarketplaceCategory extends OpportunityCategory {
  isMarketplace: true;
}