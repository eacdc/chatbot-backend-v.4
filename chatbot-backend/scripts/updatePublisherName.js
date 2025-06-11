const mongoose = require("mongoose");
const Book = require("../models/Book");
const Subscription = require("../models/Subscription");
require('dotenv').config();

// Use a direct MongoDB URI from production-fix.js script
const MONGO_URI = "mongodb+srv://ea:Jul020796@chatbot-cluster.mapqyp9.mongodb.net/?retryWrites=true&w=majority&appName=chatbot-cluster";

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

async function updatePublisherName() {
  try {
    console.log("Starting publisher name update process...");
    
    // First update the Book collection
    const bookUpdateResult = await Book.updateMany(
      { publisher: "JD EDITIONS" },
      { $set: { publisher: "JD" } }
    );
    
    console.log(`Updated ${bookUpdateResult.modifiedCount} books from "JD EDITIONS" to "JD"`);
    
    // Then update the Subscription collection to maintain consistency
    const subscriptionUpdateResult = await Subscription.updateMany(
      { publisher: "JD EDITIONS" },
      { $set: { publisher: "JD" } }
    );
    
    console.log(`Updated ${subscriptionUpdateResult.modifiedCount} subscriptions from "JD EDITIONS" to "JD"`);
    
    console.log("Publisher name update completed successfully!");
  } catch (error) {
    console.error("Error updating publisher name:", error);
  } finally {
    // Close the MongoDB connection
    mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
}

// Run the update function
updatePublisherName(); 