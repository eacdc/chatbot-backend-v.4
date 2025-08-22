#!/bin/bash

echo "Testing Static Content Endpoints"
echo "================================="
echo ""

BASE_URL="http://localhost:5000"

# Test Privacy Policy
echo "1. Testing Privacy Policy endpoint..."
curl -s -X GET "$BASE_URL/api/static/privacy-policy" | jq '.data.title, .data.lastUpdated' 2>/dev/null || echo "Failed to get privacy policy"
echo ""

# Test FAQ
echo "2. Testing FAQ endpoint..."
curl -s -X GET "$BASE_URL/api/static/faq" | jq '.data.title, .data.lastUpdated' 2>/dev/null || echo "Failed to get FAQ"
echo ""

# Test Terms of Service
echo "3. Testing Terms of Service endpoint..."
curl -s -X GET "$BASE_URL/api/static/terms-of-service" | jq '.data.title, .data.lastUpdated' 2>/dev/null || echo "Failed to get terms of service"
echo ""

# Test API Documentation
echo "4. Testing API Documentation endpoint..."
curl -s -X GET "$BASE_URL/api/static/api-docs" | jq '.data.title, .data.version' 2>/dev/null || echo "Failed to get API docs"
echo ""

echo "Testing completed!"
