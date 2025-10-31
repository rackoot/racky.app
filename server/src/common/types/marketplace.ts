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

// Product sync filter types
export interface ProductCategory {
  id: string;
  name: string;
  parentId?: string | null;
  level?: number;
}

export interface ProductBrand {
  id: string;
  name: string;
  productCount?: number;
}

export interface GetCategoriesResponse {
  success: boolean;
  data: {
    categories: ProductCategory[];
    totalCount: number;
  };
}

export interface GetBrandsResponse {
  success: boolean;
  data: {
    brands: ProductBrand[];
    totalCount: number;
  };
}