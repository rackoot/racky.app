import express, { Response } from 'express';
import { AuthenticatedRequest } from '@/common/types/express';
import { protect } from '@/common/middleware/auth';
import { validateStripeCoupon } from '@/common/services/stripeService';

const router = express.Router();

// POST /api/coupons/validate - Validate a coupon code with Stripe
router.post('/validate', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { couponCode } = req.body;

    if (!couponCode || typeof couponCode !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    // Validate coupon/promotion code with Stripe
    const validation = await validateStripeCoupon(couponCode.trim().toUpperCase());

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error || 'Invalid promotion code or coupon',
        valid: false
      });
    }

    // Extract coupon details
    const coupon = validation.coupon!;

    return res.json({
      success: true,
      message: validation.promotionCode
        ? `Promotion code "${validation.promotionCode}" is valid`
        : 'Coupon is valid',
      valid: true,
      data: {
        // Promotion code info (if applicable)
        promotionCodeId: validation.promotionCodeId,
        promotionCode: validation.promotionCode,
        // Coupon details
        id: coupon.id,
        type: coupon.percent_off ? 'percent' : 'amount',
        value: coupon.percent_off || coupon.amount_off || 0,
        duration: coupon.duration,
        durationInMonths: coupon.duration_in_months,
        currency: coupon.currency,
        name: coupon.name,
        // Additional useful info
        maxRedemptions: coupon.max_redemptions,
        timesRedeemed: coupon.times_redeemed,
        redeemBy: coupon.redeem_by ? new Date(coupon.redeem_by * 1000).toISOString() : null
      }
    });

  } catch (error: any) {
    console.error('Error validating coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate coupon',
      error: error.message,
      valid: false
    });
  }
});

export default router;
