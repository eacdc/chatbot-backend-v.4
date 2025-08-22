const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testEndpoints() {
  console.log('Testing Static Content Endpoints...\n');

  const endpoints = [
    '/api/static/privacy-policy',
    '/api/static/faq',
    '/api/static/terms-of-service',
    '/api/static/api-docs'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint}...`);
      const response = await axios.get(`${BASE_URL}${endpoint}`);
      
      if (response.status === 200 && response.data.success) {
        console.log(`✅ ${endpoint} - SUCCESS`);
        console.log(`   Title: ${response.data.data.title}`);
        console.log(`   Last Updated: ${response.data.data.lastUpdated || 'N/A'}`);
      } else {
        console.log(`❌ ${endpoint} - FAILED`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Response:`, response.data);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - ERROR`);
      console.log(`   Error: ${error.message}`);
    }
    console.log('');
  }

  console.log('Testing completed!');
}

// Run the test
testEndpoints().catch(console.error);
