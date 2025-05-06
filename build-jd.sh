#!/bin/bash

# Navigate to JD Editions frontend directory
cd chatbot-frontend-jd

# Install dependencies
npm install

# Build the application
npm run build

# Ensure proper permissions for all files
find build -type f -exec chmod 644 {} \;
find build -type d -exec chmod 755 {} \;

# Copy necessary files to build directory
cp public/_redirects build/
cp public/404.html build/
cp public/manifest.json build/
cp public/robots.txt build/

# Create necessary directories if they don't exist
mkdir -p build/static/css
mkdir -p build/static/js
mkdir -p build/static/media

# Add a comment to index.html for verification without overwriting
sed -i '1s/^/<!-- This is a static file served by Render. -->\n/' build/index.html

# Add spa=true file for Render
echo 'true' > build/spa

# Log completion
echo "JD Editions frontend build completed successfully!" 