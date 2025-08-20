const express = require('express');
const Joi = require('joi');
const { protect } = require('../middleware/auth');
const { 
  getAvailableMarketplaces, 
  testMarketplaceConnection, 
  getUserMarketplaceStatus 
} = require('../services/marketplaceService');
const StoreConnection = require('../models/StoreConnection');

const router = express.Router();

router.use(protect);

const testConnectionSchema = Joi.object({
  type: Joi.string().valid('shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce').required(),
  credentials: Joi.object().required()
});

const connectMarketplaceSchema = Joi.object({
  storeConnectionId: Joi.string().required(),
  type: Joi.string().valid('shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce').required(),
  credentials: Joi.object().required()
});

const createStoreWithMarketplaceSchema = Joi.object({
  storeName: Joi.string().required(),
  type: Joi.string().valid('shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce').required(),
  credentials: Joi.object().required()
});

// GET /api/marketplaces - List all available marketplaces
router.get('/', (req, res) => {
  try {
    const marketplaces = getAvailableMarketplaces();
    res.json({
      success: true,
      data: marketplaces
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching marketplaces', 
      error: error.message 
    });
  }
});

// GET /api/marketplaces/status - Get user's marketplace connection status
router.get('/status', async (req, res) => {
  try {
    const marketplaceStatus = await getUserMarketplaceStatus(req.user._id);
    res.json({
      success: true,
      data: marketplaceStatus
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching marketplace status', 
      error: error.message 
    });
  }
});

// POST /api/marketplaces/test - Test marketplace connection
router.post('/test', async (req, res) => {
  try {
    const { error } = testConnectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { type, credentials } = req.body;
    const result = await testMarketplaceConnection(type, credentials);
    
    res.json({
      success: result.success,
      message: result.message,
      data: result.data || null
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error testing marketplace connection', 
      error: error.message 
    });
  }
});

// POST /api/marketplaces/connect - Connect marketplace (deprecated - use create-store instead)
router.post('/connect', async (req, res) => {
  return res.status(400).json({
    success: false,
    message: 'This endpoint is deprecated. Use /create-store to create a new marketplace connection.'
  });
});

// POST /api/marketplaces/create-store - Create new store with marketplace connection
router.post('/create-store', async (req, res) => {
  try {
    const { error } = createStoreWithMarketplaceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { storeName, type, credentials } = req.body;

    // Check if user already has this marketplace type connected
    const existingConnection = await StoreConnection.findOne({
      userId: req.user._id,
      marketplaceType: type
    });

    if (existingConnection) {
      return res.status(400).json({
        success: false,
        message: `You already have a ${type} marketplace connected. Only one connection per marketplace type is allowed.`
      });
    }

    // First test the connection
    const testResult = await testMarketplaceConnection(type, credentials);
    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Connection test failed: ' + testResult.message
      });
    }

    // Create new store connection
    const storeConnection = await StoreConnection.create({
      userId: req.user._id,
      storeName,
      marketplaceType: type,
      credentials,
      isActive: true,
      syncStatus: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Store created and marketplace connected successfully',
      data: {
        storeConnection,
        testResult: testResult.data
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error creating store with marketplace', 
      error: error.message 
    });
  }
});

// PUT /api/marketplaces/:connectionId/test - Test existing marketplace connection
router.put('/:connectionId/test', async (req, res) => {
  try {
    const { connectionId } = req.params;

    const storeConnection = await StoreConnection.findOne({
      _id: connectionId,
      userId: req.user._id
    });

    if (!storeConnection) {
      return res.status(404).json({
        success: false,
        message: 'Store connection not found'
      });
    }

    const testResult = await testMarketplaceConnection(storeConnection.marketplaceType, storeConnection.credentials);
    
    // Update sync status based on test result
    storeConnection.syncStatus = testResult.success ? 'completed' : 'failed';
    storeConnection.lastSync = new Date();
    await storeConnection.save();

    res.json({
      success: testResult.success,
      message: testResult.message,
      data: {
        ...testResult.data,
        syncStatus: storeConnection.syncStatus,
        lastSync: storeConnection.lastSync
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error testing marketplace connection', 
      error: error.message 
    });
  }
});

// PUT /api/marketplaces/:connectionId/toggle - Toggle marketplace active status
router.put('/:connectionId/toggle', async (req, res) => {
  try {
    const { connectionId } = req.params;

    const storeConnection = await StoreConnection.findOne({
      _id: connectionId,
      userId: req.user._id
    });

    if (!storeConnection) {
      return res.status(404).json({
        success: false,
        message: 'Store connection not found'
      });
    }

    storeConnection.isActive = !storeConnection.isActive;
    storeConnection.syncStatus = storeConnection.isActive ? 'pending' : 'completed';
    await storeConnection.save();

    res.json({
      success: true,
      message: `Marketplace ${storeConnection.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        isActive: storeConnection.isActive,
        syncStatus: storeConnection.syncStatus
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error toggling marketplace status', 
      error: error.message 
    });
  }
});

module.exports = router;