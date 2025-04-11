// Script to fix email index issue on production database
const { MongoClient } = require('mongodb');
// No dotenv - we'll hardcode the connection string for one-time use

async function fixProductionEmailIndex() {
  // IMPORTANT: Replace this with your actual production MongoDB connection string
  const PRODUCTION_MONGO_URI = "mongodb+srv://ea:Jul020796@chatbot-cluster.mapqyp9.mongodb.net/?retryWrites=true&w=majority&appName=chatbot-cluster";
  
  if (!PRODUCTION_MONGO_URI || PRODUCTION_MONGO_URI.includes('your-username')) {
    console.error('❌ ERROR: You need to replace the MongoDB connection string with your actual production connection string');
    process.exit(1);
  }
  
  const client = new MongoClient(PRODUCTION_MONGO_URI);
  
  try {
    console.log('Connecting to PRODUCTION MongoDB...');
    await client.connect();
    console.log('✅ Connected to PRODUCTION MongoDB');
    
    const db = client.db();
    console.log(`Production database name: ${db.databaseName}`);
    
    // List collections to verify we're in the right database
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    if (!collections.some(c => c.name === 'users')) {
      console.error('❌ WARNING: No "users" collection found! Double-check your connection string.');
      return;
    }
    
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
      console.log('✅ Created new non-unique sparse index for email field');
    } catch (error) {
      console.error('❌ Error creating index:', error.message);
    }
    
    // Fix existing null email documents
    try {
      const result = await db.collection('users').updateMany(
        { email: null },
        { $unset: { email: "" } }
      );
      console.log(`✅ Removed email field from ${result.modifiedCount} users with null emails`);
    } catch (error) {
      console.error('❌ Error updating users:', error.message);
    }
    
    console.log('✅ Production database fix completed!');
  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await client.close();
    console.log('✅ Disconnected from production MongoDB');
  }
}

// Run the function
fixProductionEmailIndex()
  .then(() => console.log('Script execution completed'))
  .catch(err => console.error('Script failed:', err)); 