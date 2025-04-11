require('dotenv').config();
const mongoose = require('mongoose');

async function listCollections() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    console.log(`Database name: ${db.databaseName}`);
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log('Collections in the database:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // If "prompts" collection exists, get its sample document
    if (collections.some(c => c.name === 'prompts')) {
      const promptsCollection = db.collection('prompts');
      const samplePrompt = await promptsCollection.findOne();
      console.log('\nSample document from prompts collection:');
      console.log(JSON.stringify(samplePrompt, null, 2));
    }
    
    // Also look at systemprompts for comparison
    if (collections.some(c => c.name === 'systemprompts')) {
      const systemPromptsCollection = db.collection('systemprompts');
      const sampleSystemPrompt = await systemPromptsCollection.findOne();
      console.log('\nSample document from systemprompts collection:');
      console.log(JSON.stringify(sampleSystemPrompt, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

listCollections(); 