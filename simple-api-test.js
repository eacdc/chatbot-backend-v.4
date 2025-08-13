const axios = require('axios');

// Configuration
const BASE_URL = 'https://chatbot-backend-v-4.onrender.com';

// Test if APIs are defined and server is responding
async function testAPIStructure() {
  console.log('🧪 Testing Scores API Structure\n');
  
  // Test 1: Server Health Check
  try {
    console.log('1. 🏥 Server Health Check...');
    const healthResponse = await axios.get(`${BASE_URL}/api/books`, { timeout: 5000 });
    console.log('✅ Server is online and responding');
  } catch (error) {
    console.log('❌ Server health check failed:', error.message);
    console.log('🔌 Server might be down or unreachable');
    return;
  }

  // Test 2: Check if authentication is required (should get 401)
  console.log('\n2. 🔐 Testing API Authentication...');
  
  const testApis = [
    '/api/scores/recent-activity/test123',
    '/api/scores/scoreboard/test123', 
    '/api/scores/progress-details/test123',
    '/api/scores/assessment-data/test123',
    '/api/scores/performance-overview/test123'
  ];

  let apiResults = [];

  for (const api of testApis) {
    try {
      console.log(`   Testing ${api}...`);
      
      const response = await axios.get(`${BASE_URL}${api}`, {
        timeout: 5000,
        validateStatus: function (status) {
          // Accept any status code so we don't throw an error
          return status < 500;
        }
      });
      
      if (response.status === 401) {
        console.log(`   ✅ ${api} - Properly requires authentication (401)`);
        apiResults.push({ api, status: 'working', code: 401 });
      } else if (response.status === 403) {
        console.log(`   ✅ ${api} - Properly handles authorization (403)`);
        apiResults.push({ api, status: 'working', code: 403 });
      } else if (response.status === 200) {
        console.log(`   ⚠️ ${api} - Responded successfully without auth (200) - Unexpected`);
        apiResults.push({ api, status: 'unexpected', code: 200 });
      } else {
        console.log(`   ⚠️ ${api} - Unexpected status: ${response.status}`);
        apiResults.push({ api, status: 'unexpected', code: response.status });
      }
      
    } catch (error) {
      if (error.response) {
        if (error.response.status === 401) {
          console.log(`   ✅ ${api} - Properly requires authentication (401)`);
          apiResults.push({ api, status: 'working', code: 401 });
        } else if (error.response.status === 404) {
          console.log(`   ❌ ${api} - Route not found (404) - API doesn't exist!`);
          apiResults.push({ api, status: 'not_found', code: 404 });
        } else {
          console.log(`   ⚠️ ${api} - Error status: ${error.response.status}`);
          apiResults.push({ api, status: 'error', code: error.response.status });
        }
      } else {
        console.log(`   ❌ ${api} - Network error: ${error.message}`);
        apiResults.push({ api, status: 'network_error', error: error.message });
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Test 3: Summary
  console.log('\n3. 📊 Test Summary:');
  console.log('=' .repeat(80));

  const workingApis = apiResults.filter(r => r.status === 'working').length;
  const notFoundApis = apiResults.filter(r => r.status === 'not_found');
  const errorApis = apiResults.filter(r => r.status === 'error' || r.status === 'network_error');

  console.log(`✅ Working APIs (require auth): ${workingApis}/${testApis.length}`);
  console.log(`❌ Not Found APIs: ${notFoundApis.length}/${testApis.length}`);
  console.log(`⚠️ Error APIs: ${errorApis.length}/${testApis.length}`);

  if (notFoundApis.length > 0) {
    console.log('\n❌ APIs Not Found (404 errors):');
    notFoundApis.forEach(api => {
      console.log(`   • ${api.api}`);
    });
  }

  if (errorApis.length > 0) {
    console.log('\n⚠️ APIs with Errors:');
    errorApis.forEach(api => {
      console.log(`   • ${api.api} - ${api.error || `Status: ${api.code}`}`);
    });
  }

  console.log('\n4. 🏁 Overall Status:');
  if (workingApis === testApis.length) {
    console.log('🎉 All APIs are properly implemented and working!');
    console.log('💡 They correctly require authentication (401 Unauthorized)');
  } else if (notFoundApis.length > 0) {
    console.log('⚠️ Some APIs are missing or have incorrect routes');
  } else {
    console.log('🤔 Some APIs have unexpected behavior - manual testing needed');
  }

  return {
    total: testApis.length,
    working: workingApis,
    notFound: notFoundApis.length,
    errors: errorApis.length
  };
}

// Test specific API endpoint structure
async function testSpecificAPI() {
  console.log('\n5. 🔍 Testing Specific API Responses...');
  
  try {
    // Try to get a more detailed error response
    const response = await axios.get(`${BASE_URL}/api/scores/progress-details/invalid-user-id`, {
      timeout: 5000,
      validateStatus: () => true // Don't throw on any status
    });
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Response type: ${typeof response.data}`);
    
    if (response.data) {
      console.log(`   Response keys:`, Object.keys(response.data));
      if (response.data.error) {
        console.log(`   Error message: ${response.data.error}`);
      }
    }
    
  } catch (error) {
    console.log(`   Request error: ${error.message}`);
  }
}

// Main execution
async function main() {
  try {
    const results = await testAPIStructure();
    await testSpecificAPI();
    
    console.log('\n' + '=' .repeat(80));
    console.log('🎯 FINAL VERDICT:');
    
    if (results.working === results.total) {
      console.log('✅ ALL APIS ARE WORKING CORRECTLY!');
      console.log('📝 Next step: Test with valid authentication tokens');
    } else {
      console.log('⚠️ SOME APIS NEED ATTENTION');
      console.log('📋 Check the detailed results above');
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
  }
}

main(); 