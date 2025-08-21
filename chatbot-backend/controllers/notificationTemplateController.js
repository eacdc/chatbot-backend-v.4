const NotificationTemplate = require('../models/NotificationTemplate');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Create a new notification template
exports.createNotificationTemplate = async (req, res) => {
  try {
    const {
      title,
      message,
      type = 'system',
      category = 'general',
      priority = 'medium',
      targetAudience = ['all'],
      expiration_date,
      metadata = {},
      isRecurring = false,
      recurringPattern = null
    } = req.body;

    // Validate required fields
    if (!title || !message || !expiration_date) {
      return res.status(400).json({ 
        error: 'Title, message, and expiration_date are required' 
      });
    }

    // Validate expiration date
    const expirationDate = new Date(expiration_date);
    if (expirationDate <= new Date()) {
      return res.status(400).json({ 
        error: 'Expiration date must be in the future' 
      });
    }

    const notificationTemplate = new NotificationTemplate({
      title,
      message,
      type,
      category,
      priority,
      targetAudience,
      expiration_date: expirationDate,
      created_by: req.user?.userId, // If admin is creating
      metadata,
      isRecurring,
      recurringPattern
    });

    await notificationTemplate.save();

    res.status(201).json({
      message: 'Notification template created successfully',
      template: notificationTemplate
    });
  } catch (error) {
    console.error('Error creating notification template:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Get all notification templates (with filtering)
exports.getNotificationTemplates = async (req, res) => {
  try {
    const {
      status,
      type,
      category,
      priority,
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const templates = await NotificationTemplate.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('created_by', 'username email');

    const total = await NotificationTemplate.countDocuments(filter);

    res.status(200).json({
      templates,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching notification templates:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Get a specific notification template
exports.getNotificationTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;

    const template = await NotificationTemplate.findById(templateId)
      .populate('created_by', 'username email');

    if (!template) {
      return res.status(404).json({ error: 'Notification template not found' });
    }

    res.status(200).json(template);
  } catch (error) {
    console.error('Error fetching notification template:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Update a notification template
exports.updateNotificationTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const updateData = req.body;

    // Prevent updating certain fields
    delete updateData.created_at;
    delete updateData._id;

    // Validate expiration date if provided
    if (updateData.expiration_date) {
      const expirationDate = new Date(updateData.expiration_date);
      if (expirationDate <= new Date()) {
        return res.status(400).json({ 
          error: 'Expiration date must be in the future' 
        });
      }
    }

    const template = await NotificationTemplate.findByIdAndUpdate(
      templateId,
      updateData,
      { new: true, runValidators: true }
    ).populate('created_by', 'username email');

    if (!template) {
      return res.status(404).json({ error: 'Notification template not found' });
    }

    res.status(200).json({
      message: 'Notification template updated successfully',
      template
    });
  } catch (error) {
    console.error('Error updating notification template:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Delete a notification template
exports.deleteNotificationTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;

    const template = await NotificationTemplate.findByIdAndDelete(templateId);

    if (!template) {
      return res.status(404).json({ error: 'Notification template not found' });
    }

    res.status(200).json({
      message: 'Notification template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification template:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Send notification to users based on template
exports.sendNotificationFromTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { userIds, targetAudience } = req.body;

    const template = await NotificationTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Notification template not found' });
    }

    if (!template.isActive()) {
      return res.status(400).json({ error: 'Notification template is not active' });
    }

    let targetUsers = [];

    // If specific user IDs provided, use those
    if (userIds && userIds.length > 0) {
      targetUsers = await User.find({ _id: { $in: userIds } });
    } else {
      // Otherwise, use target audience criteria
      const userFilter = {};
      
      if (targetAudience && targetAudience.length > 0) {
        // Apply target audience filters
        if (targetAudience.includes('new_users')) {
          // Users created in last 7 days
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          userFilter.created_at = { $gte: weekAgo };
        }
        
        if (targetAudience.includes('active_users')) {
          // Users with recent activity (last 30 days)
          const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          // You might need to add a lastActivity field to User model
          // userFilter.lastActivity = { $gte: monthAgo };
        }
        
        if (targetAudience.includes('subscribed_users')) {
          // Users with subscriptions
          const Subscription = require('../models/Subscription');
          const subscribedUserIds = await Subscription.distinct('userId');
          userFilter._id = { $in: subscribedUserIds };
        }
      }

      targetUsers = await User.find(userFilter);
    }

    if (targetUsers.length === 0) {
      return res.status(400).json({ error: 'No target users found' });
    }

    // Create notifications for each user
    const notifications = targetUsers.map(user => ({
      userId: user._id,
      title: template.title,
      message: template.message,
      seen_status: 'no',
      created_at: new Date(),
      templateId: template._id,
      type: template.type,
      category: template.category,
      priority: template.priority
    }));

    await Notification.insertMany(notifications);

    res.status(200).json({
      message: `Notification sent to ${notifications.length} users successfully`,
      sentCount: notifications.length,
      template: {
        id: template._id,
        title: template.title,
        type: template.type,
        category: template.category
      }
    });
  } catch (error) {
    console.error('Error sending notification from template:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Get active notification templates
exports.getActiveNotificationTemplates = async (req, res) => {
  try {
    const templates = await NotificationTemplate.find({
      status: 'active',
      expiration_date: { $gt: new Date() }
    }).sort({ priority: -1, created_at: -1 });

    res.status(200).json(templates);
  } catch (error) {
    console.error('Error fetching active notification templates:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Bulk send notifications to all users
exports.sendBulkNotification = async (req, res) => {
  try {
    const { templateId } = req.params;

    const template = await NotificationTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Notification template not found' });
    }

    if (!template.isActive()) {
      return res.status(400).json({ error: 'Notification template is not active' });
    }

    // Get all users
    const users = await User.find({});
    
    if (users.length === 0) {
      return res.status(400).json({ error: 'No users found' });
    }

    // Create notifications for all users
    const notifications = users.map(user => ({
      userId: user._id,
      title: template.title,
      message: template.message,
      seen_status: 'no',
      created_at: new Date(),
      templateId: template._id,
      type: template.type,
      category: template.category,
      priority: template.priority
    }));

    await Notification.insertMany(notifications);

    res.status(200).json({
      message: `Bulk notification sent to ${notifications.length} users successfully`,
      sentCount: notifications.length,
      template: {
        id: template._id,
        title: template.title,
        type: template.type,
        category: template.category
      }
    });
  } catch (error) {
    console.error('Error sending bulk notification:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};
