require('dotenv').config();
const mongoose = require('mongoose');
const SystemPrompt = require('../models/SystemPrompt');
const Prompt = require('../models/Prompt');

async function migrateSystemPrompts() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Get all system prompts
    const systemPrompts = await SystemPrompt.find();
    console.log(`Found ${systemPrompts.length} system prompts to migrate`);

    // Migrate each system prompt to the new Prompt model
    for (const systemPrompt of systemPrompts) {
      console.log(`Migrating prompt: ${systemPrompt.prompt_type}`);
      
      // Check if prompt already exists in Prompt collection
      const existingPrompt = await Prompt.findOne({ prompt_type: systemPrompt.prompt_type });
      
      if (existingPrompt) {
        console.log(`- Prompt already exists in Prompt collection, updating...`);
        existingPrompt.prompt = systemPrompt.prompt;
        existingPrompt.lastUpdated = systemPrompt.lastUpdated || new Date();
        await existingPrompt.save();
        console.log(`- Updated existing prompt: ${systemPrompt.prompt_type}`);
      } else {
        // Create new prompt
        const newPrompt = new Prompt({
          prompt_type: systemPrompt.prompt_type,
          prompt: systemPrompt.prompt,
          isActive: true,
          lastUpdated: systemPrompt.lastUpdated || new Date()
        });
        
        await newPrompt.save();
        console.log(`- Created new prompt: ${systemPrompt.prompt_type}`);
      }
    }

    console.log('✅ Migration completed successfully');
    console.log('You can now use the prompts collection instead of systemprompts');
  } catch (error) {
    console.error('Error migrating system prompts:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrateSystemPrompts(); 