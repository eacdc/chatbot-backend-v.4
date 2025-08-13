const { sendOTPEmail } = require('./services/emailService');
require('dotenv').config();

console.log('🔍 Email Service Configuration Test');
console.log('=====================================');

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log('EMAIL_USER exists:', !!process.env.EMAIL_USER);
console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
console.log('EMAIL_USER value:', process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 3)}***` : 'NOT SET');
console.log('EMAIL_PASS value:', process.env.EMAIL_PASS ? '***SET***' : 'NOT SET');

// Test email sending
async function testEmailService() {
    console.log('\n🧪 Testing Email Service...');
    
    try {
        const testEmail = 'test@example.com';
        const testOTP = '123456';
        const testName = 'Test User';
        
        console.log(`Sending test email to: ${testEmail}`);
        console.log(`Test OTP: ${testOTP}`);
        
        const result = await sendOTPEmail(testEmail, testOTP, testName);
        
        if (result.success) {
            console.log('✅ Email service is working correctly!');
            console.log('Message ID:', result.messageId);
        } else {
            console.log('❌ Email service failed:');
            console.log('Error:', result.error);
        }
    } catch (error) {
        console.log('❌ Test failed with exception:');
        console.log('Error:', error.message);
    }
}

// Run the test
testEmailService(); 