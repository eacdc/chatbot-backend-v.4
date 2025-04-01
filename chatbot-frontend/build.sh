#!/bin/bash

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

# Ensure index.html has the correct content type
echo "<!-- This is a static file. It will be served from the root directory. -->" > build/index.html 