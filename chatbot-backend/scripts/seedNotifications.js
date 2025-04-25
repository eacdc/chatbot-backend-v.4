require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Use hardcoded MongoDB URI for direct script execution
const MONGO_URI = 'mongodb+srv://eacdcadmin:g79y1TFdLGlMJ5Pd@cluster0.avpmcyh.mongodb.net/chatbotdb?retryWrites=true&w=majority';

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected for notification seeding'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

const createTestNotifications = async () => {
  try {
    // Find a user to add notifications to
    // You can replace this with a specific user ID if needed
    const user = await User.findOne();
    
    if (!user) {
      console.error('No users found in the database');
      process.exit(1);
    }
    
    console.log(`Creating test notifications for user: ${user.email} (${user._id})`);
    
    // Sample notifications
    const notifications = [
      {
        userId: user._id,
        title: "Welcome to BookChat!",
        message: "Thank you for joining our platform. Start exploring books and engage with AI-powered discussions about your favorite chapters.",
        seen_status: "no",
        created_at: new Date()
      },
      {
        userId: user._id,
        title: "New Book Added",
        message: "A new book 'The Future of AI' has been added to our collections. Check it out and add it to your library!",
        seen_status: "no",
        created_at: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
      },
      {
        userId: user._id,
        title: "Chapter Summary Available",
        message: "The summary for your recently viewed chapter 'Introduction to Machine Learning' is now available. Click to view.",
        seen_status: "no",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
      },
      {
        userId: user._id,
        title: "Limited Time Offer",
        message: "For the next 7 days, get access to premium content for free! Explore our exclusive collection now.",
        seen_status: "no",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
      }
    ];
    
    // Delete any existing notifications for this user to avoid duplicates
    await Notification.deleteMany({ userId: user._id });
    
    // Insert new notifications
    await Notification.insertMany(notifications);
    
    console.log(`Successfully created ${notifications.length} test notifications`);
    process.exit(0);
  } catch (error) {
    console.error('Error creating test notifications:', error);
    process.exit(1);
  }
};

createTestNotifications(); 