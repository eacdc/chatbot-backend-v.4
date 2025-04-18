const Notification = require('../models/Notification');

// Get all notifications for a user
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const notifications = await Notification.find({ userId })
      .sort({ created_at: -1 }) // Newest first
      .limit(50); // Limit to last 50 notifications
    
    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Get first unseen notification for a user
exports.getFirstUnseenNotification = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const notification = await Notification.findOne({ 
      userId, 
      seen_status: 'no' 
    }).sort({ created_at: 1 }); // Oldest unseen first
    
    if (!notification) {
      return res.status(404).json({ message: 'No unseen notifications' });
    }
    
    res.status(200).json(notification);
  } catch (error) {
    console.error('Error fetching unseen notification:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Mark a notification as seen
exports.updateNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;
    
    // Find notification and ensure it belongs to the requesting user
    const notification = await Notification.findOne({ 
      _id: notificationId,
      userId
    });
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    // Update the seen status
    notification.seen_status = 'yes';
    await notification.save();
    
    res.status(200).json({ message: 'Notification marked as seen', notification });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Seed initial test notifications for a user
exports.seedNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Sample test notifications
    const notifications = [
      {
        userId,
        title: "Welcome to BookChat!",
        message: "Thank you for joining our platform. Start exploring books and engage with AI-powered discussions about your favorite chapters.",
        seen_status: "no",
        created_at: new Date()
      },
      {
        userId,
        title: "New Book Added",
        message: "A new book 'The Future of AI' has been added to our collections. Check it out and add it to your library!",
        seen_status: "no",
        created_at: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
      },
      {
        userId,
        title: "Limited Time Offer",
        message: "For the next 7 days, get access to premium content for free! Explore our exclusive collection now.",
        seen_status: "no",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
      }
    ];
    
    await Notification.insertMany(notifications);
    
    res.status(201).json({ 
      message: `Successfully added ${notifications.length} test notifications for user`,
      notifications
    });
  } catch (error) {
    console.error('Error seeding notifications:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Helper function to create notifications from other controllers
exports.createSystemNotification = async (userId, title, message) => {
  try {
    const notification = new Notification({
      userId,
      title,
      message,
      seen_status: 'no',
      created_at: new Date()
    });
    
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating system notification:', error);
    return null;
  }
};

// Seed test notifications for testing
exports.seedTestNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Define test notifications
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
    
    // Insert new notifications
    await Notification.insertMany(notifications);
    
    res.status(200).json({ message: 'Test notifications added successfully', count: notifications.length });
  } catch (error) {
    console.error('Error seeding test notifications:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Mark all notifications as seen for a user
exports.markAllAsSeen = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await Notification.updateMany(
      { userId, seen_status: 'no' },
      { $set: { seen_status: 'yes' } }
    );
    
    res.status(200).json({ 
      message: 'All notifications marked as seen', 
      count: result.modifiedCount 
    });
  } catch (error) {
    console.error('Error marking all notifications as seen:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
}; 