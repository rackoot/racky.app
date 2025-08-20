const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Product = require('../models/Product');
const Suggestion = require('../models/Suggestion');
const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Platform-specific prompts for AI generation
const platformPrompts = {
  amazon: `Create an Amazon-optimized product description with:
    - Bullet points for key features
    - Keywords for search optimization
    - Trust signals (warranty, shipping)
    - Action-oriented language
    - Maximum 2000 characters`,
    
  mercadolibre: `Crea una descripción para MercadoLibre con:
    - Lenguaje persuasivo en español
    - Emojis relevantes
    - Sentido de urgencia
    - Palabras clave para búsqueda
    - Máximo 1500 caracteres`,
    
  facebook_shop: `Create Facebook Marketplace description with:
    - Casual, social media friendly tone
    - Strategic emoji usage
    - Relevant hashtags
    - Maximum 1000 characters`,
    
  shopify: `Create professional Shopify description with:
    - Brand-focused tone
    - Quality emphasis
    - SEO-friendly keywords
    - Maximum 2500 characters`,
    
  vtex: `Create enterprise VTEX description with:
    - Corporate, premium tone
    - Innovation emphasis
    - Technical specifications
    - Maximum 2000 characters`,
    
  woocommerce: `Create WooCommerce description with:
    - Technical, developer-friendly tone
    - Compatibility details
    - Structured format
    - Maximum 2000 characters`
};

// Helper function to extract keywords from content
function extractKeywords(content, existingTags = []) {
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  const wordFreq = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  const keywords = Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
    
  return [...new Set([...existingTags, ...keywords])].slice(0, 15);
}

// Generate fallback description when AI fails
function generateFallbackDescription(platform, product) {
  const templates = {
    amazon: `${product.title}\n\n✓ High-quality ${product.productType || 'product'}\n✓ Fast shipping available\n✓ Customer satisfaction guaranteed\n\n${product.description}`,
    mercadolibre: `🔥 ${product.title} 🔥\n\n✅ Producto de calidad premium\n✅ Envío rápido\n✅ Garantía incluida\n\n${product.description}`,
    facebook_shop: `${product.title} 📦\n\nGreat ${product.productType || 'item'} in excellent condition!\n\n${product.description}\n\n#forsale #quality #deals`,
    shopify: `${product.title}\n\nPremium ${product.productType || 'product'} crafted with attention to detail.\n\n${product.description}`,
    vtex: `${product.title}\n\nEnterprise-grade ${product.productType || 'solution'} designed for professional use.\n\n${product.description}`,
    woocommerce: `${product.title}\n\nReliable ${product.productType || 'product'} with excellent compatibility.\n\n${product.description}`
  };
  
  return {
    content: templates[platform] || product.description,
    tokens: 0,
    confidence: 0.6,
    keywords: extractKeywords(product.description, product.tags)
  };
}

