const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema({
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
  },
  targetAudience: {
    type: [String],
    enum: ['all', 'subscribed_users', 'new_users', 'active_users', 'premium_users'],
    default: ['all']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'active'
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  expiration_date: {
    type: Date,
    required: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    default: null
  }
});

// Index for efficient queries
notificationTemplateSchema.index({ status: 1, expiration_date: 1 });
notificationTemplateSchema.index({ type: 1, category: 1 });
notificationTemplateSchema.index({ targetAudience: 1 });

// Virtual for checking if notification is expired
notificationTemplateSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiration_date;
});

// Method to check if notification should be active
notificationTemplateSchema.methods.isActive = function() {
  return this.status === 'active' && new Date() <= this.expiration_date;
};

// Pre-save middleware to update status based on expiration
notificationTemplateSchema.pre('save', function(next) {
  if (this.expiration_date && new Date() > this.expiration_date) {
    this.status = 'inactive';
  }
  next();
});

const NotificationTemplate = mongoose.model('NotificationTemplate', notificationTemplateSchema);

module.exports = NotificationTemplate;
