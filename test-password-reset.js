const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

// Test password reset functionality
async function testPasswordReset() {
    console.log('🧪 Testing Password Reset Functionality...\n');

    try {
        // Step 1: Request password reset OTP
        console.log('1️⃣ Requesting password reset OTP...');
        const forgotPasswordResponse = await axios.post(`${API_URL}/users/forgot-password`, {
            email: 'test@example.com' // Replace with a real email that exists in your database
        });
        console.log('✅ Forgot password request successful:', forgotPasswordResponse.data);

        // Step 2: Verify OTP and reset password (you'll need to manually enter the OTP)
        console.log('\n2️⃣ To complete the test, you need to:');
        console.log('   - Check the email for the OTP code');
        console.log('   - Replace the OTP and new password in the code below');
        console.log('   - Uncomment the reset password section');

        /*
        // Uncomment and modify this section with the actual OTP and new password
        const resetPasswordResponse = await axios.post(`${API_URL}/users/reset-password`, {
            email: 'test@example.com',
            otp: '123456', // Replace with actual OTP from email
            newPassword: 'newpassword123' // Replace with desired new password
        });
        console.log('✅ Password reset successful:', resetPasswordResponse.data);
        */

        // Step 3: Test resend OTP
        console.log('\n3️⃣ Testing resend OTP functionality...');
        const resendResponse = await axios.post(`${API_URL}/users/resend-password-reset-otp`, {
            email: 'test@example.com'
        });
        console.log('✅ Resend OTP successful:', resendResponse.data);

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Test invalid email
async function testInvalidEmail() {
    console.log('\n🧪 Testing Invalid Email...\n');

    try {
        const response = await axios.post(`${API_URL}/users/forgot-password`, {
            email: 'nonexistent@example.com'
        });
        console.log('Response:', response.data);
    } catch (error) {
        console.log('✅ Expected error for invalid email:', error.response?.data?.message);
    }
}

// Test invalid OTP
async function testInvalidOTP() {
    console.log('\n🧪 Testing Invalid OTP...\n');

    try {
        const response = await axios.post(`${API_URL}/users/reset-password`, {
            email: 'test@example.com',
            otp: '000000',
            newPassword: 'newpassword123'
        });
        console.log('Response:', response.data);
    } catch (error) {
        console.log('✅ Expected error for invalid OTP:', error.response?.data?.message);
    }
}

// Run tests
async function runTests() {
    console.log('🚀 Starting Password Reset Tests\n');
    
    await testPasswordReset();
    await testInvalidEmail();
    await testInvalidOTP();
    
    console.log('\n✅ All tests completed!');
}

runTests().catch(console.error);
