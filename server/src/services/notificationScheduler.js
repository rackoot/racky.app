const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { 
  sendSubscriptionExpirationWarning, 
  sendSubscriptionExpiredNotification,
  sendSubscriptionSuspensionNotification,
  sendSubscriptionCancelledNotification 
} = require('./emailService');

// Check for subscriptions expiring soon and send notifications
const checkSubscriptionExpirations = async () => {
  try {
    console.log('🔍 Checking for subscription expirations...');
    
    // Find subscriptions expiring in 7 days
    const subscriptionsExpiring7Days = await Subscription.findExpiringSubscriptions(7);
    
    // Find subscriptions expiring in 3 days
    const subscriptionsExpiring3Days = await Subscription.findExpiringSubscriptions(3);
    
    // Find subscriptions expiring in 1 day
    const subscriptionsExpiring1Day = await Subscription.findExpiringSubscriptions(1);
    
    // Find expired subscriptions
    const expiredSubscriptions = await Subscription.findExpiredSubscriptions();

    // Send 7-day warnings (only once)
    for (const subscription of subscriptionsExpiring7Days) {
      const daysRemaining = subscription.daysUntilExpiration();
      if (daysRemaining === 7 && subscription.expirationWarningsSent.length === 0) {
        console.log(`📧 Sending 7-day expiration warning to ${subscription.userId.email}`);
        await sendSubscriptionExpirationWarning(subscription.userId, subscription, daysRemaining);
        
        // Track warning sent
        subscription.expirationWarningsSent.push(new Date());
        await subscription.save();
      }
    }

    // Send 3-day warnings
    for (const subscription of subscriptionsExpiring3Days) {
      const daysRemaining = subscription.daysUntilExpiration();
      if (daysRemaining === 3 && subscription.expirationWarningsSent.length === 1) {
        console.log(`📧 Sending 3-day expiration warning to ${subscription.userId.email}`);
        await sendSubscriptionExpirationWarning(subscription.userId, subscription, daysRemaining);
        
        // Track warning sent
        subscription.expirationWarningsSent.push(new Date());
        await subscription.save();
      }
    }

    // Send 1-day warnings
    for (const subscription of subscriptionsExpiring1Day) {
      const daysRemaining = subscription.daysUntilExpiration();
      if (daysRemaining === 1 && subscription.expirationWarningsSent.length === 2) {
        console.log(`📧 Sending 1-day expiration warning to ${subscription.userId.email}`);
        await sendSubscriptionExpirationWarning(subscription.userId, subscription, daysRemaining);
        
        // Track warning sent
        subscription.expirationWarningsSent.push(new Date());
        await subscription.save();
      }
    }

    // Send expiration notifications and update status
    for (const subscription of expiredSubscriptions) {
      console.log(`📧 Sending subscription expired notification to ${subscription.userId.email}`);
      await sendSubscriptionExpiredNotification(subscription.userId, subscription);
      
      // Update subscription status
      subscription.status = 'EXPIRED';
      subscription.expiredNotificationSent = true;
      await subscription.save();
    }

    const totalProcessed = subscriptionsExpiring7Days.length + subscriptionsExpiring3Days.length + 
                          subscriptionsExpiring1Day.length + expiredSubscriptions.length;
    console.log(`✅ Subscription expiration check complete. Processed ${totalProcessed} subscriptions.`);
    
  } catch (error) {
    console.error('❌ Error checking subscription expirations:', error);
  }
};

// Check for suspended subscriptions and send notifications
const checkSuspendedSubscriptions = async () => {
  try {
    console.log('🔍 Checking for suspended subscriptions...');
    
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    // Find recently suspended subscriptions that haven't been notified
    const suspendedSubscriptions = await Subscription.find({
      status: 'SUSPENDED',
      suspendedAt: { $gte: oneDayAgo },
      suspensionNotificationSent: false
    }).populate('userId planId');

    for (const subscription of suspendedSubscriptions) {
      console.log(`📧 Sending suspension notification to ${subscription.userId.email}`);
      await sendSubscriptionSuspensionNotification(subscription.userId, subscription);
      
      // Mark notification as sent
      subscription.suspensionNotificationSent = true;
      await subscription.save();
    }

    console.log(`✅ Suspended subscription check complete. Processed ${suspendedSubscriptions.length} subscriptions.`);
    
  } catch (error) {
    console.error('❌ Error checking suspended subscriptions:', error);
  }
};

// Check for cancelled subscriptions and send notifications
const checkCancelledSubscriptions = async () => {
  try {
    console.log('🔍 Checking for cancelled subscriptions...');
    
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    // Find recently cancelled subscriptions that haven't been notified
    const cancelledSubscriptions = await Subscription.find({
      status: 'CANCELLED',
      cancelledAt: { $gte: oneDayAgo },
      cancellationNotificationSent: false
    }).populate('userId planId');

    for (const subscription of cancelledSubscriptions) {
      console.log(`📧 Sending cancellation notification to ${subscription.userId.email}`);
      await sendSubscriptionCancelledNotification(subscription.userId, subscription);
      
      // Mark notification as sent
      subscription.cancellationNotificationSent = true;
      await subscription.save();
    }

    console.log(`✅ Cancelled subscription check complete. Processed ${cancelledSubscriptions.length} subscriptions.`);
    
  } catch (error) {
    console.error('❌ Error checking cancelled subscriptions:', error);
  }
};

// Run all notification checks
const runNotificationChecks = async () => {
  console.log('🚀 Starting notification scheduler...');
  
  await checkSubscriptionExpirations();
  await checkSuspendedSubscriptions();
  await checkCancelledSubscriptions();
  
  console.log('✅ All notification checks complete.');
};

// Initialize notification scheduler
const initializeNotificationScheduler = () => {
  // Run immediately on startup
  runNotificationChecks();
  
  // Run every hour (3600000 ms)
  const hourlyInterval = setInterval(runNotificationChecks, 3600000);
  
  // Run daily check at 9 AM (more comprehensive)
  const now = new Date();
  const millisTill9AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0) - now;
  const adjustedMillis = millisTill9AM < 0 ? millisTill9AM + 86400000 : millisTill9AM;
  
  setTimeout(() => {
    runNotificationChecks();
    
    // Then run daily at 9 AM
    const dailyInterval = setInterval(runNotificationChecks, 86400000); // 24 hours
    
    console.log('📅 Daily notification check scheduled for 9 AM');
  }, adjustedMillis);
  
  console.log('📧 Subscription notification scheduler initialized - running hourly checks');
  
  // Return cleanup function
  return () => {
    clearInterval(hourlyInterval);
    console.log('📧 Notification scheduler stopped');
  };
};

module.exports = {
  checkSubscriptionExpirations,
  checkSuspendedSubscriptions,
  checkCancelledSubscriptions,
  runNotificationChecks,
  initializeNotificationScheduler
};