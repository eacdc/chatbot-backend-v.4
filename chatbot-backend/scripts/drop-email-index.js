// Simple script to drop the email index
const mongoose = require('mongoose');
require('dotenv').config();

// Get the database URL from your application config or env variables
const MONGO_URI = process.env.MONGO_URI;

console.log("Using MongoDB URI:", MONGO_URI ? "Found in .env" : "Not found in .env");
if (!MONGO_URI) {
  console.error("MONGO_URI environment variable not found. Please set it in your .env file");
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(async () => {
    try {
      console.log('Connected to MongoDB');
      
      // Get database name being used
      const dbName = mongoose.connection.db.databaseName;
      console.log(`Database name: ${dbName}`);
      
      // Get list of all collections
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('Collections:', collections.map(c => c.name));
      
      // Find the users collection (may have a different name)
      const userCollection = collections.find(c => 
        c.name === 'users' || c.name === 'Users' || c.name.toLowerCase().includes('user')
      );
      
      if (userCollection) {
        const collectionName = userCollection.name;
        console.log(`Found user collection: ${collectionName}`);
        
        // Get the collection
        const collection = mongoose.connection.db.collection(collectionName);
        
        // List all indexes on that collection
        const indexes = await collection.indexes();
        console.log('Current indexes:', indexes);
        
        // Find email index
        const emailIndex = indexes.find(idx => 
          idx.name === 'email_1' || 
          (idx.key && idx.key.email !== undefined)
        );
        
        if (emailIndex) {
          console.log(`Found email index: ${emailIndex.name}`);
          
          // Drop the index
          await collection.dropIndex(emailIndex.name);
          console.log(`Successfully dropped index: ${emailIndex.name}`);
        } else {
          console.log('No email index found');
        }
      } else {
        console.log('User collection not found');
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      mongoose.connection.close();
      console.log('Disconnected from MongoDB');
    }
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
  }); 