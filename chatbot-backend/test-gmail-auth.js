const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('🔍 Gmail Authentication Test');
console.log('============================');

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log('EMAIL_USER exists:', !!process.env.EMAIL_USER);
console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
console.log('EMAIL_USER value:', process.env.EMAIL_USER ? process.env.EMAIL_USER : 'NOT SET');
console.log('EMAIL_PASS value:', process.env.EMAIL_PASS ? '***SET***' : 'NOT SET');

// Test Gmail authentication
async function testGmailAuth() {
    console.log('\n🧪 Testing Gmail Authentication...');
    
    try {
        const transporter = nodemailer.createTransporter({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Verify connection
        await transporter.verify();
        console.log('✅ Gmail authentication successful!');
        console.log('✅ Email service is properly configured');
        
        // Test sending a simple email
        console.log('\n📧 Testing email sending...');
        const testResult = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to yourself for testing
            subject: 'Test Email - OTP Service',
            text: 'This is a test email to verify OTP service is working.'
        });
        
        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', testResult.messageId);
        
    } catch (error) {
        console.log('❌ Gmail authentication failed:');
        console.log('Error:', error.message);
        
        if (error.code === 'EAUTH') {
            console.log('\n💡 Troubleshooting Tips:');
            console.log('1. Check if EMAIL_USER and EMAIL_PASS are correct');
            console.log('2. Make sure you\'re using an App Password (not regular password)');
            console.log('3. Enable 2-Factor Authentication on your Google account');
            console.log('4. Generate a new App Password for "Mail"');
        }
    }
}

// Run the test
testGmailAuth(); 