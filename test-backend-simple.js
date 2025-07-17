const http = require('http');
const https = require('https');
const { URL } = require('url');

// Simple HTTP request function
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// Test backend endpoints
async function testBackendEndpoints() {
  console.log('🚀 Testing Backend Collection API Endpoints...');
  console.log('='.repeat(50));
  
  const baseUrl = 'http://localhost:5000';
  
  // Test 1: Check if server is running
  console.log('\n1. Testing Server Connection...');
  try {
    const response = await makeRequest(`${baseUrl}/api/books`);
    console.log(`✅ Server is running - Status: ${response.status}`);
  } catch (error) {
    console.log(`❌ Server is not accessible: ${error.message}`);
    console.log('📝 Make sure to run: cd chatbot-backend && npm start');
    return;
  }
  
  // Test 2: Test book search endpoint
  console.log('\n2. Testing Book Search API...');
  try {
    const response = await makeRequest(`${baseUrl}/api/books/search?q=math&limit=3`);
    console.log(`✅ Book Search API - Status: ${response.status}`);
    if (response.data.success) {
      console.log(`📚 Found ${response.data.data.books.length} books`);
      console.log(`📄 Sample book:`, response.data.data.books[0]?.title || 'No books found');
    } else {
      console.log(`❌ Search failed:`, response.data.error);
    }
  } catch (error) {
    console.log(`❌ Book Search API error: ${error.message}`);
  }
  
  // Test 3: Test book search suggestions
  console.log('\n3. Testing Search Suggestions API...');
  try {
    const response = await makeRequest(`${baseUrl}/api/books/search-suggestions?q=math&limit=3`);
    console.log(`✅ Search Suggestions API - Status: ${response.status}`);
    if (response.data.success) {
      console.log(`💡 Found ${response.data.data.suggestions.length} suggestions`);
    } else {
      console.log(`❌ Suggestions failed:`, response.data.error);
    }
  } catch (error) {
    console.log(`❌ Search Suggestions API error: ${error.message}`);
  }
  
  // Test 4: Test collection endpoints (will fail without auth)
  console.log('\n4. Testing Collection API (without auth)...');
  try {
    const response = await makeRequest(`${baseUrl}/api/subscriptions/collection`);
    console.log(`📊 Collection API - Status: ${response.status}`);
    if (response.status === 401) {
      console.log(`✅ Authentication required (expected)`);
    } else {
      console.log(`❌ Unexpected response:`, response.data);
    }
  } catch (error) {
    console.log(`❌ Collection API error: ${error.message}`);
  }
  
  // Test 5: Test collection summary (will fail without auth)
  console.log('\n5. Testing Collection Summary API (without auth)...');
  try {
    const response = await makeRequest(`${baseUrl}/api/subscriptions/collection/summary`);
    console.log(`📈 Collection Summary API - Status: ${response.status}`);
    if (response.status === 401) {
      console.log(`✅ Authentication required (expected)`);
    } else {
      console.log(`❌ Unexpected response:`, response.data);
    }
  } catch (error) {
    console.log(`❌ Collection Summary API error: ${error.message}`);
  }
  
  console.log('\n✅ Backend API Tests Completed!');
  console.log('\n📝 Next Steps:');
  console.log('1. If server is not running: cd chatbot-backend && npm start');
  console.log('2. For authenticated endpoints, you need a valid JWT token');
  console.log('3. Check backend console for detailed logs');
}

// Run tests
testBackendEndpoints().catch(console.error); 