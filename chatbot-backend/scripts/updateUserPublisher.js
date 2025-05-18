const mongoose = require("mongoose");
const User = require("../models/User");
require('dotenv').config();

// Use the MongoDB URI 
const MONGO_URI = "mongodb+srv://ea:Jul020796@chatbot-cluster.mapqyp9.mongodb.net/?retryWrites=true&w=majority&appName=chatbot-cluster";

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

async function updateUserPublisher() {
  try {
    console.log("Starting user publisher update process...");
    
    // First list the current distinct publisher values in the User collection
    const beforePublishers = await User.distinct('publisher');
    console.log("Current publisher values in User collection:", beforePublishers);
    
    // Count users with "JD EDITIONS" publisher
    const beforeCount = await User.countDocuments({ publisher: "JD EDITIONS" });
    console.log(`Found ${beforeCount} users with publisher "JD EDITIONS"`);
    
    // Update users with publisher "JD EDITIONS" to "JD"
    const updateResult = await User.updateMany(
      { publisher: "JD EDITIONS" },
      { $set: { publisher: "JD" } }
    );
    
    console.log(`Updated ${updateResult.modifiedCount} users from "JD EDITIONS" to "JD"`);
    
    // Verify the changes
    const afterPublishers = await User.distinct('publisher');
    console.log("Updated publisher values in User collection:", afterPublishers);
    
    // Check if JD exists now
    const afterJDCount = await User.countDocuments({ publisher: "JD" });
    console.log(`Now there are ${afterJDCount} users with publisher "JD"`);
    
    console.log("User publisher update completed successfully!");
  } catch (error) {
    console.error("Error updating user publisher:", error);
  } finally {
    // Close the MongoDB connection
    mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
}

// Run the update function
updateUserPublisher(); 