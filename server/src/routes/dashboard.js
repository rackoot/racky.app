const express = require('express');
const { protect } = require('../middleware/auth');
const StoreConnection = require('../models/StoreConnection');
const Product = require('../models/Product');
const User = require('../models/User');
const OpenAI = require('openai');

const router = express.Router();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GET /api/dashboard/analytics - Get dashboard analytics data
router.get('/analytics', protect, async (req, res) => {
  try {
    const userId = req.user._id;

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
    const totalForPercentage = productDistribution.reduce((sum, item) => sum + item.value, 0);
    
    // Convert to percentages and add colors
    const marketplaceColors = {
      shopify: '#8BC34A',
      amazon: '#FF9800',
      vtex: '#9C27B0',
      mercadolibre: '#FFEB3B',
      facebook_shop: '#2196F3',
      google_shopping: '#F44336',
      woocommerce: '#673AB7'
    };

    const pieData = productDistribution.map(item => ({
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
    const trendData = productsTrend.map(item => ({
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

    const productGrowth = totalProducts > 0 ? ((productsLastMonth / totalProducts) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        metrics: {
          totalProducts,
          connectedStores,
          monthlyRevenue: Math.round(monthlyRevenue),
          avgOrderValue,
          productGrowth: `+${productGrowth}% from last month`
        },
        charts: {
          productDistribution: pieData,
          productsTrend: trendData
        }
      }
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard analytics'
    });
  }
});

// GET /api/dashboard/suggestions - Get AI suggestions for store improvement
router.get('/suggestions', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user's store connections and products for context
    const connections = await StoreConnection.find({ userId }).populate('marketplaces');
    const products = await Product.find({ userId }).limit(10); // Sample of products
    const totalProducts = await Product.countDocuments({ userId });

    // Build context for AI
    const marketplaces = connections.flatMap(conn => 
      conn.marketplaces.map(mp => mp.type)
    ).filter(Boolean);

    const uniqueMarketplaces = [...new Set(marketplaces)];
    
    const productCategories = [...new Set(products.map(p => p.productType).filter(Boolean))];
    
    const context = {
      connectedMarketplaces: uniqueMarketplaces,
      totalProducts,
      productSample: products.slice(0, 3).map(p => ({
        title: p.title,
        marketplace: p.marketplace,
        price: p.price,
        inventory: p.inventory
      })),
      productCategories: productCategories.slice(0, 5)
    };

    const prompt = `As an e-commerce consultant, analyze this store data and provide 3-4 specific, actionable suggestions for improvement:

Store Context:
- Connected Marketplaces: ${uniqueMarketplaces.join(', ') || 'None yet'}
- Total Products: ${totalProducts}
- Product Categories: ${productCategories.join(', ') || 'Not specified'}
- Sample Products: ${products.slice(0, 2).map(p => `${p.title} ($${p.price})`).join(', ')}

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

    let suggestions = [];
    try {
      const response = JSON.parse(completion.choices[0].message.content);
      suggestions = response.suggestions || [];
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback suggestions
      suggestions = [
        {
          title: "Expand to New Marketplaces",
          description: "Consider adding more marketplace connections to reach a wider audience and increase sales potential.",
          priority: "high",
          category: "expansion",
          impact: "Could increase reach by 30-50%"
        },
        {
          title: "Optimize Product Pricing",
          description: "Review your product pricing strategy across marketplaces to ensure competitiveness while maintaining margins.",
          priority: "medium",
          category: "pricing",
          impact: "May improve conversion rates"
        },
        {
          title: "Improve Inventory Management",
          description: "Implement better inventory tracking to avoid stockouts and ensure consistent availability across platforms.",
          priority: "medium",
          category: "inventory",
          impact: "Reduces lost sales opportunities"
        }
      ];
    }

    res.json({
      success: true,
      data: {
        suggestions,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Dashboard suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate AI suggestions'
    });
  }
});

module.exports = router;