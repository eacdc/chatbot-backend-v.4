// Script to fix the email index problem by dropping and recreating it
const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

// Use your MongoDB connection string 
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbotdb';

async function fixEmailIndex() {
  try {
    // Log the connection string (without sensitive parts)
    console.log(`Connecting to MongoDB at: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the User collection
    const db = mongoose.connection;
    const collection = db.collection('users');
    
    // Check if collection exists
    const collections = await db.listCollections({name: 'users'}).toArray();
    if (collections.length === 0) {
      console.error('Collection "users" not found! Available collections:');
      const allCollections = await db.listCollections().toArray();
      console.log(allCollections.map(c => c.name));
      throw new Error('Collection not found');
    }

    // Check if the index exists before trying to drop it
    const indexes = await collection.indexes();
    const emailIndex = indexes.find(index => index.name === 'email_1');
    
    if (emailIndex) {
      // Drop the problematic email index
      console.log('Dropping email index...');
      await collection.dropIndex('email_1');
      console.log('Successfully dropped email index');
    } else {
      console.log('Email index not found, no need to drop');
    }

    // Create a new sparse index (not unique)
    console.log('Creating new sparse index...');
    await collection.createIndex({ email: 1 }, { sparse: true });
    console.log('Successfully created new sparse index');

    console.log('Index repair complete!');
  } catch (error) {
    console.error('Error fixing indexes:', error);
  } finally {
    // Close connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('Disconnected from MongoDB');
    }
  }
}

fixEmailIndex(); 