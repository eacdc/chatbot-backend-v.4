#!/bin/bash

# Navigate to JD Editions frontend directory
cd chatbot-frontend-jd

# Install socket.io-client and other dependencies
npm install --save socket.io-client@4.7.2
npm install

# Build the application
npm run build

# Ensure proper permissions for all files
find build -type f -exec chmod 644 {} \;
find build -type d -exec chmod 755 {} \;

# Copy necessary files to build directory if they exist (with error handling)
[ -f public/_redirects ] && cp public/_redirects build/ || echo "No _redirects file found"
[ -f public/404.html ] && cp public/404.html build/ || echo "No 404.html file found"
[ -f public/manifest.json ] && cp public/manifest.json build/ || echo "No manifest.json file found"
[ -f public/robots.txt ] && cp public/robots.txt build/ || echo "No robots.txt file found"

# Create necessary directories if they don't exist
mkdir -p build/static/css
mkdir -p build/static/js
mkdir -p build/static/media

# Add a comment to index.html for verification without overwriting (only if index.html exists)
if [ -f build/index.html ]; then
  sed -i '1s/^/<!-- This is a static file served by Render. -->\n/' build/index.html
else
  echo "Warning: index.html not found in build directory"
fi

# Add spa=true file for Render
echo 'true' > build/spa

# Log completion
echo "JD Editions frontend build completed successfully!" 