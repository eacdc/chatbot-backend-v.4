require("dotenv").config();
const mongoose = require("mongoose");

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
      console.log("✅ SystemPrompt collection dropped successfully");
      
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