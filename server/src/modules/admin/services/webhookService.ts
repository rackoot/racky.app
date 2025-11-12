import WebhookUrl, { IWebhookUrl } from '../models/WebhookUrl';
import { CreateWebhookDto, UpdateWebhookDto } from '../interfaces/webhook';

export class WebhookService {
  /**
   * Get all webhooks with pagination
   */
  async getAllWebhooks(
    page: number = 1,
    limit: number = 50
  ): Promise<{
    webhooks: IWebhookUrl[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      limit: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const skip = (page - 1) * limit;

    const [webhooks, totalCount] = await Promise.all([
      WebhookUrl.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      WebhookUrl.countDocuments(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      webhooks: webhooks as IWebhookUrl[],
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get webhook by ID
   */
  async getWebhookById(id: string): Promise<IWebhookUrl | null> {
    return WebhookUrl.findById(id);
  }

  /**
   * Create new webhook
   */
  async createWebhook(data: CreateWebhookDto): Promise<IWebhookUrl> {
    // Check if URL already exists
    const existingWebhook = await WebhookUrl.findOne({ url: data.url });
    if (existingWebhook) {
      throw new Error('Webhook URL already exists');
    }

    const webhook = new WebhookUrl({
      name: data.name,
      description: data.description || '',
      url: data.url,
      isActive: data.isActive !== undefined ? data.isActive : true,
    });

    return webhook.save();
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    id: string,
    data: UpdateWebhookDto
  ): Promise<IWebhookUrl | null> {
    // If updating URL, check if it already exists
    if (data.url) {
      const existingWebhook = await WebhookUrl.findOne({
        url: data.url,
        _id: { $ne: id },
      });
      if (existingWebhook) {
        throw new Error('Webhook URL already exists');
      }
    }

    const webhook = await WebhookUrl.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    );

    return webhook;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(id: string): Promise<IWebhookUrl | null> {
    return WebhookUrl.findByIdAndDelete(id);
  }

  /**
   * Get all active webhook URLs (for external service)
   */
  async getActiveWebhookUrls(): Promise<string[]> {
    const webhooks = await WebhookUrl.find(
      { isActive: true },
      { url: 1, _id: 0 }
    ).lean();

    return webhooks.map((w) => w.url);
  }

  /**
   * Toggle webhook active status
   */
  async toggleWebhookStatus(id: string): Promise<IWebhookUrl | null> {
    const webhook = await WebhookUrl.findById(id);
    if (!webhook) {
      return null;
    }

    webhook.isActive = !webhook.isActive;
    return webhook.save();
  }
}

export default new WebhookService();
