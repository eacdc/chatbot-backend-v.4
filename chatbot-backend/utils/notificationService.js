const NotificationTemplate = require('../models/NotificationTemplate');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

class NotificationService {
  // Send welcome notification to new user
  static async sendWelcomeNotification(userId) {
    try {
      const welcomeTemplate = await NotificationTemplate.findOne({
        category: 'welcome',
        status: 'active',
        expiration_date: { $gt: new Date() }
      });

      if (welcomeTemplate) {
        await this.sendNotificationFromTemplate(welcomeTemplate._id, [userId]);
        console.log(`Welcome notification sent to user ${userId}`);
      }
    } catch (error) {
      console.error('Error sending welcome notification:', error);
    }
  }

  // Send notification when user subscribes to a book
  static async sendBookSubscriptionNotification(userId, bookTitle) {
    try {
      const subscriptionTemplate = await NotificationTemplate.findOne({
        category: 'book_subscription',
        status: 'active',
        expiration_date: { $gt: new Date() }
      });

      if (subscriptionTemplate) {
        // Create custom notification with book title
        const notification = new Notification({
          userId,
          title: subscriptionTemplate.title,
          message: subscriptionTemplate.message.replace('{bookTitle}', bookTitle),
          seen_status: 'no',
          created_at: new Date(),
          templateId: subscriptionTemplate._id,
          type: subscriptionTemplate.type,
          category: subscriptionTemplate.category,
          priority: subscriptionTemplate.priority
        });

        await notification.save();
        console.log(`Book subscription notification sent to user ${userId}`);
      }
    } catch (error) {
      console.error('Error sending book subscription notification:', error);
    }
  }

  // Send achievement notification
  static async sendAchievementNotification(userId, achievementType, details = {}) {
    try {
      const achievementTemplate = await NotificationTemplate.findOne({
        category: 'score_achievement',
        status: 'active',
        expiration_date: { $gt: new Date() }
      });

      if (achievementTemplate) {
        let message = achievementTemplate.message;
        
        // Replace placeholders with actual values
        if (details.score) {
          message = message.replace('{score}', details.score);
        }
        if (details.chapterTitle) {
          message = message.replace('{chapterTitle}', details.chapterTitle);
        }

        const notification = new Notification({
          userId,
          title: achievementTemplate.title,
          message,
          seen_status: 'no',
          created_at: new Date(),
          templateId: achievementTemplate._id,
          type: achievementTemplate.type,
          category: achievementTemplate.category,
          priority: achievementTemplate.priority
        });

        await notification.save();
        console.log(`Achievement notification sent to user ${userId}`);
      }
    } catch (error) {
      console.error('Error sending achievement notification:', error);
    }
  }

  // Send notification from template to specific users
  static async sendNotificationFromTemplate(templateId, userIds) {
    try {
      const template = await NotificationTemplate.findById(templateId);
      if (!template || !template.isActive()) {
        throw new Error('Template not found or not active');
      }

      const users = await User.find({ _id: { $in: userIds } });
      if (users.length === 0) {
        throw new Error('No valid users found');
      }

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
      console.log(`Notifications sent to ${notifications.length} users from template ${templateId}`);
      
      return notifications.length;
    } catch (error) {
      console.error('Error sending notification from template:', error);
      throw error;
    }
  }

  // Send notifications to users based on target audience
  static async sendNotificationToTargetAudience(templateId, targetAudience = ['all']) {
    try {
      const template = await NotificationTemplate.findById(templateId);
      if (!template || !template.isActive()) {
        throw new Error('Template not found or not active');
      }

      let userFilter = {};

      // Apply target audience filters
      if (targetAudience.includes('new_users')) {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        userFilter.created_at = { $gte: weekAgo };
      }

      if (targetAudience.includes('subscribed_users')) {
        const subscribedUserIds = await Subscription.distinct('userId');
        if (userFilter._id) {
          userFilter._id.$in = userFilter._id.$in.filter(id => 
            subscribedUserIds.includes(id)
          );
        } else {
          userFilter._id = { $in: subscribedUserIds };
        }
      }

      if (targetAudience.includes('active_users')) {
        // Users with recent activity (you might need to add lastActivity field to User model)
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        // userFilter.lastActivity = { $gte: monthAgo };
      }

      const users = await User.find(userFilter);
      if (users.length === 0) {
        throw new Error('No users found for target audience');
      }

      return await this.sendNotificationFromTemplate(templateId, users.map(u => u._id));
    } catch (error) {
      console.error('Error sending notification to target audience:', error);
      throw error;
    }
  }

  // Process recurring notifications
  static async processRecurringNotifications() {
    try {
      const recurringTemplates = await NotificationTemplate.find({
        isRecurring: true,
        status: 'active',
        expiration_date: { $gt: new Date() }
      });

      for (const template of recurringTemplates) {
        await this.sendNotificationToTargetAudience(template._id, template.targetAudience);
      }

      console.log(`Processed ${recurringTemplates.length} recurring notifications`);
    } catch (error) {
      console.error('Error processing recurring notifications:', error);
    }
  }

  // Clean up expired notifications
  static async cleanupExpiredNotifications() {
    try {
      const result = await NotificationTemplate.updateMany(
        {
          expiration_date: { $lt: new Date() },
          status: 'active'
        },
        {
          $set: { status: 'inactive' }
        }
      );

      console.log(`Marked ${result.modifiedCount} expired notification templates as inactive`);
    } catch (error) {
      console.error('Error cleaning up expired notifications:', error);
    }
  }

  // Get notification statistics
  static async getNotificationStats() {
    try {
      const stats = {
        totalTemplates: await NotificationTemplate.countDocuments(),
        activeTemplates: await NotificationTemplate.countDocuments({
          status: 'active',
          expiration_date: { $gt: new Date() }
        }),
        expiredTemplates: await NotificationTemplate.countDocuments({
          expiration_date: { $lt: new Date() }
        }),
        totalNotifications: await Notification.countDocuments(),
        unreadNotifications: await Notification.countDocuments({ seen_status: 'no' }),
        readNotifications: await Notification.countDocuments({ seen_status: 'yes' })
      };

      return stats;
    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
