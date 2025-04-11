require('dotenv').config();
const { MongoClient } = require('mongodb');

async function fixEmailIndex() {
  // Use the MongoDB driver directly to avoid mongoose issues
  const mongoURI = process.env.MONGO_URI;
  
  if (!mongoURI) {
    console.error('❌ MONGO_URI environment variable not defined');
    process.exit(1);
  }
  
  const client = new MongoClient(mongoURI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    console.log(`Database name: ${db.databaseName}`);
    
    // Drop the email index
    try {
      await db.collection('users').dropIndex('email_1');
      console.log('✅ Dropped existing email index');
    } catch (error) {
      console.log('No existing email index or error:', error.message);
    }
    
    // Create new non-unique sparse index
    try {
      await db.collection('users').createIndex(
        { email: 1 }, 
        { sparse: true }
      );
      console.log('✅ Created new non-unique sparse index');
    } catch (error) {
      console.error('❌ Error creating index:', error.message);
    }
    
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await client.close();
    console.log('✅ Disconnected from MongoDB');
  }
}

fixEmailIndex().catch(console.error); 