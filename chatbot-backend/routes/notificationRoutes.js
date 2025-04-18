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

// Seed test notifications (for development only)
router.post('/seed', authenticateUser, notificationController.seedNotifications);

module.exports = router; 