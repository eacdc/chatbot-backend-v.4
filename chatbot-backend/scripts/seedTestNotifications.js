require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');

// Get connection string from environment or use default
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://eacdcadmin:g79y1TFdLGlMJ5Pd@cluster0.avpmcyh.mongodb.net/chatbotdb?retryWrites=true&w=majority';

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('Connected to MongoDB');
  
  // Replace with your actual user ID
  // If you don't know the user ID, you can use the first user in the database
  let userId;
  
  try {
    // Try to get a user from the database if no specific ID is provided
    if (!process.argv[2]) {
      const User = require('../models/User');
      const user = await User.findOne();
      if (!user) {
        console.error('No users found in the database');
        process.exit(1);
      }
      userId = user._id;
      console.log(`Using user ID: ${userId}`);
    } else {
      userId = process.argv[2];
      console.log(`Using provided user ID: ${userId}`);
    }
    
    // Create test notifications
    const notifications = [
      {
        userId,
        title: 'Welcome to BookChat!',
        message: 'Thank you for joining our platform. Start exploring books and engage with AI-powered discussions about your favorite chapters.',
        seen_status: 'no',
        created_at: new Date()
      },
      {
        userId,
        title: 'New Book Added',
        message: 'A new book "The Future of AI" has been added to our collections. Check it out and add it to your library!',
        seen_status: 'no',
        created_at: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
      },
      {
        userId,
        title: 'Limited Time Offer',
        message: 'For the next 7 days, get access to premium content for free! Explore our exclusive collection now.',
        seen_status: 'no',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
      },
      {
        userId,
        title: 'Chapter Summary Available',
        message: 'The summary for your recently viewed chapter is now available. Click to view.',
        seen_status: 'no',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 48) // 2 days ago
      }
    ];
    
    // First delete any existing notifications for this user
    await Notification.deleteMany({ userId });
    console.log(`Deleted existing notifications for user ${userId}`);
    
    // Insert new notifications
    await Notification.insertMany(notifications);
    console.log(`Successfully added ${notifications.length} test notifications for user ${userId}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding test notifications:', error);
    process.exit(1);
  }
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
}); 