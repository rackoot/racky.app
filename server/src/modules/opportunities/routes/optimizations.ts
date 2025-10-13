import express, { Response } from 'express';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import axios from 'axios';
import { AuthenticatedRequest } from '@/common/types/express';
import getEnv from '@/common/config/env';
import Product from '@/products/models/Product';
import Suggestion from '../models/Suggestion';
import * as marketplaceService from '../../marketplaces/services/marketplaceService';
import { protect } from '@/common/middleware/auth';
import ProductHistoryService from '@/products/services/ProductHistoryService';
import { JobType } from '@/common/types/jobTypes';

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
    console.warn('OpenAI client initialization failed in optimizations:', error);
    openai = null;
  }
}

// Interface definitions
interface UpdateStatusBody {
  status: 'pending' | 'accepted' | 'rejected';
  suggestionId: string;
}

interface ApplyDescriptionBody {
  suggestionId: string;
}

interface SuggestionsQuery {
  platform?: string;
  type?: string;
}

interface CachedDescription {
  _id?: any;
  platform: string;
  content: string;
  confidence: number;
  keywords: string[];
  tokens: number;
  createdAt: Date;
  status: 'pending' | 'accepted' | 'rejected';
}

interface AIResult {
  content: string;
  tokens: number;
  confidence: number;
  keywords: string[];
}

// Helper to check if a product is in AI optimization queue
async function getProductAIOptimizationStatus(productId: string, workspaceId: string, platform?: string) {
  const Job = (await import('@/common/models/Job')).default;
  
  // Check for active AI optimization jobs for this product
  const activeJobs = await Job.find({
    workspaceId,
    $or: [
      { 'data.productId': productId },
      { 'data.productIds': { $in: [productId] } }
    ],
    jobType: 'AI_OPTIMIZATION_SCAN',
    status: { $in: ['queued', 'processing'] }
  }).limit(10);

  // Check if this product is in any active jobs
  for (const job of activeJobs) {
    if (job.data.productId === productId || job.data.productIds?.includes(productId)) {
      return {
        status: job.status,
        jobId: job.jobId,
        batchNumber: job.data.batchNumber,
        totalBatches: job.data.totalBatches,
        marketplace: job.data.marketplace
      };
    }
  }

  // Check if there's a recent AI optimization in history (last 24 hours)
  const ProductHistory = (await import('@/products/models/ProductHistory')).default;
  const recentOptimization = await ProductHistory.findOne({
    productId,
    workspaceId,
    actionType: 'AI_OPTIMIZATION_GENERATED',
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    ...(platform && { 'metadata.marketplace': platform })
  }).sort({ createdAt: -1 });

  if (recentOptimization) {
    return {
      status: 'recently_optimized',
      optimizedAt: recentOptimization.createdAt,
      marketplace: recentOptimization.metadata?.marketplace
    };
  }

  return null;
}

