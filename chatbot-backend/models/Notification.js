const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  seen_status: {
    type: String,
    enum: ['yes', 'no'],
    default: 'no'
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  // Reference to notification template (optional)
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NotificationTemplate',
    required: false
  },
  // Additional fields for better categorization
  type: {
    type: String,
    enum: ['system', 'promotional', 'achievement', 'update', 'announcement'],
    default: 'system'
  },
  category: {
    type: String,
    enum: ['welcome', 'book_subscription', 'chapter_completion', 'score_achievement', 'new_book', 'offer', 'maintenance', 'general'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  }
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 