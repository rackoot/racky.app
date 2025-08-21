// Email service for sending notifications
// In a production environment, this would integrate with services like SendGrid, AWS SES, etc.

export interface EmailResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface User {
  email: string;
  [key: string]: any;
}

export interface Plan {
  displayName: string;
  limits: {
    maxStores: number;
    maxProducts: number;
    apiCallsPerMonth: number;
  };
}

export interface Subscription {
  planId: Plan;
  [key: string]: any;
}

const sendEmail = async (to: string, subject: string, htmlContent: string, textContent: string | null = null): Promise<EmailResult> => {
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
  } catch (error: any) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

const sendSubscriptionExpirationWarning = async (user: User, subscription: Subscription, daysRemaining: number): Promise<EmailResult> => {
  const subject = `Your Racky subscription expires in ${daysRemaining} days`;
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Subscription Expiration Warning</title>
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
          <h1>⏰ Your Racky subscription expires soon!</h1>
        </div>
        
        <div class="content">
          <p>Hi there,</p>
          
          <p>Your Racky subscription expires in <strong>${daysRemaining} days</strong>. Don't lose access to your marketplace management platform!</p>
          
          <p>Your current ${subscription.planId.displayName} plan includes:</p>
          <ul>
            <li>Up to ${subscription.planId.limits.maxStores} store connections</li>
            <li>Manage up to ${subscription.planId.limits.maxProducts.toLocaleString()} products</li>
            <li>${subscription.planId.limits.apiCallsPerMonth.toLocaleString()} API calls per month</li>
            <li>Advanced marketplace integrations</li>
          </ul>
          
          <p>To continue enjoying these benefits, renew your subscription today:</p>
          
          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription" class="cta-button">
              Renew Subscription
            </a>
          </div>
          
          <p>Need help or have questions? Our team is here to assist you.</p>
          
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
Your Racky subscription expires in ${daysRemaining} days!

Hi there,

Your Racky subscription expires in ${daysRemaining} days. Don't lose access to your marketplace management platform!

Your current ${subscription.planId.displayName} plan provides powerful marketplace management features.

To continue enjoying all the benefits of Racky, renew your subscription today.

Visit: ${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription

Best regards,
The Racky Team
  `;
  
  return await sendEmail(user.email, subject, htmlContent, textContent);
};

const sendSubscriptionExpiredNotification = async (user: User, subscription: Subscription): Promise<EmailResult> => {
  const subject = 'Your Racky subscription has expired';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Subscription Expired</title>
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
          <h1>🔒 Your Racky subscription has expired</h1>
        </div>
        
        <div class="content">
          <p>Hi there,</p>
          
          <p>Your Racky subscription has expired. To regain access to your marketplace management platform, please renew your subscription.</p>
          
          <p>Your account and data are safe - everything will be restored once you renew your subscription.</p>
          
          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription" class="cta-button">
              Renew Your Subscription
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
Your Racky subscription has expired

Hi there,

Your Racky subscription has expired. To regain access to your marketplace management platform, please renew your subscription.

Your account and data are safe - everything will be restored once you renew your subscription.

Visit: ${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription

Best regards,
The Racky Team
  `;
  
  return await sendEmail(user.email, subject, htmlContent, textContent);
};

const sendSubscriptionSuspensionNotification = async (user: User, subscription: Subscription): Promise<EmailResult> => {
  const subject = 'Your Racky subscription has been suspended';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Subscription Suspended</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #fff3cd; padding: 20px; text-align: center; border-radius: 8px; border: 1px solid #ffeaa7; }
        .content { padding: 20px 0; }
        .cta-button { 
          display: inline-block; 
          background: #ffc107; 
          color: #212529; 
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
          <h1>⚠️ Your Racky subscription has been suspended</h1>
        </div>
        
        <div class="content">
          <p>Hi there,</p>
          
          <p>Your Racky subscription has been temporarily suspended. This typically occurs due to payment issues or account verification requirements.</p>
          
          <p>To restore your access, please contact our support team or update your payment information.</p>
          
          <div style="text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription" class="cta-button">
              Restore Access
            </a>
          </div>
          
          <p>If you believe this is an error, please contact our support team immediately.</p>
          
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
Your Racky subscription has been suspended

Hi there,

Your Racky subscription has been temporarily suspended. This typically occurs due to payment issues or account verification requirements.

To restore your access, please contact our support team or update your payment information.

Visit: ${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription

If you believe this is an error, please contact our support team immediately.

Best regards,
The Racky Team
  `;
  
  return await sendEmail(user.email, subject, htmlContent, textContent);
};

const sendSubscriptionCancelledNotification = async (user: User): Promise<EmailResult> => {
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

export {
  sendEmail,
  sendSubscriptionExpirationWarning,
  sendSubscriptionExpiredNotification,
  sendSubscriptionSuspensionNotification,
  sendSubscriptionCancelledNotification
};