// Platform-specific prompts for AI generation
const platformPrompts: Record<string, string> = {
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
function extractKeywords(content: string, existingTags: string[] = []): string[] {
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  const wordFreq: Record<string, number> = {};
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
function generateFallbackDescription(platform: string, product: any): AIResult {
  const templates: Record<string, string> = {
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
async function generateOptimizedDescription(platform: string, product: any): Promise<AIResult> {
  if (!env.OPENAI_API_KEY) {
    return generateFallbackDescription(platform, product);
  }

  try {
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }

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
    
    const content = response.choices[0]?.message?.content?.trim() || '';
    
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
router.get('/products/:id/description/:platform', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await protect(req, res, async () => {
      const { id: productId, platform } = req.params;
      const workspaceId = req.workspace!._id;

      
      // Verify product ownership
      const product = await Product.findOne({ _id: productId, workspaceId });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Check if product is in an AI optimization queue
      const queueStatus = await getProductAIOptimizationStatus(productId, workspaceId.toString(), platform);
      if (queueStatus) {
        return res.json({
          success: true,
          data: {
            queueStatus,
            cached: false
          }
        });
      }

      // Check for existing cached description
      const existingCachedDescription = product.cachedDescriptions?.find(
        (cached: any) => cached.platform === platform
      );
      
      if (existingCachedDescription) {
        return res.json({
          success: true,
          data: {
            suggestion: {
              id: (existingCachedDescription as any)._id,
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

      // Create history entry for AI optimization generation
      const generationHistory = await ProductHistoryService.createAIOptimizationHistory({
        workspaceId: workspaceId.toString(),
        userId: req.user!._id.toString(),
        productId,
        actionType: 'AI_OPTIMIZATION_GENERATED',
        marketplace: platform,
        aiModel: 'gpt-3.5-turbo',
        originalContent: product.description || ''
      });

      // Generate new suggestion
      const aiResult = await generateOptimizedDescription(platform, product);
      
      // Update history with results
      await ProductHistoryService.markCompleted(
        generationHistory._id.toString(),
        'SUCCESS',
        {
          confidence: aiResult.confidence,
          tokensUsed: aiResult.tokens,
          newContent: aiResult.content,
          keywords: aiResult.keywords
        }
      );
      
      // Add to cached descriptions
      const newCachedDescription: any = {
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
    });
  } catch (error: any) {
    console.error('Error generating description optimization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate description optimization'
    });
  }
});

// POST /api/products/:id/optimizations/description/:platform - Force regenerate description
router.post('/products/:id/description/:platform', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await protect(req, res, async () => {
      const { id: productId, platform } = req.params;
      const workspaceId = req.workspace!._id;

      
      // Verify product ownership
      const product = await Product.findOne({ _id: productId, workspaceId });
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
        (cached: any) => cached.platform !== platform
      );

      // Add new cached description
      const newCachedDescription: any = {
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
    });
  } catch (error: any) {
    console.error('Error regenerating description optimization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate description optimization'
    });
  }
});

// PATCH /api/products/:id/optimizations/description/:platform - Update suggestion status
router.patch('/products/:id/description/:platform', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await protect(req, res, async () => {
      const { id: productId, platform } = req.params;
      const { status, suggestionId } = req.body;
      const workspaceId = req.workspace!._id;

      if (!['pending', 'accepted', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }

      
      // Verify product ownership
      const product = await Product.findOne({ _id: productId, workspaceId });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Find the cached description
      const cachedDescription = product.cachedDescriptions?.find(
        (cached: any) => cached._id?.toString() === suggestionId && cached.platform === platform
      );

      if (!cachedDescription) {
        return res.status(404).json({
          success: false,
          message: 'Cached description not found'
        });
      }

      // Update status
      const oldStatus = cachedDescription.status;
      cachedDescription.status = status;

      // Track history for accept/reject actions
      if (status === 'accepted' && oldStatus !== 'accepted') {
        await ProductHistoryService.createAIOptimizationHistory({
          workspaceId: workspaceId.toString(),
          userId: req.user!._id.toString(),
          productId,
          actionType: 'AI_OPTIMIZATION_ACCEPTED',
          marketplace: platform,
          originalContent: product.description || '',
          newContent: cachedDescription.content,
          confidence: cachedDescription.confidence
        });
      } else if (status === 'rejected' && oldStatus !== 'rejected') {
        await ProductHistoryService.createAIOptimizationHistory({
          workspaceId: workspaceId.toString(),
          userId: req.user!._id.toString(),
          productId,
          actionType: 'AI_OPTIMIZATION_REJECTED',
          marketplace: platform,
          originalContent: product.description || '',
          newContent: cachedDescription.content,
          confidence: cachedDescription.confidence
        });
      }

      await product.save();

      res.json({
        success: true,
        data: {
          suggestion: {
            id: (cachedDescription as any)._id,
            status: cachedDescription.status,
            updatedAt: new Date()
          }
        }
      });
    });
  } catch (error: any) {
    console.error('Error updating suggestion status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update suggestion status'
    });
  }
});

// POST /api/products/:id/optimizations/description/:platform/apply - Apply accepted description to store
router.post('/products/:id/description/:platform/apply', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await protect(req, res, async () => {
      const { id: productId, platform } = req.params;
      const { suggestionId } = req.body;
      const workspaceId = req.workspace!._id;

      
      // Verify product ownership and populate store connection info
      const product = await Product.findOne({ _id: productId, workspaceId }).populate('storeConnectionId');
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Find the cached description
      const cachedDescription = product.cachedDescriptions?.find(
        (cached: any) => cached._id?.toString() === suggestionId && cached.platform === platform
      );

      if (!cachedDescription) {
        return res.status(404).json({
          success: false,
          message: 'Cached description not found'
        });
      }

      if (cachedDescription.status !== 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Description must be accepted before applying to store'
        });
      }

      let storeUpdateResult = { success: false, message: 'No store connection found' };

      // Check if we have a store connection for this marketplace
      if (product.storeConnectionId && (product.storeConnectionId as any).marketplaceType === platform) {
        try {
          // First, try to apply the description to the connected store
          storeUpdateResult = await updateProductDescriptionInStore(
            platform,
            product,
            cachedDescription.content,
            product.storeConnectionId
          );

          // Only update local description if marketplace update was successful
          if (storeUpdateResult.success) {
            // Track successful application to marketplace
            await ProductHistoryService.createAIOptimizationHistory({
              workspaceId: workspaceId.toString(),
              userId: req.user!._id.toString(),
              productId,
              actionType: 'AI_OPTIMIZATION_APPLIED',
              marketplace: platform,
              originalContent: product.description || '',
              newContent: cachedDescription.content,
              confidence: cachedDescription.confidence
            });

            product.description = cachedDescription.content;
            await product.save();
          } else {
            // Track failed application
            await ProductHistoryService.createErrorHistory({
              workspaceId: workspaceId.toString(),
              userId: req.user!._id.toString(),
              productId,
              actionType: 'SYNC_FAILED',
              errorMessage: storeUpdateResult.message,
              marketplace: platform
            });
          }
        } catch (error: any) {
          console.error('Failed to update product in store:', error);
          storeUpdateResult = {
            success: false,
            message: error.message || 'Failed to update product in connected store'
          };
        }
      } else {
        // If no store connection, just update locally
        await ProductHistoryService.createProductUpdateHistory({
          workspaceId: workspaceId.toString(),
          userId: req.user!._id.toString(),
          productId,
          actionType: 'DESCRIPTION_UPDATED',
          fieldChanged: 'description',
          oldValue: product.description,
          newValue: cachedDescription.content,
          marketplace: platform
        });

        product.description = cachedDescription.content;
        await product.save();
        storeUpdateResult = {
          success: true,
          message: `Description updated locally (no ${platform} store connection found)`
        };
      }

      res.json({
        success: true,
        data: {
          storeUpdateResult,
          message: storeUpdateResult.success 
            ? 'Description successfully applied to store and updated locally'
            : 'Failed to update marketplace - local description unchanged'
        }
      });
    });
  } catch (error: any) {
    console.error('Error applying description to store:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply description to store'
    });
  }
});

