const express = require('express');
const Plan = require('../models/Plan');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/plans - Get all public subscription plans
router.get('/', async (req, res) => {
  try {
    const plans = await Plan.findPublicPlans();
    
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription plans',
      error: error.message
    });
  }
});

// GET /api/plans/:name - Get specific plan details
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const plan = await Plan.findByName(name);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plan details',
      error: error.message
    });
  }
});

// GET /api/plans/user/current - Get current user's plan (requires auth)
router.get('/user/current', protect, async (req, res) => {
  try {
    if (!req.user.subscriptionPlan) {
      return res.status(400).json({
        success: false,
        message: 'User has no subscription plan assigned'
      });
    }

    const userPlan = await Plan.findByName(req.user.subscriptionPlan);
    
    if (!userPlan) {
      return res.status(404).json({
        success: false,
        message: `Plan '${req.user.subscriptionPlan}' not found`
      });
    }

    res.json({
      success: true,
      data: {
        plan: userPlan,
        userSubscription: await req.user.getSubscriptionInfo()
      }
    });
  } catch (error) {
    console.error('Error fetching user plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user plan',
      error: error.message
    });
  }
});

module.exports = router;