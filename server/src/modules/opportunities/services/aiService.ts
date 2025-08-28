import OpenAI from 'openai';
import { SUPPORTED_MARKETPLACES, OPPORTUNITY_CATEGORIES } from '@/common/constants/marketplaces';
import getEnv from '@/common/config/env';

// Type definitions for AI service
export interface Product {
  title: string;
  description?: string;
  price: number;
  marketplace: string;
  inventory: number;
  sku?: string;
  productType?: string;
  images?: string[];
  tags?: string[];
  [key: string]: any;
}

export interface PotentialImpact {
  revenue: number;
  percentage: number;
}

export interface Opportunity {
  title: string;
  description: string;
  category: string;
  marketplace: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  potentialImpact: PotentialImpact;
  actionRequired: string;
  confidence?: number;
  aiMetadata?: AIMetadata;
}

export interface AIMetadata {
  model: string;
  prompt: string;
  tokens: number;
  confidence: number;
}

export interface AIResponse {
  opportunities: Opportunity[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Initialize OpenAI
const env = getEnv();
const openai = env.OPENAI_API_KEY ? new OpenAI({
  apiKey: env.OPENAI_API_KEY,
}) : null;

class AIService {
  /**
   * Generate product improvement opportunities using AI
   * @param product - Product data
   * @param userMarketplaces - User's connected marketplaces
   * @returns Array of opportunity suggestions
   */
  async generateProductOpportunities(product: Product, userMarketplaces: string[] = []): Promise<Opportunity[]> {
    if (!openai) {
      console.warn('OpenAI API key not configured, using fallback suggestions');
      return this.generateFallbackOpportunities(product, userMarketplaces);
    }

    try {
      const prompt = this.buildPrompt(product, userMarketplaces);
      
      const completion = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('No response content from OpenAI');
      }

      const response: AIResponse = JSON.parse(responseContent);
      const opportunities = response.opportunities || [];

      // Add AI metadata to each opportunity
      return opportunities.map(opp => ({
        ...opp,
        aiMetadata: {
          model: env.OPENAI_MODEL,
          prompt: prompt.substring(0, 500) + '...', // Truncate for storage
          tokens: completion.usage?.total_tokens || 0,
          confidence: opp.confidence || 0.8
        }
      }));
      
    } catch (error: any) {
      console.error('AI generation failed:', error);
      return this.generateFallbackOpportunities(product, userMarketplaces);
    }
  }

  /**
   * Build AI prompt for product analysis
   */
  private buildPrompt(product: Product, userMarketplaces: string[]): string {
    const unconnectedMarketplaces = SUPPORTED_MARKETPLACES
      .filter(mp => !userMarketplaces.includes(mp.id))
      .map(mp => mp.name)
      .slice(0, 3);

    return `Analyze this product and provide specific, actionable improvement opportunities:

PRODUCT DETAILS:
- Title: ${product.title}
- Description: ${product.description || 'No description provided'}
- Price: $${product.price}
- Current Marketplace: ${product.marketplace}
- Inventory: ${product.inventory} units
- SKU: ${product.sku || 'Not provided'}
- Category: ${product.productType || 'Not specified'}
- Images: ${product.images?.length || 0} images
- Tags: ${product.tags?.join(', ') || 'None'}

USER CONTEXT:
- Connected Marketplaces: ${userMarketplaces.join(', ') || 'None'}
- Potential Expansion: ${unconnectedMarketplaces.join(', ')}

Provide 4-8 specific opportunities across these categories:
${OPPORTUNITY_CATEGORIES.map(cat => `- ${cat.id}: ${cat.description}`).join('\n')}

For marketplace-specific suggestions, use marketplace IDs: ${SUPPORTED_MARKETPLACES.map(mp => mp.id).join(', ')}

Respond with this exact JSON format:
{
  "opportunities": [
    {
      "title": "Specific actionable title",
      "description": "Detailed explanation of the opportunity and how to implement it",
      "category": "one of the category IDs above",
      "marketplace": "marketplace ID or null for general suggestions",
      "priority": "low|medium|high|critical",
      "potentialImpact": {
        "revenue": 0,
        "percentage": 15
      },
      "actionRequired": "Specific steps to take",
      "confidence": 0.85
    }
  ]
}

Focus on specific, implementable improvements based on the product data provided.`;
  }

  /**
   * Get system prompt for AI
   */
  private getSystemPrompt(): string {
    return `You are an expert e-commerce consultant specializing in product optimization and marketplace expansion. 

Your role is to analyze product data and provide specific, actionable improvement opportunities that can increase sales, visibility, and profitability.

Guidelines:
- Provide concrete, implementable suggestions
- Base recommendations on actual product data provided
- Consider marketplace-specific best practices
- Prioritize opportunities by potential impact
- Include specific metrics where possible
- Always respond with valid JSON only
- Focus on practical improvements that typical e-commerce sellers can implement

Categories you can suggest:
- pricing: Price optimization, competitive analysis, dynamic pricing
- description: SEO improvements, feature highlighting, benefit-focused copy
- images: Image quality, additional photos, lifestyle shots, 360� views
- seo: Keywords, meta descriptions, tags, search optimization
- inventory: Stock management, variant creation, bundle opportunities
- marketing: Promotional strategies, cross-selling, advertising suggestions
- Marketplace-specific: Platform optimization (use marketplace IDs)
- unconnected_marketplaces: Expansion to new platforms`;
  }

  /**
   * Generate fallback opportunities when AI is unavailable
   */
  private generateFallbackOpportunities(product: Product, userMarketplaces: string[] = []): Opportunity[] {
    const opportunities: Opportunity[] = [];

    // Price-related opportunities
    if (product.price) {
      if (product.price < 10) {
        opportunities.push({
          title: "Consider Bundle or Value-Add Pricing",
          description: "Your current price point is quite low. Consider bundling with complementary products or adding value-added services to justify higher pricing and improve margins.",
          category: "pricing",
          marketplace: null,
          priority: "medium",
          potentialImpact: { revenue: 0, percentage: 25 },
          actionRequired: "Research complementary products for bundling or value-added services"
        });
      } else if (product.price > 100) {
        opportunities.push({
          title: "Implement Competitive Price Monitoring",
          description: "For higher-priced products, regular competitive analysis is crucial. Monitor competitor pricing and adjust strategy accordingly to maintain competitiveness.",
          category: "pricing",
          marketplace: null,
          priority: "high",
          potentialImpact: { revenue: 0, percentage: 15 },
          actionRequired: "Set up competitor price monitoring and adjust pricing strategy"
        });
      }
    }

    // Description opportunities
    if (!product.description || product.description.length < 100) {
      opportunities.push({
        title: "Enhance Product Description for SEO",
        description: "Your product description is missing or too brief. A detailed, keyword-rich description can significantly improve search visibility and conversion rates.",
        category: "description",
        marketplace: product.marketplace,
        priority: "high",
        potentialImpact: { revenue: 0, percentage: 30 },
        actionRequired: "Write a comprehensive product description with relevant keywords and benefits"
      });
    }

    // Image opportunities
    if (!product.images || product.images.length < 3) {
      opportunities.push({
        title: "Add More Product Images",
        description: "Products with multiple high-quality images have significantly higher conversion rates. Aim for at least 5-7 images showing different angles and use cases.",
        category: "images",
        marketplace: product.marketplace,
        priority: "high",
        potentialImpact: { revenue: 0, percentage: 20 },
        actionRequired: "Take additional product photos from different angles and use cases"
      });
    }

    // Inventory opportunities
    if (product.inventory < 5) {
      opportunities.push({
        title: "Low Stock Alert - Restock Soon",
        description: "Your inventory is running low. Low stock can hurt search ranking and sales momentum on most marketplaces.",
        category: "inventory",
        marketplace: product.marketplace,
        priority: "critical",
        potentialImpact: { revenue: 0, percentage: 10 },
        actionRequired: "Restock inventory to at least 10-20 units for optimal performance"
      });
    }

    // SEO opportunities
    if (!product.tags || product.tags.length < 5) {
      opportunities.push({
        title: "Optimize Product Tags and Keywords",
        description: "Your product lacks sufficient tags/keywords. Well-optimized tags improve discoverability in marketplace search results.",
        category: "seo",
        marketplace: product.marketplace,
        priority: "medium",
        potentialImpact: { revenue: 0, percentage: 18 },
        actionRequired: "Research and add relevant keywords and product tags"
      });
    }

    // Marketplace expansion opportunities
    const unconnectedMarketplaces = SUPPORTED_MARKETPLACES
      .filter(mp => !userMarketplaces.includes(mp.id) && mp.id !== product.marketplace)
      .slice(0, 2);

    if (unconnectedMarketplaces.length > 0) {
      opportunities.push({
        title: `Expand to ${unconnectedMarketplaces[0].name}`,
        description: `Consider expanding your product to ${unconnectedMarketplaces[0].name} to reach new customers and diversify your sales channels. This marketplace could be a good fit for your product category.`,
        category: "unconnected_marketplaces",
        marketplace: unconnectedMarketplaces[0].id,
        priority: "medium",
        potentialImpact: { revenue: 0, percentage: 25 },
        actionRequired: `Research ${unconnectedMarketplaces[0].name} requirements and set up seller account`
      });
    }

    // Marketing opportunities
    opportunities.push({
      title: "Develop Cross-Platform Marketing Strategy",
      description: "Create consistent branding and marketing messages across all your sales channels to build brand recognition and customer loyalty.",
      category: "marketing",
      marketplace: null,
      priority: "medium",
      potentialImpact: { revenue: 0, percentage: 15 },
      actionRequired: "Create unified brand guidelines and marketing calendar"
    });

    return opportunities.slice(0, 6); // Return max 6 suggestions
  }

  /**
   * Validate opportunity data structure
   */
  validateOpportunity(opportunity: Opportunity): ValidationResult {
    const required = ['title', 'description', 'category', 'priority'];
    const validCategories = [...OPPORTUNITY_CATEGORIES.map(c => c.id), ...SUPPORTED_MARKETPLACES.map(m => m.id)];
    const validPriorities = ['low', 'medium', 'high', 'critical'];

    for (const field of required) {
      if (!opportunity[field as keyof Opportunity]) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }

    if (!validCategories.includes(opportunity.category)) {
      return { valid: false, error: `Invalid category: ${opportunity.category}` };
    }

    if (!validPriorities.includes(opportunity.priority)) {
      return { valid: false, error: `Invalid priority: ${opportunity.priority}` };
    }

    return { valid: true };
  }
}

export default new AIService();