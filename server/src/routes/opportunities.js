const express = require('express');
const { protect } = require('../middleware/auth');
const Product = require('../models/Product');
const Opportunity = require('../models/Opportunity');
const OpportunityCategory = require('../models/OpportunityCategory');
const StoreConnection = require('../models/StoreConnection');
const aiService = require('../services/aiService');
const { SUPPORTED_MARKETPLACES } = require('../constants/marketplaces');

const router = express.Router();

// GET /api/opportunities/categories - Get all available categories
router.get('/categories', protect, async (req, res) => {
  try {
    // Initialize categories if they don't exist
    await OpportunityCategory.initializeDefaultCategories();
    
    const categories = await OpportunityCategory.getActiveCategories();
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// GET /api/opportunities/products/:id - Get cached opportunities for a product
router.get('/products/:id', protect, async (req, res) => {
  try {
    const { id: productId } = req.params;
    const userId = req.user._id;
    const { category } = req.query;

    // Verify product belongs to user
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Clean up expired opportunities first
    await Opportunity.cleanupExpired();

    // Get opportunities (filtered by category if specified)
    let opportunities;
    if (category) {
      opportunities = await Opportunity.findByCategory(userId, productId, category);
    } else {
      opportunities = await Opportunity.findValidForProduct(userId, productId);
    }

    // Group opportunities by category for easier frontend handling
    const groupedOpportunities = {};
    opportunities.forEach(opp => {
      if (!groupedOpportunities[opp.category]) {
        groupedOpportunities[opp.category] = [];
      }
      groupedOpportunities[opp.category].push(opp);
    });

    // Get category counts
    const categoryCounts = {};
    opportunities.forEach(opp => {
      categoryCounts[opp.category] = (categoryCounts[opp.category] || 0) + 1;
    });

    // Determine available tabs (current marketplace + connected + suggested)
    const userConnections = await StoreConnection.find({ userId, isActive: true });
    const connectedMarketplaces = new Set();
    
    userConnections.forEach(conn => {
      if (conn.marketplaceType) {
        connectedMarketplaces.add(conn.marketplaceType);
      }
    });

    // Add current product marketplace
    connectedMarketplaces.add(product.marketplace);

    // Add marketplaces mentioned in opportunities
    opportunities.forEach(opp => {
      if (opp.marketplace) {
        connectedMarketplaces.add(opp.marketplace);
      }
    });

    const availableMarketplaceTabs = Array.from(connectedMarketplaces);

    res.json({
      success: true,
      data: {
        opportunities: groupedOpportunities,
        categoryCounts,
        availableMarketplaceTabs,
        totalCount: opportunities.length,
        productMarketplace: product.marketplace,
        cached: opportunities.length > 0,
        lastGenerated: opportunities.length > 0 ? opportunities[0].cachedAt : null
      }
    });

  } catch (error) {
    console.error('Get product opportunities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch opportunities'
    });
  }
});

// POST /api/opportunities/products/:id/generate - Generate new AI suggestions
router.post('/products/:id/generate', protect, async (req, res) => {
  try {
    const { id: productId } = req.params;
    const userId = req.user._id;
    const { forceRefresh = false } = req.body;

    // Verify product belongs to user
    const product = await Product.findOne({ _id: productId, userId })
      .populate('storeConnectionId');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if we have recent opportunities (unless force refresh)
    if (!forceRefresh) {
      const existingOpportunities = await Opportunity.findValidForProduct(userId, productId);
      if (existingOpportunities.length > 0) {
        return res.json({
          success: true,
          data: {
            opportunities: existingOpportunities,
            cached: true,
            message: 'Using cached opportunities. Use forceRefresh=true to regenerate.'
          }
        });
      }
    }

    // Get user's connected marketplaces for context
    const userConnections = await StoreConnection.find({ userId, isActive: true });
    const connectedMarketplaces = [];
    
    userConnections.forEach(conn => {
      if (conn.marketplaceType) {
        connectedMarketplaces.push(conn.marketplaceType);
      }
    });

    // Remove existing opportunities if force refresh
    if (forceRefresh) {
      await Opportunity.deleteMany({ userId, productId });
    }

    // Generate new opportunities using AI
    console.log(`Generating opportunities for product ${productId} (user: ${userId})`);
    
    const generatedOpportunities = await aiService.generateProductOpportunities(
      product.toObject(), 
      connectedMarketplaces
    );

    // Save opportunities to database
    const savedOpportunities = await Promise.all(
      generatedOpportunities.map(async (oppData) => {
        // Validate opportunity data
        const validation = aiService.validateOpportunity(oppData);
        if (!validation.valid) {
          console.warn('Invalid opportunity data:', validation.error, oppData);
          return null;
        }

        const opportunity = new Opportunity({
          userId,
          productId,
          category: oppData.category,
          marketplace: oppData.marketplace || null,
          title: oppData.title,
          description: oppData.description,
          priority: oppData.priority,
          potentialImpact: oppData.potentialImpact || { revenue: 0, percentage: 0 },
          actionRequired: oppData.actionRequired,
          aiMetadata: oppData.aiMetadata
        });

        return await opportunity.save();
      })
    );

    // Filter out null values (invalid opportunities)
    const validOpportunities = savedOpportunities.filter(opp => opp !== null);

    console.log(`Generated ${validOpportunities.length} opportunities for product ${productId}`);

    // Group by category for response
    const groupedOpportunities = {};
    validOpportunities.forEach(opp => {
      if (!groupedOpportunities[opp.category]) {
        groupedOpportunities[opp.category] = [];
      }
      groupedOpportunities[opp.category].push(opp);
    });

    // Get category counts
    const categoryCounts = {};
    validOpportunities.forEach(opp => {
      categoryCounts[opp.category] = (categoryCounts[opp.category] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        opportunities: groupedOpportunities,
        categoryCounts,
        totalCount: validOpportunities.length,
        cached: false,
        generatedAt: new Date().toISOString(),
        message: `Generated ${validOpportunities.length} new opportunities`
      }
    });

  } catch (error) {
    console.error('Generate opportunities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate opportunities'
    });
  }
});

// PATCH /api/opportunities/:id/status - Update opportunity status
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user._id;

    if (!['open', 'in_progress', 'completed', 'dismissed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const opportunity = await Opportunity.findOne({ _id: id, userId });
    if (!opportunity) {
      return res.status(404).json({
        success: false,
        message: 'Opportunity not found'
      });
    }

    opportunity.status = status;
    await opportunity.save();

    res.json({
      success: true,
      data: {
        opportunity,
        message: `Opportunity marked as ${status}`
      }
    });

  } catch (error) {
    console.error('Update opportunity status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update opportunity status'
    });
  }
});

// GET /api/opportunities/products/:id/summary - Get opportunity summary
router.get('/products/:id/summary', protect, async (req, res) => {
  try {
    const { id: productId } = req.params;
    const userId = req.user._id;

    // Verify product belongs to user
    const product = await Product.findOne({ _id: productId, userId });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const opportunities = await Opportunity.findValidForProduct(userId, productId);

    // Calculate summary stats
    const stats = {
      total: opportunities.length,
      byPriority: {
        critical: opportunities.filter(o => o.priority === 'critical').length,
        high: opportunities.filter(o => o.priority === 'high').length,
        medium: opportunities.filter(o => o.priority === 'medium').length,
        low: opportunities.filter(o => o.priority === 'low').length
      },
      byStatus: {
        open: opportunities.filter(o => o.status === 'open').length,
        in_progress: opportunities.filter(o => o.status === 'in_progress').length,
        completed: opportunities.filter(o => o.status === 'completed').length
      },
      totalPotentialImpact: opportunities.reduce((sum, o) => 
        sum + (o.potentialImpact?.percentage || 0), 0
      )
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get opportunity summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch opportunity summary'
    });
  }
});

module.exports = router;