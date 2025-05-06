import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const errorService = {
  // Report error
  reportError: async (error) => {
    const response = await axios.post(ENDPOINTS.ERROR.REPORT, error);
    return response.data;
  },

  // Get error logs
  getErrorLogs: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.ERROR.LOGS, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get error details
  getErrorDetails: async (errorId) => {
    const response = await axios.get(`${ENDPOINTS.ERROR.DETAILS}/${errorId}`);
    return response.data;
  },

  // Update error status
  updateErrorStatus: async (errorId, status) => {
    const response = await axios.put(`${ENDPOINTS.ERROR.UPDATE_STATUS}/${errorId}`, { status });
    return response.data;
  },

  // Assign error
  assignError: async (errorId, userId) => {
    const response = await axios.put(`${ENDPOINTS.ERROR.ASSIGN}/${errorId}`, { userId });
    return response.data;
  },

  // Get error statistics
  getErrorStats: async (timeRange = 'week') => {
    const response = await axios.get(ENDPOINTS.ERROR.STATS, {
      params: { timeRange }
    });
    return response.data;
  },

  // Get error trends
  getErrorTrends: async (timeRange = 'week') => {
    const response = await axios.get(ENDPOINTS.ERROR.TRENDS, {
      params: { timeRange }
    });
    return response.data;
  },

  // Get error categories
  getErrorCategories: async () => {
    const response = await axios.get(ENDPOINTS.ERROR.CATEGORIES);
    return response.data;
  },

  // Get errors by category
  getErrorsByCategory: async (category, page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.ERROR.BY_CATEGORY, {
      params: { category, page, limit }
    });
    return response.data;
  },

  // Get error resolution time
  getErrorResolutionTime: async (errorId) => {
    const response = await axios.get(`${ENDPOINTS.ERROR.RESOLUTION_TIME}/${errorId}`);
    return response.data;
  },

  // Get error impact analysis
  getErrorImpact: async (errorId) => {
    const response = await axios.get(`${ENDPOINTS.ERROR.IMPACT}/${errorId}`);
    return response.data;
  },

  // Get error dependencies
  getErrorDependencies: async (errorId) => {
    const response = await axios.get(`${ENDPOINTS.ERROR.DEPENDENCIES}/${errorId}`);
    return response.data;
  },

  // Export error logs
  exportErrorLogs: async (format = 'csv', filters = {}) => {
    const response = await axios.post(ENDPOINTS.ERROR.EXPORT, {
      format,
      filters
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Get error notifications
  getErrorNotifications: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.ERROR.NOTIFICATIONS, {
      params: { page, limit }
    });
    return response.data;
  },

  // Update error notification settings
  updateErrorNotificationSettings: async (settings) => {
    const response = await axios.put(ENDPOINTS.ERROR.NOTIFICATION_SETTINGS, settings);
    return response.data;
  }
};

export default errorService; 