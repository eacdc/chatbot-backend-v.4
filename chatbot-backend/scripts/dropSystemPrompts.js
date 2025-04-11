require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require("mongoose");

console.log("This script will drop the old 'systemprompts' collection which is no longer needed");
console.log("The application now uses the 'prompts' collection instead");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("✅ MongoDB Connected Successfully");
    
    try {
      // Drop the SystemPrompt collection
      await mongoose.connection.db.dropCollection("systemprompts");
      console.log("✅ Old 'systemprompts' collection dropped successfully");
      console.log("✅ The application now uses 'prompts' collection instead");
      
    } catch (error) {
      if (error.code === 26) {
        console.log("Collection doesn't exist, nothing to drop");
      } else {
        console.error("❌ Error dropping collection:", error);
      }
    } finally {
      // Disconnect from MongoDB
      mongoose.disconnect();
      console.log("✅ Database disconnected.");
    }
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }); 