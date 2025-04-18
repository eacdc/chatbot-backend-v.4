const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authenticateUser = require('../middleware/authMiddleware');

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

module.exports = router; 