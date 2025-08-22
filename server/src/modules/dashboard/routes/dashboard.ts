import express, { Response } from 'express';
import OpenAI from 'openai';
import { AuthenticatedRequest } from '@/common/types/express';
import getEnv from '@/common/config/env';
import StoreConnection from '@/stores/models/StoreConnection';
import Product from '@/products/models/Product';
import User from '@/auth/models/User';
import GeneralSuggestion from '@/opportunities/models/GeneralSuggestion';
import { protect } from '@/common/middleware/auth';

const router = express.Router();

// Initialize OpenAI conditionally
let openai: OpenAI | null = null;
const env = getEnv();
if (env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  } catch (error) {
    console.warn('OpenAI client initialization failed:', error);
    openai = null;
  }
}

// Interface definitions
interface DashboardMetrics {
  totalProducts: number;
  connectedStores: number;
  monthlyRevenue: number;
  avgOrderValue: number;
  productGrowth: string;
}

interface PieDataItem {
  name: string;
  value: number;
  count: number;
  color: string;
}

interface TrendDataItem {
  month: string;
  count: number;
}

interface Suggestion {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'marketing' | 'inventory' | 'pricing' | 'expansion';
  impact: string;
}

interface SuggestionContext {
  connectedMarketplaces: string[];
  totalProducts: number;
  productCategories: string[];
}

interface SuggestionsQuery {
  refresh?: string;
}

// GET /api/dashboard/analytics - Get dashboard analytics data
router.get('/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await protect(req, res, async () => {
      const userId = req.user!._id;

      // Get total products count
      const totalProducts = await Product.countDocuments({ userId });

      // Get connected stores count
      const connectedStores = await StoreConnection.countDocuments({ userId });

      // Get product distribution by marketplace
      const productDistribution = await Product.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: '$marketplace',
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            name: '$_id',
            value: '$count',
            _id: 0
          }
        }
      ]);

      // Get total products for percentage calculation
      const totalForPercentage = productDistribution.reduce((sum: number, item: any) => sum + item.value, 0);
      
      // Convert to percentages and add colors
      const marketplaceColors: Record<string, string> = {
        shopify: '#8BC34A',
        amazon: '#FF9800',
        vtex: '#9C27B0',
        mercadolibre: '#FFEB3B',
        facebook_shop: '#2196F3',
        google_shopping: '#F44336',
        woocommerce: '#673AB7'
      };

      const pieData: PieDataItem[] = productDistribution.map((item: any) => ({
        name: item.name,
        value: totalForPercentage > 0 ? Math.round((item.value / totalForPercentage) * 100) : 0,
        count: item.value,
        color: marketplaceColors[item.name] || '#9E9E9E'
      }));

      // Get products created in last 6 months for trend
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const productsTrend = await Product.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);

      // Format trend data
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const trendData: TrendDataItem[] = productsTrend.map((item: any) => ({
        month: monthNames[item._id.month - 1],
        count: item.count
      }));

      // Calculate metrics with mock revenue data (you can replace with real revenue data if available)
      const avgOrderValue = 89.50; // Mock data - replace with real calculation
      const monthlyRevenue = totalProducts * avgOrderValue * 0.1; // Mock calculation

      // Get recent activity (last month comparisons)
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const productsLastMonth = await Product.countDocuments({
        userId,
        createdAt: { $gte: lastMonth }
      });

      const productGrowth = totalProducts > 0 ? ((productsLastMonth / totalProducts) * 100).toFixed(1) : '0';

      const metrics: DashboardMetrics = {
        totalProducts,
        connectedStores,
        monthlyRevenue: Math.round(monthlyRevenue),
        avgOrderValue,
        productGrowth: `+${productGrowth}% from last month`
      };

      res.json({
        success: true,
        data: {
          metrics,
          charts: {
            productDistribution: pieData,
            productsTrend: trendData
          }
        }
      });
    });
  } catch (error: any) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard analytics'
    });
  }
});

