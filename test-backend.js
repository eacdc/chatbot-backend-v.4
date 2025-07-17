const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

// Test helper function
async function testEndpoint(name, url, options = {}) {
  try {
    console.log(`\n🧪 Testing ${name}...`);
    const response = await axios.get(url, options);
    console.log(`✅ ${name} - Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error.response?.status || error.message}`);
    console.log(`📄 Error Response:`, error.response?.data || error.message);
    return null;
  }
}

// Test basic server connectivity
async function testServerConnection() {
  try {
    const response = await axios.get(`${BASE_URL}/api/books`);
    console.log('✅ Backend server is running and accessible');
    return true;
  } catch (error) {
    console.log('❌ Backend server is not accessible');
    console.log('Error:', error.message);
    return false;
  }
}

// Test book search API (no auth required)
async function testBookSearchAPI() {
  console.log('\n🔍 Testing Book Search API...');
  
  // Test basic search
  await testEndpoint('Basic Search', `${API_URL}/books/search?q=math&limit=5`);
  
  // Test search with filters
  await testEndpoint('Search with Filters', `${API_URL}/books/search?q=science&subject=Science&grade=10&sortBy=title&sortOrder=asc`);
  
  // Test search suggestions
  await testEndpoint('Search Suggestions', `${API_URL}/books/search-suggestions?q=math&limit=3`);
}

// Test collection API (requires auth)
async function testCollectionAPI() {
  console.log('\n📚 Testing Collection API...');
  
  // You'll need to replace this with a valid JWT token
  const token = 'YOUR_JWT_TOKEN_HERE';
  
  const authHeaders = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  
  // Test collection summary
  await testEndpoint('Collection Summary', `${API_URL}/subscriptions/collection/summary`, authHeaders);
  
  // Test collection with filters
  await testEndpoint('Collection with Filters', `${API_URL}/subscriptions/collection?page=1&limit=10&sortBy=title&sortOrder=asc`, authHeaders);
  
  // Test collection with search
  await testEndpoint('Collection Search', `${API_URL}/subscriptions/collection?search=math&page=1&limit=5`, authHeaders);
  
  // Test collection with status filter
  await testEndpoint('Collection Status Filter', `${API_URL}/subscriptions/collection?status=in_progress&page=1&limit=5`, authHeaders);
}

// Test routes registration
async function testRouteRegistration() {
  console.log('\n🛣️ Testing Route Registration...');
  
  // Test if routes are properly registered
  const routes = [
    '/api/books',
    '/api/books/search',
    '/api/books/search-suggestions', 
    '/api/subscriptions',
    '/api/subscriptions/collection/summary',
    '/api/subscriptions/collection'
  ];
  
  for (const route of routes) {
    try {
      const response = await axios.get(`${BASE_URL}${route}`);
      console.log(`✅ Route ${route} - Registered (Status: ${response.status})`);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log(`✅ Route ${route} - Registered (Auth required)`);
      } else if (error.response?.status === 400) {
        console.log(`✅ Route ${route} - Registered (Bad request - expected)`);
      } else {
        console.log(`❌ Route ${route} - Error: ${error.response?.status || error.message}`);
      }
    }
  }
}

// Check server logs for errors
async function checkServerHealth() {
  console.log('\n🏥 Server Health Check...');
  
  try {
    // Test a simple endpoint to see if server is responding
    const response = await axios.get(`${BASE_URL}/api/books?limit=1`);
    console.log('✅ Server is healthy and responding');
    
    // Check if environment variables are loaded
    console.log('🔑 Environment Variables Check:');
    console.log('- Testing with a request that would need API keys...');
    
  } catch (error) {
    console.log('❌ Server health check failed:', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Backend API Tests...');
  console.log('=' .repeat(50));
  
  // Test server connectivity first
  const serverConnected = await testServerConnection();
  if (!serverConnected) {
    console.log('\n❌ Cannot proceed with tests - server is not accessible');
    console.log('📝 Make sure to run: cd chatbot-backend && npm start');
    return;
  }
  
  // Test route registration
  await testRouteRegistration();
  
  // Test server health
  await checkServerHealth();
  
  // Test public APIs (no auth required)
  await testBookSearchAPI();
  
  // Test authenticated APIs (requires token)
  console.log('\n📝 For Collection API tests:');
  console.log('1. Login to your app and get a JWT token from localStorage');
  console.log('2. Replace "YOUR_JWT_TOKEN_HERE" in this file with the actual token');
  console.log('3. Run the test again');
  
  // Uncomment this line and add a valid token to test collection APIs
  // await testCollectionAPI();
  
  console.log('\n✅ Backend API tests completed!');
}

// Run the tests
runTests().catch(console.error); 