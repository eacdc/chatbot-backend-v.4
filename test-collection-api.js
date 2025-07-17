const axios = require('axios');

// Test the new collection API endpoint
async function testCollectionAPI() {
  try {
    console.log('🧪 Testing Collection API...');
    
    // Replace this with a valid JWT token from your app
    const token = 'YOUR_JWT_TOKEN_HERE';
    
    // Test the collection summary endpoint
    const summaryResponse = await axios.get('http://localhost:5000/api/subscriptions/collection/summary', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Collection Summary API Response:', summaryResponse.data);
    
    // Test the collection endpoint with filters
    const collectionResponse = await axios.get('http://localhost:5000/api/subscriptions/collection?page=1&limit=10', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Collection API Response:', collectionResponse.data);
    
  } catch (error) {
    console.error('❌ API Test Failed:', error.response?.data || error.message);
  }
}

// Test the book search API
async function testBookSearchAPI() {
  try {
    console.log('🧪 Testing Book Search API...');
    
    // Test the book search endpoint
    const searchResponse = await axios.get('http://localhost:5000/api/books/search?q=math&page=1&limit=5');
    
    console.log('✅ Book Search API Response:', searchResponse.data);
    
  } catch (error) {
    console.error('❌ Book Search API Test Failed:', error.response?.data || error.message);
  }
}

// Run tests
console.log('Starting API tests...');
testBookSearchAPI();
// testCollectionAPI(); // Uncomment and add a valid token to test this

console.log('\n📝 Instructions:');
console.log('1. Make sure your backend server is running on port 5000');
console.log('2. To test the collection API, get a valid JWT token from your app and replace "YOUR_JWT_TOKEN_HERE"');
console.log('3. Run this script with: node test-collection-api.js'); 