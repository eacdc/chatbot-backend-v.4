const express = require('express');
const router = express.Router();
const notificationTemplateController = require('../controllers/notificationTemplateController');
const authenticateUser = require('../middleware/authMiddleware');
const authenticateAdmin = require('../middleware/adminAuthMiddleware');

// Debug middleware for notification template routes
router.use((req, res, next) => {
  console.log('📋 Notification Template route accessed:', req.method, req.path);
  next();
});

// Create a new notification template (Admin only)
router.post('/', authenticateAdmin, notificationTemplateController.createNotificationTemplate);

// Get all notification templates (with filtering and pagination)
router.get('/', authenticateAdmin, notificationTemplateController.getNotificationTemplates);

// Get active notification templates (for sending notifications)
router.get('/active', authenticateAdmin, notificationTemplateController.getActiveNotificationTemplates);

// Get a specific notification template
router.get('/:templateId', authenticateAdmin, notificationTemplateController.getNotificationTemplate);

// Update a notification template
router.put('/:templateId', authenticateAdmin, notificationTemplateController.updateNotificationTemplate);

// Delete a notification template
router.delete('/:templateId', authenticateAdmin, notificationTemplateController.deleteNotificationTemplate);

// Send notification to specific users based on template
router.post('/:templateId/send', authenticateAdmin, notificationTemplateController.sendNotificationFromTemplate);

// Send notification to all users (bulk)
router.post('/:templateId/send-bulk', authenticateAdmin, notificationTemplateController.sendBulkNotification);

module.exports = router;
