export interface WebhookUrl {
  _id: string;
  name: string;
  description: string;
  url: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export interface WebhooksListResponse {
  webhooks: WebhookUrl[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface WebhookResponse {
  success: boolean;
  message?: string;
  data: WebhookUrl;
}

export interface ActiveWebhookUrlsResponse {
  success: boolean;
  data: {
    urls: string[];
    count: number;
  };
}
