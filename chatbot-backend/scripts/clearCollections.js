/**
 * Database Collection Clear Script
 * 
 * This script will delete all documents from the specified collections:
 * - Book
 * - Chapter
 * - Chat
 * - Score (replaced by QnALists)
 * - QnALists
 * - Subscription
 * 
 * CAUTION: This will permanently delete all data in these collections!
 * Use only in development or when you specifically need to reset the database.
 * 
 * Usage: node scripts/clearCollections.js [--confirm]
 * The --confirm flag is required to actually perform the deletions.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('../models/Book');
const Chapter = require('../models/Chapter');
const Chat = require('../models/Chat');
const Score = require('../models/Score');
const QnALists = require('../models/QnALists');
const Subscription = require('../models/Subscription');

// Check for confirmation flag
const args = process.argv.slice(2);
const hasConfirmation = args.includes('--confirm');

if (!hasConfirmation) {
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: You must include the --confirm flag to execute this script.');
  console.log('This is a safety measure to prevent accidental data deletion.');
  console.log('Usage: node scripts/clearCollections.js --confirm');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI)
  .then(() => console.log('\x1b[32m%s\x1b[0m', 'MongoDB connected'))
  .catch(err => {
    console.error('\x1b[31m%s\x1b[0m', 'MongoDB connection error:', err);
    process.exit(1);
  });

async function clearCollections() {
  // Display warning
  console.log('\n\x1b[33m%s\x1b[0m', '⚠️  WARNING: You are about to delete ALL documents from multiple collections!');
  console.log('\x1b[33m%s\x1b[0m', 'This action cannot be undone.');
  console.log('\n\x1b[36m%s\x1b[0m', 'You have 5 seconds to cancel (Ctrl+C) before deletion begins...');
  
  // Wait for 5 seconds to allow cancellation
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\n\x1b[33m%s\x1b[0m', 'Beginning deletion process...\n');
  
  // Track results
  const results = {};
  
  try {
    // Delete all Book documents
    const bookResult = await Book.deleteMany({});
    results.books = bookResult.deletedCount;
    console.log(`Deleted ${bookResult.deletedCount} books`);
    
    // Delete all Chapter documents
    const chapterResult = await Chapter.deleteMany({});
    results.chapters = chapterResult.deletedCount;
    console.log(`Deleted ${chapterResult.deletedCount} chapters`);
    
    // Delete all Chat documents
    const chatResult = await Chat.deleteMany({});
    results.chats = chatResult.deletedCount;
    console.log(`Deleted ${chatResult.deletedCount} chat records`);
    
    // Delete all Score documents (old schema)
    const scoreResult = await Score.deleteMany({});
    results.scores = scoreResult.deletedCount;
    console.log(`Deleted ${scoreResult.deletedCount} score records`);
    
    // Delete all QnALists documents (new schema)
    const qnaResult = await QnALists.deleteMany({});
    results.qnaLists = qnaResult.deletedCount;
    console.log(`Deleted ${qnaResult.deletedCount} QnA records`);
    
    // Delete all Subscription documents
    const subscriptionResult = await Subscription.deleteMany({});
    results.subscriptions = subscriptionResult.deletedCount;
    console.log(`Deleted ${subscriptionResult.deletedCount} subscription records`);
    
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Error during deletion:', error);
    mongoose.connection.close();
    process.exit(1);
  }
  
  // Print summary
  console.log('\n\x1b[32m%s\x1b[0m', 'Deletion Summary:');
  console.log('------------------------------');
  console.log(`Books: ${results.books}`);
  console.log(`Chapters: ${results.chapters}`);
  console.log(`Chats: ${results.chats}`);
  console.log(`Scores: ${results.scores}`);
  console.log(`QnA Records: ${results.qnaLists}`);
  console.log(`Subscriptions: ${results.subscriptions}`);
  console.log('------------------------------');
  console.log(`Total: ${Object.values(results).reduce((sum, count) => sum + count, 0)} documents deleted`);
  console.log('\n\x1b[32m%s\x1b[0m', 'Collections cleared successfully!');
  
  // Close connection
  mongoose.connection.close();
  console.log('MongoDB connection closed');
}

// Run the function
clearCollections(); 