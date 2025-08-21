const nodemailer = require('nodemailer');
require('dotenv').config();

// Debug: Check if environment variables are loaded
console.log('🔍 Email Environment Variables Check:');
console.log('EMAIL_USER exists:', !!process.env.EMAIL_USER);
console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
console.log('EMAIL_USER value:', process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 3)}***` : 'NOT SET');

// Create transporter (using Gmail as example - you can change this)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your email
        pass: process.env.EMAIL_PASS  // Your app password
    }
});

// You can also use other email services like:
// For Outlook/Hotmail:
// const transporter = nodemailer.createTransport({
//     service: 'hotmail',
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//     }
// });

// For custom SMTP:
// const transporter = nodemailer.createTransport({
//     host: 'smtp.your-email-provider.com',
//     port: 587,
//     secure: false,
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//     }
// });

const sendOTPEmail = async (email, otp, fullname) => {
    try {
        // Validate environment variables before attempting to send
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('❌ Email credentials not configured:');
            console.error('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
            console.error('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');
            return { 
                success: false, 
                error: 'Email service not configured. Please set EMAIL_USER and EMAIL_PASS environment variables.' 
            };
        }
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Email Verification - Your OTP Code',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Email Verification</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; margin: 20px 0; text-align: center; border-radius: 10px; }
                        .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; margin: 10px 0; }
                        .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
                        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📧 Email Verification</h1>
                            <p>Complete your registration</p>
                        </div>
                        <div class="content">
                            <h2>Hello ${fullname || 'User'}!</h2>
                            <p>Thank you for registering with us. To complete your account setup, please verify your email address using the OTP code below:</p>
                            
                            <div class="otp-box">
                                <p><strong>Your OTP Code:</strong></p>
                                <div class="otp-code">${otp}</div>
                                <p><small>Enter this code to verify your email address</small></p>
                            </div>
                            
                            <div class="warning">
                                <strong>⚠️ Important:</strong>
                                <ul>
                                    <li>This OTP is valid for <strong>10 minutes</strong> only</li>
                                    <li>Do not share this code with anyone</li>
                                    <li>If you didn't request this, please ignore this email</li>
                                </ul>
                            </div>
                            
                            <p>If you're having trouble with the verification process, please contact our support team.</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated email. Please do not reply to this message.</p>
                            <p>&copy; ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('✅ OTP email sent successfully:', result.messageId);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('❌ Error sending OTP email:', error);
        return { success: false, error: error.message };
    }
};

const sendPasswordResetOTPEmail = async (email, otp, fullname) => {
    try {
        // Validate environment variables before attempting to send
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.error('❌ Email credentials not configured:');
            console.error('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
            console.error('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');
            return { 
                success: false, 
                error: 'Email service not configured. Please set EMAIL_USER and EMAIL_PASS environment variables.' 
            };
        }
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset - Your OTP Code',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Password Reset</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .otp-box { background: white; border: 2px dashed #dc3545; padding: 20px; margin: 20px 0; text-align: center; border-radius: 10px; }
                        .otp-code { font-size: 32px; font-weight: bold; color: #dc3545; letter-spacing: 5px; margin: 10px 0; }
                        .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
                        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🔐 Password Reset</h1>
                            <p>Reset your account password</p>
                        </div>
                        <div class="content">
                            <h2>Hello ${fullname || 'User'}!</h2>
                            <p>We received a request to reset your password. To proceed with the password reset, please use the OTP code below:</p>
                            
                            <div class="otp-box">
                                <p><strong>Your OTP Code:</strong></p>
                                <div class="otp-code">${otp}</div>
                                <p><small>Enter this code to reset your password</small></p>
                            </div>
                            
                            <div class="warning">
                                <strong>⚠️ Important:</strong>
                                <ul>
                                    <li>This OTP is valid for <strong>10 minutes</strong> only</li>
                                    <li>Do not share this code with anyone</li>
                                    <li>If you didn't request this password reset, please ignore this email</li>
                                    <li>Your current password will remain unchanged if you don't use this OTP</li>
                                </ul>
                            </div>
                            
                            <p>If you're having trouble with the password reset process, please contact our support team.</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated email. Please do not reply to this message.</p>
                            <p>&copy; ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Password reset OTP email sent successfully:', result.messageId);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('❌ Error sending password reset OTP email:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendOTPEmail,
    sendPasswordResetOTPEmail
}; 