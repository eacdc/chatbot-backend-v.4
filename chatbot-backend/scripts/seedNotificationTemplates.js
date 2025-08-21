require('dotenv').config();
const mongoose = require('mongoose');
const NotificationTemplate = require('../models/NotificationTemplate');

// Use hardcoded MongoDB URI for direct script execution
const MONGO_URI = 'mongodb+srv://eacdcadmin:g79y1TFdLGlMJ5Pd@cluster0.avpmcyh.mongodb.net/chatbotdb?retryWrites=true&w=majority';

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected for notification template seeding'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

const createNotificationTemplates = async () => {
  try {
    console.log('Creating notification templates...');
    
    // Sample notification templates
    const templates = [
      {
        title: "Welcome to BookChat!",
        message: "Thank you for joining our platform. Start exploring books and engage with AI-powered discussions about your favorite chapters.",
        type: "system",
        category: "welcome",
        priority: "medium",
        targetAudience: ["new_users"],
        expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        metadata: {
          description: "Welcome message for new users",
          tags: ["welcome", "onboarding"]
        }
      },
      {
        title: "New Book Added to Collection",
        message: "A new book has been added to our collections. Check it out and add it to your library!",
        type: "announcement",
        category: "new_book",
        priority: "medium",
        targetAudience: ["subscribed_users", "active_users"],
        expiration_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        metadata: {
          description: "Announcement for new book additions",
          tags: ["new_book", "announcement"]
        }
      },
      {
        title: "Limited Time Offer - Premium Access",
        message: "For the next 7 days, get access to premium content for free! Explore our exclusive collection now.",
        type: "promotional",
        category: "offer",
        priority: "high",
        targetAudience: ["all"],
        expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        metadata: {
          description: "Limited time promotional offer",
          tags: ["promotion", "premium", "offer"]
        }
      },
      {
        title: "Chapter Summary Available",
        message: "The summary for your recently viewed chapter is now available. Click to view.",
        type: "system",
        category: "chapter_completion",
        priority: "low",
        targetAudience: ["active_users"],
        expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        metadata: {
          description: "Notification for available chapter summaries",
          tags: ["chapter", "summary"]
        }
      },
      {
        title: "System Maintenance Notice",
        message: "We will be performing scheduled maintenance on Sunday from 2:00 AM to 4:00 AM. During this time, the platform may be temporarily unavailable.",
        type: "update",
        category: "maintenance",
        priority: "high",
        targetAudience: ["all"],
        expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        metadata: {
          description: "System maintenance notification",
          tags: ["maintenance", "system"]
        }
      },
      {
        title: "Achievement Unlocked - Perfect Score!",
        message: "Congratulations! You've achieved a perfect score on your recent chapter quiz. Keep up the excellent work!",
        type: "achievement",
        category: "score_achievement",
        priority: "medium",
        targetAudience: ["active_users"],
        expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        metadata: {
          description: "Achievement notification for perfect scores",
          tags: ["achievement", "score", "motivation"]
        }
      },
      {
        title: "Weekly Learning Reminder",
        message: "Don't forget to continue your learning journey! You have unfinished chapters waiting for you.",
        type: "system",
        category: "general",
        priority: "low",
        targetAudience: ["subscribed_users"],
        expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        isRecurring: true,
        recurringPattern: "weekly",
        metadata: {
          description: "Weekly reminder for learning progress",
          tags: ["reminder", "weekly", "motivation"]
        }
      }
    ];
    
    // Clear existing templates (optional - comment out if you want to keep existing ones)
    // await NotificationTemplate.deleteMany({});
    
    // Insert new templates
    const createdTemplates = await NotificationTemplate.insertMany(templates);
    
    console.log(`Successfully created ${createdTemplates.length} notification templates`);
    
    // Display created templates
    createdTemplates.forEach((template, index) => {
      console.log(`${index + 1}. ${template.title} (${template.type}/${template.category})`);
      console.log(`   Expires: ${template.expiration_date.toDateString()}`);
      console.log(`   Status: ${template.status}`);
      console.log('---');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating notification templates:', error);
    process.exit(1);
  }
};

createNotificationTemplates();