// GET /api/dashboard/suggestions - Get AI suggestions for store improvement
router.get('/suggestions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await protect(req, res, async () => {
      const userId = req.user!._id;
      const forceRefresh = req.query.refresh === 'true';

      // Clean up expired suggestions first
      await GeneralSuggestion.deactivateExpired();

      // Check if we have valid cached suggestions
      if (!forceRefresh) {
        const cachedSuggestions = await GeneralSuggestion.findValidSuggestions(userId.toString() as any);
        
        if (cachedSuggestions.length > 0) {
          console.log(`Returning ${cachedSuggestions.length} cached suggestions for user ${userId}`);
          return res.json({
            success: true,
            data: {
              suggestions: cachedSuggestions.map((s: any) => ({
                title: s.title,
                description: s.description,
                priority: s.priority,
                category: s.category,
                impact: s.impact
              })),
              generatedAt: cachedSuggestions[0].createdAt.toISOString(),
              cached: true,
              expiresAt: cachedSuggestions[0].expiresAt.toISOString()
            }
          });
        }
      }

      console.log(`Generating new suggestions for user ${userId}`);

      // Get user's store connections and products for context
      const connections = await StoreConnection.find({ userId });
      const products = await Product.find({ userId }).limit(10);
      const totalProducts = await Product.countDocuments({ userId });

      // Build context for AI
      const marketplaces = connections.map((conn: any) => conn.marketplaceType).filter(Boolean);
      const uniqueMarketplaces = [...new Set(marketplaces)];
      const productCategories = [...new Set(products.map((p: any) => p.productType).filter(Boolean))];
      
      const context: SuggestionContext = {
        connectedMarketplaces: uniqueMarketplaces,
        totalProducts,
        productCategories: productCategories.slice(0, 5)
      };

      let suggestions: Suggestion[] = [];

      // Try to generate AI suggestions if OpenAI key is available
      if (process.env.OPENAI_API_KEY) {
        try {
          const prompt = `As an e-commerce consultant, analyze this store data and provide 3-4 specific, actionable suggestions for improvement:

Store Context:
- Connected Marketplaces: ${uniqueMarketplaces.join(', ') || 'None yet'}
- Total Products: ${totalProducts}
- Product Categories: ${productCategories.join(', ') || 'Not specified'}
- Sample Products: ${products.slice(0, 2).map((p: any) => `${p.title} ($${p.price})`).join(', ')}

Please provide suggestions in this exact JSON format:
{
  "suggestions": [
    {
      "title": "Suggestion Title",
      "description": "Detailed description of the suggestion",
      "priority": "high|medium|low",
      "category": "marketing|inventory|pricing|expansion",
      "impact": "Brief description of expected impact"
    }
  ]
}

Focus on practical improvements like marketplace expansion, pricing optimization, inventory management, or marketing strategies.`;

          if (!openai) {
            throw new Error('OpenAI API key not configured');
          }

          const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: "You are an expert e-commerce consultant. Provide practical, actionable advice for online store improvement. Always respond with valid JSON only."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 1000,
            temperature: 0.7
          });

          const response = JSON.parse(completion.choices[0].message.content || '{}');
          suggestions = response.suggestions || [];
        } catch (aiError) {
          console.error('AI generation failed:', aiError);
          suggestions = []; // Will fall back to default suggestions
        }
      }

      // If AI failed or no API key, use contextual fallback suggestions
      if (suggestions.length === 0) {
        suggestions = generateFallbackSuggestions(context);
      }

      // Save suggestions to database
      const savedSuggestions = await Promise.all(
        suggestions.map((suggestion: Suggestion) => 
          new GeneralSuggestion({
            userId,
            title: suggestion.title,
            description: suggestion.description,
            priority: suggestion.priority,
            category: suggestion.category,
            impact: suggestion.impact,
            context
          }).save()
        )
      );

      console.log(`Saved ${savedSuggestions.length} new suggestions for user ${userId}`);

      res.json({
        success: true,
        data: {
          suggestions,
          generatedAt: new Date().toISOString(),
          cached: false,
          expiresAt: savedSuggestions[0]?.expiresAt?.toISOString()
        }
      });
    });
  } catch (error: any) {
    console.error('Dashboard suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate AI suggestions'
    });
  }
});

// Helper function to generate contextual fallback suggestions
function generateFallbackSuggestions(context: SuggestionContext): Suggestion[] {
  const { connectedMarketplaces, totalProducts, productCategories } = context;
  const suggestions: Suggestion[] = [];

  // Marketplace expansion suggestions
  if (connectedMarketplaces.length === 0) {
    suggestions.push({
      title: "Connect Your First Marketplace",
      description: "Start by connecting to a popular marketplace like Shopify or Amazon to begin selling your products online.",
      priority: "high",
      category: "expansion",
      impact: "Essential first step to start generating revenue"
    });
  } else if (connectedMarketplaces.length < 3) {
    const availableMarketplaces = ['shopify', 'amazon', 'vtex', 'mercadolibre', 'woocommerce']
      .filter(mp => !connectedMarketplaces.includes(mp));
    
    suggestions.push({
      title: "Expand to Additional Marketplaces",
      description: `Consider expanding to ${availableMarketplaces.slice(0, 2).join(' or ')} to reach more customers and diversify your sales channels.`,
      priority: "high",
      category: "expansion",
      impact: "Could increase reach by 30-50%"
    });
  }

  // Product-related suggestions
  if (totalProducts === 0) {
    suggestions.push({
      title: "Add Your First Products",
      description: "Import or create product listings to start showcasing your inventory across connected marketplaces.",
      priority: "high",
      category: "inventory",
      impact: "Required to start making sales"
    });
  } else if (totalProducts < 10) {
    suggestions.push({
      title: "Expand Product Catalog",
      description: "Consider adding more products to your catalog to give customers more variety and increase sales opportunities.",
      priority: "medium",
      category: "inventory",
      impact: "More products typically lead to higher sales"
    });
  }

  // Pricing suggestions
  if (totalProducts > 0) {
    suggestions.push({
      title: "Optimize Product Pricing",
      description: "Review your product pricing strategy across marketplaces to ensure competitiveness while maintaining healthy margins.",
      priority: "medium",
      category: "pricing",
      impact: "May improve conversion rates and profitability"
    });
  }

  // Marketing suggestions
  if (connectedMarketplaces.length > 0 && totalProducts > 0) {
    suggestions.push({
      title: "Implement Cross-Platform Marketing",
      description: "Develop a unified marketing strategy across your connected marketplaces to build brand consistency and customer recognition.",
      priority: "medium",
      category: "marketing",
      impact: "Builds brand awareness and customer loyalty"
    });
  }

  return suggestions.slice(0, 4); // Return max 4 suggestions
}

export default router;
