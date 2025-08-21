const User = require('../models/User');
const { 
  sendTrialExpirationWarning, 
  sendTrialExpiredNotification,
  sendSubscriptionCancelledNotification 
} = require('./emailService');

// Check for users with trials expiring soon and send notifications
const checkTrialExpirations = async () => {
  try {
    console.log('🔍 Checking for trial expirations...');
    
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
    const oneDayFromNow = new Date(now.getTime() + (1 * 24 * 60 * 60 * 1000));
    
    // Find users with trials expiring in 3 days
    const usersExpiring3Days = await User.find({
      subscriptionStatus: 'TRIAL',
      trialEndsAt: {
        $gte: now,
        $lte: threeDaysFromNow
      },
      lastTrialWarningAt: { $exists: false }
    });

    // Find users with trials expiring in 1 day
    const usersExpiring1Day = await User.find({
      subscriptionStatus: 'TRIAL',
      trialEndsAt: {
        $gte: now,
        $lte: oneDayFromNow
      },
      lastTrialWarningAt: { $lt: oneDayFromNow }
    });

    // Find users with expired trials
    const usersExpired = await User.find({
      subscriptionStatus: 'TRIAL',
      trialEndsAt: { $lt: now },
      trialExpiredNotificationSent: { $ne: true }
    });

    // Send 3-day warnings
    for (const user of usersExpiring3Days) {
      const daysRemaining = Math.ceil((user.trialEndsAt - now) / (24 * 60 * 60 * 1000));
      if (daysRemaining <= 3 && daysRemaining > 1) {
        console.log(`📧 Sending 3-day trial warning to ${user.email}`);
        await sendTrialExpirationWarning(user, daysRemaining);
        
        // Update user to mark warning sent
        await User.findByIdAndUpdate(user._id, {
          lastTrialWarningAt: now
        });
      }
    }

    // Send 1-day warnings
    for (const user of usersExpiring1Day) {
      const daysRemaining = Math.ceil((user.trialEndsAt - now) / (24 * 60 * 60 * 1000));
      if (daysRemaining <= 1 && daysRemaining >= 0) {
        console.log(`📧 Sending 1-day trial warning to ${user.email}`);
        await sendTrialExpirationWarning(user, Math.max(1, daysRemaining));
        
        // Update user to mark final warning sent
        await User.findByIdAndUpdate(user._id, {
          lastTrialWarningAt: now
        });
      }
    }

    // Send expiration notifications and update status
    for (const user of usersExpired) {
      console.log(`📧 Sending trial expired notification to ${user.email}`);
      await sendTrialExpiredNotification(user);
      
      // Update user status
      await User.findByIdAndUpdate(user._id, {
        subscriptionStatus: 'TRIAL_EXPIRED',
        trialExpiredNotificationSent: true,
        trialExpiredAt: now
      });
    }

    console.log(`✅ Trial expiration check complete. Processed ${usersExpiring3Days.length + usersExpiring1Day.length + usersExpired.length} users.`);
    
  } catch (error) {
    console.error('❌ Error checking trial expirations:', error);
  }
};

// Check for suspended subscriptions and send notifications
const checkSuspendedSubscriptions = async () => {
  try {
    console.log('🔍 Checking for suspended subscriptions...');
    
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    // Find users with recently suspended subscriptions that haven't been notified
    const suspendedUsers = await User.find({
      subscriptionStatus: 'SUSPENDED',
      subscriptionSuspendedAt: { $gte: oneDayAgo },
      suspensionNotificationSent: { $ne: true }
    });

    for (const user of suspendedUsers) {
      console.log(`📧 Sending suspension notification to ${user.email}`);
      // You could create a specific suspension notification email
      await sendTrialExpiredNotification(user); // Reuse expired notification for now
      
      // Mark notification as sent
      await User.findByIdAndUpdate(user._id, {
        suspensionNotificationSent: true
      });
    }

    console.log(`✅ Suspended subscription check complete. Processed ${suspendedUsers.length} users.`);
    
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
    
    // Find users with recently cancelled subscriptions that haven't been notified
    const cancelledUsers = await User.find({
      subscriptionStatus: 'CANCELLED',
      subscriptionCancelledAt: { $gte: oneDayAgo },
      cancellationNotificationSent: { $ne: true }
    });

    for (const user of cancelledUsers) {
      console.log(`📧 Sending cancellation notification to ${user.email}`);
      await sendSubscriptionCancelledNotification(user);
      
      // Mark notification as sent
      await User.findByIdAndUpdate(user._id, {
        cancellationNotificationSent: true
      });
    }

    console.log(`✅ Cancelled subscription check complete. Processed ${cancelledUsers.length} users.`);
    
  } catch (error) {
    console.error('❌ Error checking cancelled subscriptions:', error);
  }
};

// Run all notification checks
const runNotificationChecks = async () => {
  console.log('🚀 Starting notification scheduler...');
  
  await checkTrialExpirations();
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
  
  console.log('📧 Notification scheduler initialized - running hourly checks');
  
  // Return cleanup function
  return () => {
    clearInterval(hourlyInterval);
    console.log('📧 Notification scheduler stopped');
  };
};

module.exports = {
  checkTrialExpirations,
  checkSuspendedSubscriptions,
  checkCancelledSubscriptions,
  runNotificationChecks,
  initializeNotificationScheduler
};