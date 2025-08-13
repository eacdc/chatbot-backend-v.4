const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://ea:Jul020796@chatbot-cluster.mapqyp9.mongodb.net/?retryWrites=true&w=majority&appName=chatbot-cluster";

// Collections to clear
const collectionsToDelete = [
  'books',
  'chapters',
  'chats',
  'scores',
  'qnalists',
  'subscriptions'
];

async function clearCollections() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MONGO_URI:', MONGO_URI);
    
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB!');
    console.log('Database Name:', mongoose.connection.name);
    
    const db = mongoose.connection.db;

    console.log('\n🧹 Starting collection clearing...\n');

    let totalDeleted = 0;
    
    // Clear collections directly
    for (const collectionName of collectionsToDelete) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        console.log(`📊 ${collectionName}: Found ${count} documents`);
        
        if (count > 0) {
          const result = await collection.deleteMany({});
          console.log(`🗑️ ${collectionName}: Deleted ${result.deletedCount} documents`);
          totalDeleted += result.deletedCount;
        } else {
          console.log(`✨ ${collectionName}: Already empty`);
        }
      } catch (error) {
        console.error(`❌ Error clearing ${collectionName}:`, error.message);
      }
    }

    console.log(`\n🎉 Collection clearing completed! Total deleted: ${totalDeleted} documents`);
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearCollections(); 