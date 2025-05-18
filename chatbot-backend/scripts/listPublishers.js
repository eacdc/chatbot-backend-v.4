const mongoose = require("mongoose");
const Book = require("../models/Book");
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

async function listPublishers() {
  try {
    console.log("Listing all publishers in the Book collection...");
    
    // Get all books
    const books = await Book.find({});
    console.log(`Found ${books.length} total books in the collection.`);
    
    // Get distinct publisher values
    const publishers = await Book.distinct('publisher');
    
    console.log("\nAll publisher names currently in use:");
    publishers.forEach((publisher, index) => {
      console.log(`${index + 1}. "${publisher}" (${books.filter(book => book.publisher === publisher).length} books)`);
    });
    
    console.log("\nPublisher stats completed!");
  } catch (error) {
    console.error("Error fetching publishers:", error);
  } finally {
    // Close the MongoDB connection
    mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
}

// Run the function
listPublishers(); 