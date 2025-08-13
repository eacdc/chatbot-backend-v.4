const axios = require('axios');
const readline = require('readline');

// Configuration
const BASE_URL = 'https://chatbot-backend-v-4.onrender.com';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt for input
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Test helper function
async function testAPI(name, url, token) {
  try {
    console.log(`\n🧪 Testing ${name}...`);
    console.log(`📡 URL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log(`✅ ${name} - Status: ${response.status}`);
    console.log(`📊 Response data keys:`, Object.keys(response.data));
    
    // Show sample data structure
    if (response.data.success !== undefined) {
      console.log(`🔍 Success: ${response.data.success}`);
    }
    
    if (response.data.data) {
      console.log(`📋 Data structure:`, Object.keys(response.data.data));
    } else if (Array.isArray(response.data)) {
      console.log(`📋 Array length: ${response.data.length}`);
    }
    
    return { success: true, status: response.status, data: response.data };
    
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error.response?.status || error.code || error.message}`);
    
    if (error.response) {
      console.log(`📄 Error Response:`, error.response.data || 'No error details');
    } else if (error.code === 'ECONNREFUSED') {
      console.log(`🔌 Connection refused - Server might be down`);
    } else if (error.code === 'ENOTFOUND') {
      console.log(`🌐 DNS error - Check if URL is correct`);
    } else if (error.code === 'TIMEOUT' || error.code === 'ETIMEDOUT') {
      console.log(`⏰ Request timeout - Server is slow to respond`);
    }
    
    return { success: false, error: error.message };
  }
}

// Main test function
async function testScoresAPIs() {
  console.log('🚀 Starting Scores API Testing\n');
  console.log('You need a valid JWT token and userId to test these APIs.');
  console.log('You can get these by logging into your application and checking the browser console.\n');
  
  try {
    // Get token and userId from user
    const token = await askQuestion('Enter your JWT token: ');
    const userId = await askQuestion('Enter your userId: ');
    
    if (!token || !userId) {
      console.log('❌ Token and userId are required!');
      process.exit(1);
    }
    
    console.log('\n📡 Testing all Scores APIs...\n');
    console.log('=' .repeat(60));
    
    // Define all APIs to test
    const apis = [
      {
        name: 'Recent Activity API',
        url: `${BASE_URL}/api/scores/recent-activity/${userId}`
      },
      {
        name: 'Scoreboard API', 
        url: `${BASE_URL}/api/scores/scoreboard/${userId}`
      },
      {
        name: 'Progress Details API',
        url: `${BASE_URL}/api/scores/progress-details/${userId}`
      },
      {
        name: 'Assessment Data API',
        url: `${BASE_URL}/api/scores/assessment-data/${userId}`
      },
      {
        name: 'Performance Overview API',
        url: `${BASE_URL}/api/scores/performance-overview/${userId}`
      }
    ];
    
    const results = [];
    
    // Test each API
    for (const api of apis) {
      const result = await testAPI(api.name, api.url, token);
      results.push({
        name: api.name,
        url: api.url,
        ...result
      });
      
      // Add delay between requests to be nice to the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Print summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('=' .repeat(60));
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Successful APIs: ${successful}/${results.length}`);
    console.log(`❌ Failed APIs: ${failed}/${results.length}\n`);
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.success ? `Status ${result.status}` : result.error}`);
    });
    
    // Additional API tests with query parameters
    console.log('\n🔍 Testing APIs with Query Parameters...\n');
    
    const queryTests = [
      {
        name: 'Recent Activity (Last 7 days, Limit 10)',
        url: `${BASE_URL}/api/scores/recent-activity/${userId}?days=7&limit=10`
      },
      {
        name: 'Assessment Data (With Chapter Filter)',
        url: `${BASE_URL}/api/scores/assessment-data/${userId}?timeframe=week`
      },
      {
        name: 'Performance Overview (Monthly Period)',
        url: `${BASE_URL}/api/scores/performance-overview/${userId}?period=month`
      }
    ];
    
    for (const test of queryTests) {
      await testAPI(test.name, test.url, token);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error) {
    console.error('💥 Test execution error:', error.message);
  } finally {
    rl.close();
  }
}

// Health check function
async function healthCheck() {
  try {
    console.log('🏥 Checking server health...');
    const response = await axios.get(`${BASE_URL}/api/books`, {
      timeout: 5000
    });
    
    if (response.status === 200) {
      console.log('✅ Server is online and responding');
      return true;
    } else {
      console.log('⚠️ Server responded but status is not 200');
      return false;
    }
  } catch (error) {
    console.log('❌ Server health check failed:', error.message);
    return false;
  }
}

// Function to test authentication endpoint
async function testAuth() {
  console.log('\n🔐 Authentication Test Available');
  console.log('If you want to test authentication, you can:');
  console.log('1. Go to https://www.testyourlearning.com/login');
  console.log('2. Login with your credentials');
  console.log('3. Open browser developer tools (F12)');
  console.log('4. Go to Console tab');
  console.log('5. Type: localStorage.getItem("token")');
  console.log('6. Type: localStorage.getItem("userId")');
  console.log('7. Copy the values and use them in this test\n');
}

// Run the tests
async function main() {
  console.log('🧪 Scores API Tester\n');
  
  // First check if server is online
  const serverOnline = await healthCheck();
  
  if (!serverOnline) {
    console.log('\n❌ Server is not responding. Please check:');
    console.log('1. Is the backend deployed and running?');
    console.log('2. Is the URL correct?');
    console.log('3. Are there any network issues?');
    process.exit(1);
  }
  
  // Show authentication help
  await testAuth();
  
  // Run the main tests
  await testScoresAPIs();
  
  console.log('\n🎉 Testing completed!');
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Test interrupted by user');
  rl.close();
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('💥 Unexpected error:', error);
  rl.close();
  process.exit(1);
}); 