// Generate AI-optimized description
async function generateOptimizedDescription(platform, product) {
  if (!process.env.OPENAI_API_KEY) {
    return generateFallbackDescription(platform, product);
  }

  try {
    const prompt = platformPrompts[platform] + `\n\nProduct: ${product.title}\nCurrent Description: ${product.description}\nProduct Type: ${product.productType || 'General'}\nTags: ${product.tags?.join(', ') || 'None'}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert ecommerce copywriter. Create optimized product descriptions that drive conversions. Respond with the description only, no additional text or explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.7
    });
    
    const content = response.choices[0]?.message?.content?.trim();
    
    return {
      content,
      tokens: response.usage?.total_tokens || 0,
      confidence: 0.85,
      keywords: extractKeywords(content, product.tags)
    };
  } catch (error) {
    console.error('AI generation failed:', error);
    return generateFallbackDescription(platform, product);
  }
}

// GET /api/products/:id/optimizations/description/:platform - Get or generate description suggestion
router.get('/products/:id/description/:platform', protect, async (req, res) => {
  try {
    const { id: productId, platform } = req.params;
    const userId = req.user._id;

    // Verify product ownership
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check for existing cached description
    const existingCachedDescription = product.cachedDescriptions?.find(
      cached => cached.platform === platform
    );
    
    if (existingCachedDescription) {
      return res.json({
        success: true,
        data: {
          suggestion: {
            id: existingCachedDescription._id,
            originalContent: product.description,
            suggestedContent: existingCachedDescription.content,
            status: existingCachedDescription.status,
            metadata: {
              model: 'gpt-3.5-turbo',
              tokens: existingCachedDescription.tokens,
              confidence: existingCachedDescription.confidence,
              keywords: existingCachedDescription.keywords,
              prompt: platformPrompts[platform]
            },
            createdAt: existingCachedDescription.createdAt
          },
          cached: true
        }
      });
    }

    // Generate new suggestion
    const aiResult = await generateOptimizedDescription(platform, product);
    
    // Add to cached descriptions
    const newCachedDescription = {
      platform,
      content: aiResult.content,
      confidence: aiResult.confidence,
      keywords: aiResult.keywords,
      tokens: aiResult.tokens,
      createdAt: new Date(),
      status: 'pending'
    };

    product.cachedDescriptions = product.cachedDescriptions || [];
    product.cachedDescriptions.push(newCachedDescription);
    await product.save();

    res.json({
      success: true,
      data: {
        suggestion: {
          id: newCachedDescription._id,
          originalContent: product.description,
          suggestedContent: newCachedDescription.content,
          status: newCachedDescription.status,
          metadata: {
            model: 'gpt-3.5-turbo',
            tokens: newCachedDescription.tokens,
            confidence: newCachedDescription.confidence,
            keywords: newCachedDescription.keywords,
            prompt: platformPrompts[platform]
          },
          createdAt: newCachedDescription.createdAt
        },
        cached: false
      }
    });

  } catch (error) {
    console.error('Error generating description optimization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate description optimization'
    });
  }
});

// POST /api/products/:id/optimizations/description/:platform - Force regenerate description
router.post('/products/:id/description/:platform', protect, async (req, res) => {
  try {
    const { id: productId, platform } = req.params;
    const userId = req.user._id;

    // Verify product ownership
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Generate new suggestion
    const aiResult = await generateOptimizedDescription(platform, product);
    
    // Remove existing cached description for this platform
    product.cachedDescriptions = product.cachedDescriptions || [];
    product.cachedDescriptions = product.cachedDescriptions.filter(
      cached => cached.platform !== platform
    );

    // Add new cached description
    const newCachedDescription = {
      platform,
      content: aiResult.content,
      confidence: aiResult.confidence,
      keywords: aiResult.keywords,
      tokens: aiResult.tokens,
      createdAt: new Date(),
      status: 'pending'
    };

    product.cachedDescriptions.push(newCachedDescription);
    await product.save();

    res.json({
      success: true,
      data: {
        suggestion: {
          id: newCachedDescription._id,
          originalContent: product.description,
          suggestedContent: newCachedDescription.content,
          status: newCachedDescription.status,
          metadata: {
            model: 'gpt-3.5-turbo',
            tokens: newCachedDescription.tokens,
            confidence: newCachedDescription.confidence,
            keywords: newCachedDescription.keywords,
            prompt: platformPrompts[platform]
          },
          createdAt: newCachedDescription.createdAt
        },
        cached: false
      }
    });

  } catch (error) {
    console.error('Error regenerating description optimization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate description optimization'
    });
  }
});

// PATCH /api/products/:id/optimizations/description/:platform - Update suggestion status
router.patch('/products/:id/description/:platform', protect, async (req, res) => {
  try {
    const { id: productId, platform } = req.params;
    const { status, suggestionId } = req.body;
    const userId = req.user._id;

    if (!['pending', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Verify product ownership
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Find the cached description
    const cachedDescription = product.cachedDescriptions?.find(
      cached => cached._id.toString() === suggestionId && cached.platform === platform
    );

    if (!cachedDescription) {
      return res.status(404).json({
        success: false,
        message: 'Cached description not found'
      });
    }

    // Update status
    cachedDescription.status = status;

    // If accepted, optionally update the product description
    if (status === 'accepted') {
      product.description = cachedDescription.content;
    }

    await product.save();

    res.json({
      success: true,
      data: {
        suggestion: {
          id: cachedDescription._id,
          status: cachedDescription.status,
          updatedAt: new Date()
        }
      }
    });

  } catch (error) {
    console.error('Error updating suggestion status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update suggestion status'
    });
  }
});

// GET /api/products/:id/suggestions - Get suggestion history
router.get('/products/:id/suggestions', protect, async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { platform, type } = req.query;
    const userId = req.user._id;

    // Verify product ownership
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const suggestions = await Suggestion.getSuggestionHistory(userId, productId, platform, type);

    res.json({
      success: true,
      data: suggestions.map(s => ({
        id: s._id,
        platform: s.platform,
        type: s.type,
        title: s.title,
        description: s.description,
        originalContent: s.originalContent,
        suggestedContent: s.suggestedContent,
        status: s.status,
        metadata: s.metadata,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      }))
    });

  } catch (error) {
    console.error('Error fetching suggestion history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suggestion history'
    });
  }
});

module.exports = router;