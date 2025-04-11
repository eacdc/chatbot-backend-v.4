require("dotenv").config();
const mongoose = require("mongoose");

async function updateEmailIndex() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log("✅ Connected to MongoDB");
    
    // Get a reference to the User collection
    const User = mongoose.model("User", new mongoose.Schema({
      email: { type: String, required: false, sparse: true, unique: true }
    }));
    
    const db = mongoose.connection;
    
    // Drop any existing email index
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
    
    // Create a new sparse index on email
    try {
      await db.collection('users').createIndex(
        { email: 1 }, 
        { 
          sparse: true, 
          unique: true,
          background: true
        }
      );
      console.log("✅ Created new sparse email index");
    } catch (error) {
      console.error("❌ Error creating new index:", error);
    }
    
    // Update any user documents with empty email strings
    try {
      const result = await db.collection('users').updateMany(
        { email: "" },
        { $unset: { email: "" } }
      );
      console.log(`✅ Updated ${result.modifiedCount} users with empty emails`);
    } catch (error) {
      console.error("❌ Error updating users:", error);
    }
    
    console.log("✅ Email index update completed");
  } catch (error) {
    console.error("❌ Script error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  }
}

updateEmailIndex(); 