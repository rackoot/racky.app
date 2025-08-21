// Email service for sending notifications
// In a production environment, this would integrate with services like SendGrid, AWS SES, etc.

const sendEmail = async (to, subject, htmlContent, textContent = null) => {
  try {
    // For development/demo purposes, just log the email
    console.log('📧 EMAIL NOTIFICATION:');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Content:', textContent || htmlContent);
    console.log('---');
    
    // In production, implement actual email sending:
    /*
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    const msg = {
      to,
      from: 'noreply@racky.app',
      subject,
      text: textContent,
      html: htmlContent,
    };
    
    await sgMail.send(msg);
    */
    
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

const sendTrialExpirationWarning = async (user, daysRemaining) => {
  const subject = `Your Racky trial expires in ${daysRemaining} days`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Trial Expiration Warning</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }
        .content { padding: 20px 0; }
        .cta-button { 
          display: inline-block; 
          background: #007bff; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 4px; 
          margin: 20px 0;
        }
        .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏰ Your Racky trial is ending soon!</h1>
        </div>
        
        <div class="content">
          <p>Hi there,</p>
          
          <p>Your Racky free trial expires in <strong>${daysRemaining} days</strong>. Don't lose access to your marketplace management platform!</p>
          
          <p>With Racky, you've been able to:</p>
          <ul>
            <li>Connect and manage multiple marketplace stores</li>
            <li>Sync products across different platforms</li>
            <li>Track performance and analytics</li>
            <li>Optimize your e-commerce operations</li>
          </ul>
          
          <p>To continue enjoying these benefits, upgrade to a paid plan today:</p>
          
          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription" class="cta-button">
              Upgrade Your Plan
            </a>
          </div>
          
          <p>Need help choosing the right plan? Our team is here to assist you.</p>
          
          <p>Best regards,<br>The Racky Team</p>
        </div>
        
        <div class="footer">
          <p>This email was sent to ${user.email}</p>
          <p>Racky - Marketplace Management Platform</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const textContent = `
Your Racky trial expires in ${daysRemaining} days!

Hi there,

Your Racky free trial expires in ${daysRemaining} days. Don't lose access to your marketplace management platform!

To continue enjoying all the benefits of Racky, upgrade to a paid plan today.

Visit: ${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription

Best regards,
The Racky Team
  `;
  
  return await sendEmail(user.email, subject, htmlContent, textContent);
};

const sendTrialExpiredNotification = async (user) => {
  const subject = 'Your Racky trial has expired';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Trial Expired</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #fff3cd; padding: 20px; text-align: center; border-radius: 8px; border: 1px solid #ffeaa7; }
        .content { padding: 20px 0; }
        .cta-button { 
          display: inline-block; 
          background: #28a745; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 4px; 
          margin: 20px 0;
        }
        .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔒 Your Racky trial has expired</h1>
        </div>
        
        <div class="content">
          <p>Hi there,</p>
          
          <p>Your Racky free trial has expired. To regain access to your marketplace management platform, please upgrade to a paid plan.</p>
          
          <p>Your account and data are safe - everything will be restored once you upgrade.</p>
          
          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription" class="cta-button">
              Reactivate Your Account
            </a>
          </div>
          
          <p>Questions? We're here to help!</p>
          
          <p>Best regards,<br>The Racky Team</p>
        </div>
        
        <div class="footer">
          <p>This email was sent to ${user.email}</p>
          <p>Racky - Marketplace Management Platform</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const textContent = `
Your Racky trial has expired

Hi there,

Your Racky free trial has expired. To regain access to your marketplace management platform, please upgrade to a paid plan.

Your account and data are safe - everything will be restored once you upgrade.

Visit: ${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription

Best regards,
The Racky Team
  `;
  
  return await sendEmail(user.email, subject, htmlContent, textContent);
};

const sendSubscriptionCancelledNotification = async (user) => {
  const subject = 'Your Racky subscription has been cancelled';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Subscription Cancelled</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8d7da; padding: 20px; text-align: center; border-radius: 8px; border: 1px solid #f5c6cb; }
        .content { padding: 20px 0; }
        .cta-button { 
          display: inline-block; 
          background: #007bff; 
          color: white; 
          padding: 12px 24px; 
          text-decoration: none; 
          border-radius: 4px; 
          margin: 20px 0;
        }
        .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>😔 We're sorry to see you go</h1>
        </div>
        
        <div class="content">
          <p>Hi there,</p>
          
          <p>Your Racky subscription has been cancelled. We're sad to see you go!</p>
          
          <p>Your account will remain active until the end of your current billing period, after which access will be limited.</p>
          
          <p>If you change your mind, you can reactivate your subscription at any time:</p>
          
          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription" class="cta-button">
              Reactivate Subscription
            </a>
          </div>
          
          <p>We'd love to hear your feedback on how we can improve Racky for future users.</p>
          
          <p>Thank you for being part of the Racky community!</p>
          
          <p>Best regards,<br>The Racky Team</p>
        </div>
        
        <div class="footer">
          <p>This email was sent to ${user.email}</p>
          <p>Racky - Marketplace Management Platform</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const textContent = `
We're sorry to see you go

Hi there,

Your Racky subscription has been cancelled. We're sad to see you go!

Your account will remain active until the end of your current billing period, after which access will be limited.

If you change your mind, you can reactivate your subscription at any time.

Visit: ${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription

Thank you for being part of the Racky community!

Best regards,
The Racky Team
  `;
  
  return await sendEmail(user.email, subject, htmlContent, textContent);
};

module.exports = {
  sendEmail,
  sendTrialExpirationWarning,
  sendTrialExpiredNotification,
  sendSubscriptionCancelledNotification
};