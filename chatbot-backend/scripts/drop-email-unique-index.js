require("dotenv").config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require("mongoose");

async function dropEmailUniqueIndex() {
  try {
    // Get the MongoDB URI from environment variables
    const mongoURI = process.env.MONGO_URI;
    
    if (!mongoURI) {
      console.error("❌ MONGO_URI environment variable is not defined");
      console.log("Make sure you have a .env file in your backend directory with MONGO_URI defined");
      return;
    }
    
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log("✅ Connected to MongoDB");
    
    const db = mongoose.connection;
    console.log(`Database name: ${db.name}`);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));
    
    // Drop any existing email index to recreate it properly
    try {
      await db.collection('users').dropIndex('email_1');
      console.log("✅ Dropped existing email index");
    } catch (error) {
      if (error.code === 27) {
        console.log("No existing index to drop");
      } else {
        console.error("❌ Error dropping index:", error);
      }
    }
    
    // Remove email field from documents with null or empty emails (to fix existing issues)
    try {
      // Update documents with null emails
      const nullResult = await db.collection('users').updateMany(
        { email: null },
        { $unset: { email: "" } }
      );
      console.log(`✅ Removed email field from ${nullResult.modifiedCount} users with null emails`);
      
      // Update documents with empty string emails
      const emptyResult = await db.collection('users').updateMany(
        { email: "" },
        { $unset: { email: "" } }
      );
      console.log(`✅ Removed email field from ${emptyResult.modifiedCount} users with empty emails`);
    } catch (error) {
      console.error("❌ Error updating users:", error);
    }
    
    // Create a new non-unique sparse index
    try {
      await db.collection('users').createIndex(
        { email: 1 }, 
        { 
          sparse: true,
          background: true
        }
      );
      console.log("✅ Created new non-unique sparse index for email");
    } catch (error) {
      console.error("❌ Error creating index:", error);
    }
    
    console.log("✅ Email index fix completed");
  } catch (error) {
    console.error("❌ Script error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  }
}

dropEmailUniqueIndex(); 