// Helper function to update product description in connected marketplace
async function updateProductDescriptionInStore(platform: string, product: any, newDescription: string, storeConnection: any) {
  const { credentials } = storeConnection;
  
  switch (platform) {
    case 'shopify':
      return await updateShopifyProductDescription(product, newDescription, credentials);
    case 'woocommerce':
      return await updateWooCommerceProductDescription(product, newDescription, credentials);
    case 'vtex':
      return await updateVtexProductDescription(product, newDescription, credentials);
    case 'mercadolibre':
      return await updateMercadoLibreProductDescription(product, newDescription, credentials);
    case 'facebook_shop':
      return await updateFacebookShopProductDescription(product, newDescription, credentials);
    default:
      return {
        success: false,
        message: `Store updates not yet implemented for ${platform}`
      };
  }
}

// Shopify product description update
async function updateShopifyProductDescription(product: any, newDescription: string, credentials: any) {
  try {
    const { shop_url, access_token } = credentials;
    const cleanShopUrl = shop_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Extract numeric ID from GraphQL ID (gid://shopify/Product/123456 -> 123456)
    let productId = product.externalId || product.shopifyId;
    if (productId && productId.includes('gid://shopify/Product/')) {
      productId = productId.replace('gid://shopify/Product/', '');
    }
    
    console.log(`Updating Shopify product ${productId} with new description`);
    
    const response = await axios.put(
      `https://${cleanShopUrl}/admin/api/2023-10/products/${productId}.json`,
      {
        product: {
          body_html: newDescription
        }
      },
      {
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return {
      success: true,
      message: 'Shopify product description updated successfully',
      data: {
        productId: response.data.product.id,
        updatedAt: response.data.product.updated_at
      }
    };
  } catch (error: any) {
    console.error('Shopify update error:', error.response?.data || error.message);
    return {
      success: false,
      message: `Shopify update failed: ${error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message}`
    };
  }
}

// WooCommerce product description update
async function updateWooCommerceProductDescription(product: any, newDescription: string, credentials: any) {
  try {
    const { site_url, consumer_key, consumer_secret } = credentials;
    const cleanUrl = site_url.replace(/\/$/, '');
    
    const response = await axios.put(
      `${cleanUrl}/wp-json/@/products/${product.externalId}`,
      {
        description: newDescription
      },
      {
        auth: {
          username: consumer_key,
          password: consumer_secret
        },
        timeout: 10000
      }
    );

    return {
      success: true,
      message: 'WooCommerce product description updated successfully',
      data: {
        productId: response.data.id,
        updatedAt: response.data.date_modified
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `WooCommerce update failed: ${error.response?.data?.message || error.message}`
    };
  }
}

// VTEX product description update
async function updateVtexProductDescription(product: any, newDescription: string, credentials: any) {
  try {
    const { account_name, app_key, app_token } = credentials;
    
    const response = await axios.put(
      `https://${account_name}.vtexcommercestable.com.br/api/catalog/pvt/product/${product.externalId}`,
      {
        Description: newDescription
      },
      {
        headers: {
          'X-VTEX-API-AppKey': app_key,
          'X-VTEX-API-AppToken': app_token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return {
      success: true,
      message: 'VTEX product description updated successfully',
      data: {
        productId: product.externalId
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `VTEX update failed: ${error.response?.data?.message || error.message}`
    };
  }
}

// MercadoLibre product description update
async function updateMercadoLibreProductDescription(product: any, newDescription: string, credentials: any) {
  try {
    const { access_token } = credentials;
    
    const response = await axios.put(
      `https://api.mercadolibre.com/items/${product.externalId}`,
      {
        description: {
          plain_text: newDescription
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return {
      success: true,
      message: 'MercadoLibre product description updated successfully',
      data: {
        productId: response.data.id,
        updatedAt: response.data.last_updated
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `MercadoLibre update failed: ${error.response?.data?.message || error.message}`
    };
  }
}

// Facebook Shop product description update
async function updateFacebookShopProductDescription(product: any, newDescription: string, credentials: any) {
  try {
    const { page_id, access_token } = credentials;
    
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${product.externalId}`,
      {
        description: newDescription,
        access_token: access_token
      },
      {
        timeout: 10000
      }
    );

    return {
      success: true,
      message: 'Facebook Shop product description updated successfully',
      data: {
        productId: product.externalId
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Facebook Shop update failed: ${error.response?.data?.error?.message || error.message}`
    };
  }
}

// GET /api/products/:id/suggestions - Get suggestion history
router.get('/products/:id/suggestions', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await protect(req, res, async () => {
      const { id: productId } = req.params;
      const { platform, type } = req.query as any;
      const workspaceId = req.workspace!._id;

            
      // Verify product ownership
      const product = await Product.findOne({ _id: productId, workspaceId });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const suggestions = await Suggestion.getSuggestionHistory(new mongoose.Types.ObjectId(workspaceId.toString()), new mongoose.Types.ObjectId(productId), platform, type);

      res.json({
        success: true,
        data: suggestions.map((s: any) => ({
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
    });
  } catch (error: any) {
    console.error('Error fetching suggestion history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suggestion history'
    });
  }
});

// GET /api/products/:id/optimizations/status - Get AI optimization status for a product
router.get('/products/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await protect(req, res, async () => {
      const { id: productId } = req.params;
      const workspaceId = req.workspace!._id;

      // Verify product ownership
      const product = await Product.findOne({ _id: productId, workspaceId });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Get available platforms for this product
      const availablePlatforms: string[] = [];
      if (product.marketplace) {
        availablePlatforms.push(product.marketplace);
      }
      if (product.platforms) {
        Object.keys(product.platforms).forEach(platform => {
          if (!availablePlatforms.includes(platform)) {
            availablePlatforms.push(platform);
          }
        });
      }

      // Check status for each platform
      const platformStatuses: Record<string, any> = {};

      for (const platform of availablePlatforms) {
        // Check if in queue
        const queueStatus = await getProductAIOptimizationStatus(productId, workspaceId.toString(), platform);

        // Check for cached description in product.cachedDescriptions
        let cachedDescription: any = product.cachedDescriptions?.find(
          (cached: any) => cached.platform === platform
        );

        // If not found in cachedDescriptions, check in Opportunity model for AI-generated descriptions
        if (!cachedDescription) {
          const Opportunity = (await import('../models/Opportunity')).default;
          const aiDescription = await Opportunity.findOne({
            productId,
            workspaceId,
            category: 'description',
            aiGenerated: true,
            status: { $in: ['open', 'in_progress'] } // Only show active opportunities
          }).sort({ createdAt: -1 }); // Get the most recent one

          if (aiDescription) {
            cachedDescription = {
              _id: aiDescription._id,
              platform: platform,
              content: aiDescription.description,
              confidence: aiDescription.aiMetadata?.confidence || 0.8,
              tokens: aiDescription.aiMetadata?.tokens || 0,
              createdAt: aiDescription.createdAt,
              status: 'pending' // AI scan results are always pending until accepted
            };
          }
        }

        platformStatuses[platform] = {
          inQueue: queueStatus?.status === 'queued' || queueStatus?.status === 'processing',
          queueStatus,
          hasOptimization: !!cachedDescription,
          optimization: cachedDescription ? {
            id: (cachedDescription as any)._id,
            content: cachedDescription.content,
            status: cachedDescription.status,
            confidence: cachedDescription.confidence,
            createdAt: cachedDescription.createdAt
          } : null
        };
      }

      res.json({
        success: true,
        data: {
          productId,
          platforms: platformStatuses,
          availablePlatforms
        }
      });
    });
  } catch (error: any) {
    console.error('Error getting optimization status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get optimization status'
    });
  }
});

// POST /api/products/bulk/optimizations/description - Bulk generate descriptions
router.post('/products/bulk/description', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await protect(req, res, async () => {
      const { productIds } = req.body;
      const workspaceId = req.workspace!._id;
      const userId = req.user!._id;

      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Product IDs array is required'
        });
      }

      // Verify all products belong to this workspace
      const products = await Product.find({
        _id: { $in: productIds },
        workspaceId
      });

      if (products.length !== productIds.length) {
        return res.status(404).json({
          success: false,
          message: 'Some products not found or do not belong to this workspace'
        });
      }

      // Import RabbitMQ service
      const rabbitMQService = (await import('@/common/services/rabbitMQService')).default;

      // Generate a unique batch ID
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Queue each product for AI description generation
      const queuedProducts: string[] = [];
      const failedProducts: string[] = [];

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const marketplace = product.marketplace || 'shopify'; // Default to shopify if not set

        try {
          const jobData = {
            productId: product._id.toString(),
            workspaceId: workspaceId.toString(),
            userId: userId.toString(),
            marketplace,
            batchId,
            totalInBatch: products.length,
            currentIndex: i + 1
          };

          const jobId = await rabbitMQService.addJob(
            'ai-description',
            JobType.AI_DESCRIPTION_GENERATION,
            jobData
          );

          if (jobId) {
            queuedProducts.push(product._id.toString());

            // Mark product's AI description as processing in the database
            const cachedIndex = product.cachedDescriptions?.findIndex(
              (cached: any) => cached.platform === marketplace
            );

            if (cachedIndex !== undefined && cachedIndex >= 0 && product.cachedDescriptions) {
              product.cachedDescriptions[cachedIndex].status = 'processing';
              product.cachedDescriptions[cachedIndex].content = '';
            } else {
              product.cachedDescriptions = product.cachedDescriptions || [];
              product.cachedDescriptions.push({
                platform: marketplace as any,
                content: '',
                confidence: 0,
                keywords: [],
                tokens: 0,
                createdAt: new Date(),
                status: 'processing'
              });
            }

            await product.save();
          } else {
            failedProducts.push(product._id.toString());
          }
        } catch (error: any) {
          console.error(`Failed to queue product ${product._id}:`, error);
          failedProducts.push(product._id.toString());
        }
      }

      res.json({
        success: true,
        message: `Queued ${queuedProducts.length} product(s) for AI description generation`,
        data: {
          batchId,
          queuedCount: queuedProducts.length,
          failedCount: failedProducts.length,
          queuedProducts,
          failedProducts
        }
      });
    });
  } catch (error: any) {
    console.error('Error bulk generating descriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk generate descriptions'
    });
  }
});

export default router;
