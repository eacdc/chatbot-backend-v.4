#!/bin/bash

# Install dependencies
npm install

# Build the application
npm run build

# Ensure proper permissions
chmod 644 build/static/css/*
chmod 644 build/static/js/*
chmod 644 build/static/media/*
chmod 644 build/*.html
chmod 644 build/*.json
chmod 644 build/*.txt
chmod 644 build/_redirects

# Copy necessary files to build directory
cp public/_redirects build/
cp public/404.html build/ 