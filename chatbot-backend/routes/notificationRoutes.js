const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authenticateUser = require('../middleware/authMiddleware');

// Debug middleware for notification routes
router.use((req, res, next) => {
  console.log('🔔 Notification route accessed:', req.method, req.path);
  next();
});

// Get all notifications for the authenticated user
router.get('/', authenticateUser, notificationController.getUserNotifications);

// Get first unseen notification for the authenticated user
router.get('/first-unseen', authenticateUser, notificationController.getFirstUnseenNotification);

// Mark a notification as seen
router.put('/:notificationId/mark-seen', authenticateUser, notificationController.updateNotification);

// Mark all notifications as seen
router.put('/mark-all-seen', authenticateUser, notificationController.markAllAsSeen);

// Seed test notifications (for development/testing)
router.post('/seed', authenticateUser, notificationController.seedTestNotifications);

// Get notification statistics (Admin only)
router.get('/stats', authenticateUser, notificationController.getNotificationStats);

module.exports = router; 