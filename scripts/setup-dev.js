#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Utility functions
const copyFile = (src, dest) => {
  if (!fs.existsSync(src)) {
    console.error(`❌ Source file ${src} does not exist`);
    return false;
  }
  fs.copyFileSync(src, dest);
  return true;
};

const createDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Main setup function
async function setup() {
  console.log('🚀 Setting up development environment...\n');

  // Create necessary directories
  console.log('📁 Creating necessary directories...');
  createDir(path.join(__dirname, '../chatbot-backend/uploads'));
  console.log('✅ Directories created\n');

  // Copy environment files if they don't exist
  console.log('🔑 Setting up environment files...');
  const envFiles = [
    {
      example: path.join(__dirname, '../chatbot-backend/.env.example'),
      target: path.join(__dirname, '../chatbot-backend/.env')
    },
    {
      example: path.join(__dirname, '../chatbot-frontend/.env.example'),
      target: path.join(__dirname, '../chatbot-frontend/.env')
    }
  ];

  envFiles.forEach(({ example, target }) => {
    if (!fs.existsSync(target)) {
      if (copyFile(example, target)) {
        console.log(`✅ Created ${target}`);
      }
    } else {
      console.log(`ℹ️ ${target} already exists, skipping`);
    }
  });
  console.log('');

  // Install dependencies
  console.log('📦 Installing dependencies...');
  try {
    console.log('Installing backend dependencies...');
    execSync('cd ../chatbot-backend && npm install', { stdio: 'inherit' });
    
    console.log('\nInstalling frontend dependencies...');
    execSync('cd ../chatbot-frontend && npm install', { stdio: 'inherit' });
    
    console.log('\n✅ Dependencies installed successfully');
  } catch (error) {
    console.error('❌ Error installing dependencies:', error.message);
    process.exit(1);
  }

  console.log('\n🎉 Development environment setup complete!');
  console.log('\nNext steps:');
  console.log('1. Update the environment variables in .env files');
  console.log('2. Start the backend: cd chatbot-backend && npm run dev');
  console.log('3. Start the frontend: cd chatbot-frontend && npm start');
}

// Run setup
setup().catch(console.error); 