import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const loggingService = {
  // Get application logs
  getApplicationLogs: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.LOGGING.APPLICATION, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get error logs
  getErrorLogs: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.LOGGING.ERROR, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get access logs
  getAccessLogs: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.LOGGING.ACCESS, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get security logs
  getSecurityLogs: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.LOGGING.SECURITY, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get audit logs
  getAuditLogs: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.LOGGING.AUDIT, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get log details
  getLogDetails: async (logId) => {
    const response = await axios.get(`${ENDPOINTS.LOGGING.DETAILS}/${logId}`);
    return response.data;
  },

  // Search logs
  searchLogs: async (query, filters = {}, page = 1, limit = 10) => {
    const response = await axios.post(ENDPOINTS.LOGGING.SEARCH, {
      query,
      filters,
      page,
      limit
    });
    return response.data;
  },

  // Get log statistics
  getLogStats: async (timeRange = 'day') => {
    const response = await axios.get(ENDPOINTS.LOGGING.STATS, {
      params: { timeRange }
    });
    return response.data;
  },

  // Export logs
  exportLogs: async (type, format = 'csv', filters = {}) => {
    const response = await axios.post(ENDPOINTS.LOGGING.EXPORT, {
      type,
      format,
      filters
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Get log levels
  getLogLevels: async () => {
    const response = await axios.get(ENDPOINTS.LOGGING.LEVELS);
    return response.data;
  },

  // Update log level
  updateLogLevel: async (logger, level) => {
    const response = await axios.put(ENDPOINTS.LOGGING.UPDATE_LEVEL, {
      logger,
      level
    });
    return response.data;
  },

  // Get log retention settings
  getLogRetention: async () => {
    const response = await axios.get(ENDPOINTS.LOGGING.RETENTION);
    return response.data;
  },

  // Update log retention settings
  updateLogRetention: async (settings) => {
    const response = await axios.put(ENDPOINTS.LOGGING.RETENTION, settings);
    return response.data;
  },

  // Get log patterns
  getLogPatterns: async () => {
    const response = await axios.get(ENDPOINTS.LOGGING.PATTERNS);
    return response.data;
  },

  // Add log pattern
  addLogPattern: async (pattern) => {
    const response = await axios.post(ENDPOINTS.LOGGING.PATTERNS, pattern);
    return response.data;
  },

  // Delete log pattern
  deleteLogPattern: async (patternId) => {
    const response = await axios.delete(`${ENDPOINTS.LOGGING.PATTERNS}/${patternId}`);
    return response.data;
  },

  // Get real-time logs
  getRealTimeLogs: async (type) => {
    const response = await axios.get(ENDPOINTS.LOGGING.REAL_TIME, {
      params: { type }
    });
    return response.data;
  }
};

export default loggingService; 