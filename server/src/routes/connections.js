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

router.delete('/:id', async (req, res) => {
  try {
    const connection = await StoreConnection.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    res.json({ message: 'Connection deleted successfully' });
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

router.delete('/:id/marketplace/:marketplaceId', async (req, res) => {
  try {
    const connection = await StoreConnection.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    connection.marketplaces.id(req.params.marketplaceId).remove();
    await connection.save();

    res.json(connection);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;