const express = require('express');
const Plan = require('../models/Plan');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// POST /api/demo/upgrade-subscription - Demo subscription upgrade
router.post('/upgrade-subscription', async (req, res) => {
  try {
    const { planName, billingCycle = 'monthly' } = req.body;
    
    if (!planName) {
      return res.status(400).json({
        success: false,
        message: 'Plan name is required'
      });
    }

    // Get the plan details to validate it exists
    const plan = await Plan.findByName(planName);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    console.log(`Demo: Upgrading user ${req.user.email} to ${planName} plan`);
    
    // Update user subscription directly (demo mode)
    req.user.subscriptionPlan = planName;
    req.user.subscriptionStatus = 'ACTIVE';
    
    // Set subscription end date (30 days from now)
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
    req.user.subscriptionEndsAt = subscriptionEndDate;
    
    await req.user.save();
    
    res.json({
      success: true,
      message: `Successfully upgraded to ${planName} plan (demo mode)`,
      data: {
        plan: planName,
        status: 'ACTIVE',
        endsAt: subscriptionEndDate
      }
    });

  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upgrade subscription',
      error: error.message
    });
  }
});

module.exports = router;