export interface CreateWebhookDto {
  name: string;
  description?: string;
  url: string;
  isActive?: boolean;
}

export interface UpdateWebhookDto {
  name?: string;
  description?: string;
  url?: string;
  isActive?: boolean;
}

export interface WebhookUrlResponse {
  _id: string;
  name: string;
  description: string;
  url: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhooksListResponse {
  success: boolean;
  data: {
    webhooks: WebhookUrlResponse[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      limit: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface ActiveWebhookUrlsResponse {
  success: boolean;
  data: {
    urls: string[];
    count: number;
  };
}
