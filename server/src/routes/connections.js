const express = require('express');
const Joi = require('joi');
const StoreConnection = require('../models/StoreConnection');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

const createConnectionSchema = Joi.object({
  storeName: Joi.string().required(),
  marketplaces: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce').required(),
      credentials: Joi.object().required()
    })
  ).min(1).required()
});

const updateConnectionSchema = Joi.object({
  storeName: Joi.string(),
  marketplaces: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce').required(),
      credentials: Joi.object().required(),
      isActive: Joi.boolean()
    })
  ),
  isActive: Joi.boolean()
});

router.get('/', async (req, res) => {
  try {
    const connections = await StoreConnection.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.json(connections);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const connection = await StoreConnection.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    res.json(connection);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { error } = createConnectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const connection = await StoreConnection.create({
      userId: req.user._id,
      ...req.body
    });

    res.status(201).json(connection);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { error } = updateConnectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const connection = await StoreConnection.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    res.json(connection);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/marketplace', async (req, res) => {
  try {
    const marketplaceSchema = Joi.object({
      type: Joi.string().valid('shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce').required(),
      credentials: Joi.object().required()
    });

    const { error } = marketplaceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const connection = await StoreConnection.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    const existingMarketplace = connection.marketplaces.find(m => m.type === req.body.type);
    if (existingMarketplace) {
      return res.status(400).json({ message: 'Marketplace already connected' });
    }

    connection.marketplaces.push(req.body);
    await connection.save();

    res.status(201).json(connection);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /api/connections/:id - Delete entire marketplace connection
router.delete('/:id', async (req, res) => {
  try {
    const deleteProducts = req.query.deleteProducts === 'true';
    
    const connection = await StoreConnection.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!connection) {
      return res.status(404).json({ 
        success: false,
        message: 'Connection not found' 
      });
    }

    let deletedProductsCount = 0;

    // If deleteProducts is true, delete all associated products
    if (deleteProducts) {
      const Product = require('../models/Product');
      const deleteResult = await Product.deleteMany({
        userId: req.user._id,
        storeConnectionId: req.params.id
      });
      deletedProductsCount = deleteResult.deletedCount;
    } else {
      // Mark connection as inactive without deleting products
      connection.isActive = false;
      await connection.save();
      
      return res.json({ 
        success: true,
        message: 'Marketplace connection disconnected successfully',
        data: { 
          connection,
          deletedProductsCount: 0,
          productsPreserved: true
        }
      });
    }

    // Delete the connection
    await StoreConnection.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    res.json({ 
      success: true,
      message: `Marketplace connection deleted successfully. ${deletedProductsCount} products removed.`,
      data: { 
        connection,
        deletedProductsCount,
        productsPreserved: false
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;