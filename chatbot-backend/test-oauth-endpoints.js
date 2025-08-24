const axios = require('axios');

const BASE_URL = 'https://chatbot-backend-v-4.onrender.com';

async function testOAuthEndpoints() {
  console.log('🧪 Testing OAuth Endpoints...\n');

  try {
    // Test 1: Check available providers
    console.log('1. Testing available providers...');
    const providersResponse = await axios.get(`${BASE_URL}/api/social-auth/available-providers`);
    console.log('✅ Available Providers:', providersResponse.data);
    console.log('');

    // Test 2: Test Google OAuth initiation
    console.log('2. Testing Google OAuth initiation...');
    try {
      const googleResponse = await axios.get(`${BASE_URL}/api/social-auth/google`, {
        maxRedirects: 0,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept redirects
        }
      });
      console.log('✅ Google OAuth redirect URL:', googleResponse.headers.location);
    } catch (error) {
      if (error.response && error.response.status === 302) {
        console.log('✅ Google OAuth redirect URL:', error.response.headers.location);
      } else {
        console.log('❌ Google OAuth error:', error.message);
      }
    }
    console.log('');

    // Test 3: Test Facebook OAuth (should fail)
    console.log('3. Testing Facebook OAuth (should fail)...');
    try {
      await axios.get(`${BASE_URL}/api/social-auth/facebook`);
    } catch (error) {
      if (error.response && error.response.status === 503) {
        console.log('✅ Facebook OAuth correctly disabled:', error.response.data.message);
      } else {
        console.log('❌ Unexpected Facebook OAuth response:', error.message);
      }
    }
    console.log('');

    console.log('🎉 OAuth endpoint testing completed!');
    console.log('📝 Next steps:');
    console.log('1. Copy the Google OAuth URL from step 2');
    console.log('2. Open it in your browser');
    console.log('3. Complete Google authentication');
    console.log('4. Extract JWT token from final redirect URL');
    console.log('5. Use token to test authenticated endpoints');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the tests
testOAuthEndpoints();
