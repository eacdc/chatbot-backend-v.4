import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const notificationService = {
  // Get all notifications
  getNotifications: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.NOTIFICATIONS.GET_ALL, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get unread notifications count
  getUnreadCount: async () => {
    const response = await axios.get(ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT);
    return response.data;
  },

  // Mark notification as read
  markAsRead: async (notificationId) => {
    const response = await axios.put(`${ENDPOINTS.NOTIFICATIONS.MARK_READ}/${notificationId}`);
    return response.data;
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    const response = await axios.put(ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
    return response.data;
  },

  // Delete notification
  deleteNotification: async (notificationId) => {
    const response = await axios.delete(`${ENDPOINTS.NOTIFICATIONS.DELETE}/${notificationId}`);
    return response.data;
  },

  // Delete all notifications
  deleteAllNotifications: async () => {
    const response = await axios.delete(ENDPOINTS.NOTIFICATIONS.DELETE_ALL);
    return response.data;
  },

  // Subscribe to push notifications
  subscribeToPush: async (subscription) => {
    const response = await axios.post(ENDPOINTS.NOTIFICATIONS.SUBSCRIBE, subscription);
    return response.data;
  },

  // Unsubscribe from push notifications
  unsubscribeFromPush: async () => {
    const response = await axios.post(ENDPOINTS.NOTIFICATIONS.UNSUBSCRIBE);
    return response.data;
  },

  // Get notification preferences
  getPreferences: async () => {
    const response = await axios.get(ENDPOINTS.NOTIFICATIONS.PREFERENCES);
    return response.data;
  },

  // Update notification preferences
  updatePreferences: async (preferences) => {
    const response = await axios.put(ENDPOINTS.NOTIFICATIONS.PREFERENCES, preferences);
    return response.data;
  },

  // Get notification history
  getHistory: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.NOTIFICATIONS.HISTORY, {
      params: { page, limit }
    });
    return response.data;
  }
};

export default notificationService; 