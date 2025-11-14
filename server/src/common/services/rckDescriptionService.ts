import axios, { AxiosInstance, AxiosError } from 'axios';
import https from 'https';
import { getEnv } from '@/common/config/env';

/**
 * RCK Description Server Service
 *
 * External service for generating AI-optimized product descriptions and videos
 * This service handles all communication with the RCK Description Server API
 */

const env = getEnv();

class RCKDescriptionService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.RCK_DESCRIPTION_SERVER_URL;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000, // 60 second timeout for AI operations
      headers: {
        'Content-Type': 'application/json',
      },
      // Bypass SSL certificate validation for development/self-signed certificates
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[RCK Description Service] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[RCK Description Service] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[RCK Description Service] Response from ${response.config.url}:`, response.status);
        return response;
      },
      (error: AxiosError) => {
        console.error('[RCK Description Service] Response error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
          data: JSON.stringify(error.response?.data, null, 2), // Full error details
        });
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Handle API errors and format them consistently
   */
  private handleError(error: AxiosError): Error {
    if (error.response) {
      // Server responded with error status
      const data = error.response.data as any;
      const message = data?.message || data?.error || `RCK Description Server error: ${error.response.status}`;
      return new Error(message);
    } else if (error.request) {
      // Request made but no response received
      return new Error('RCK Description Server is unreachable. Please check if the service is running.');
    } else {
      // Error setting up the request
      return new Error(`RCK Description Service error: ${error.message}`);
    }
  }

  /**
   * Check if RCK Description Server is available
   */
  async healthCheck(): Promise<{ healthy: boolean; version?: string; message?: string }> {
    try {
      const response = await this.client.get('/health');
      return {
        healthy: true,
        version: response.data?.version,
        message: response.data?.message || 'Service is healthy',
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  /**
   * Get available video templates
   *
   * @returns List of video templates with their details
   */
  async getVideoTemplates(): Promise<{
    success: boolean;
    message: string;
    templates: Array<{
      id: string;
      title: string;
      name_file_video: string;
      name_file_background_image: string;
      description: string;
    }>;
    error: string | null;
  }> {
    console.log('[RCK Description Service] Fetching video templates');

    const response = await this.client.get('/api/v1/templates');

    return response.data;
  }

  /**
   * Generate optimized product description
   *
   * @param params - Parameters for description generation
   * @returns Generated description data
   */
  async generateDescription(params: {
    productId: string;
    productTitle: string;
    productDescription?: string;
    productPrice?: number;
    productImages?: string[];
    marketplace: string;
    targetPlatform?: string;
    customInstructions?: string;
    [key: string]: any;
  }): Promise<any> {
    console.log('[RCK Description Service] Generating description for product:', params.productId);

    // TODO: Replace with actual endpoint when provided
    const response = await this.client.post('/api/descriptions/generate', params);

    return response.data;
  }

  /**
   * Generate product video
   *
   * @param params - Parameters for video generation
   * @returns Generated video data
   */
  async generateVideo(params: {
    id_product: number; // Must be integer as per API spec
    title: string;
    img_urls: string[]; // Array of image URLs
    user_id: string;
    sku: string;
    template_name: string;
    videoId: string; // AIVideo MongoDB _id for webhook callback (camelCase as per API spec)
    aspect_ratio: string; // Aspect ratio (9:16, 16:9, 1:1)
  }): Promise<any> {
    console.log('[RCK Description Service] Generating video for product:', params.id_product, 'with videoId:', params.videoId);

    // External API expects array with single item for single video generation
    const response = await this.client.post('/api/v1/create-images-batch', [params]);

    return response.data;
  }

  /**
   * Get generation job status
   *
   * @param jobId - ID of the generation job
   * @returns Job status and result
   */
  async getJobStatus(jobId: string): Promise<any> {
    console.log('[RCK Description Service] Checking job status:', jobId);

    // TODO: Replace with actual endpoint when provided
    const response = await this.client.get(`/api/jobs/${jobId}`);

    return response.data;
  }

  /**
   * Bulk generate descriptions for multiple products
   *
   * @param products - Array of product data
   * @returns Bulk generation job data
   */
  async bulkGenerateDescriptions(products: Array<{
    productId: string;
    productTitle: string;
    productDescription?: string;
    productPrice?: number;
    productImages?: string[];
    marketplace: string;
    targetPlatform?: string;
    [key: string]: any;
  }>): Promise<any> {
    console.log('[RCK Description Service] Bulk generating descriptions for products:', products.length);

    // TODO: Replace with actual endpoint when provided
    const response = await this.client.post('/api/descriptions/bulk', { products });

    return response.data;
  }

  /**
   * Bulk generate videos for multiple products
   *
   * @param products - Array of product data with video templates
   * @returns Bulk generation job data
   */
  async bulkGenerateVideos(products: Array<{
    id_product: number; // Must be integer as per API spec
    title: string;
    img_urls: string[]; // Array of image URLs
    user_id: string;
    sku: string;
    template_name: string;
    videoId: string; // AIVideo MongoDB _id for webhook callback (camelCase as per API spec)
    aspect_ratio: string; // Aspect ratio (9:16, 16:9, 1:1)
  }>): Promise<any> {
    console.log('[RCK Description Service] Bulk generating videos for products:', products.length);
    console.log('[RCK Description Service] Request payload:', JSON.stringify(products, null, 2));

    // External API expects array directly, not wrapped in { products: [...] }
    const response = await this.client.post('/api/v1/create-images-batch', products);

    return response.data;
  }

  /**
   * Get base URL for the RCK Description Server
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.baseUrl && this.baseUrl !== '';
  }
}

// Export singleton instance
export const rckDescriptionService = new RCKDescriptionService();

// Export class for testing
export { RCKDescriptionService };
