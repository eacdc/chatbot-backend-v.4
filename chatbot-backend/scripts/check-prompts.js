require('dotenv').config();
const mongoose = require('mongoose');
const Prompt = require('../models/Prompt');

async function checkPrompts() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all prompts
    const prompts = await Prompt.find();
    console.log(`Found ${prompts.length} prompts in the database:`);
    
    if (prompts.length === 0) {
      console.log('No prompts found in the database. You need to run the seed script.');
    } else {
      prompts.forEach(prompt => {
        console.log(`\nPrompt Type: ${prompt.prompt_type}`);
        console.log(`Active: ${prompt.isActive}`);
        console.log(`Last Updated: ${prompt.lastUpdated}`);
        console.log(`Content Preview: ${prompt.prompt.substring(0, 100)}...`);
      });
    }

    // Check for specific prompt types
    const goodTextPrompt = await Prompt.findOne({ prompt_type: "goodText", isActive: true });
    console.log('\nChecking for Good Text prompt:', goodTextPrompt ? 'Found' : 'Not found');

    const qnaPrompt = await Prompt.findOne({ prompt_type: "qna", isActive: true });
    console.log('Checking for QnA prompt:', qnaPrompt ? 'Found' : 'Not found');

    const finalPrompt = await Prompt.findOne({ prompt_type: "finalPrompt", isActive: true });
    console.log('Checking for Final Prompt:', finalPrompt ? 'Found' : 'Not found');

  } catch (error) {
    console.error('Error checking prompts:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkPrompts(); 