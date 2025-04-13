import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const historyService = {
  // Get activity history
  getActivityHistory: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.HISTORY.ACTIVITY, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get chat history
  getChatHistory: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.HISTORY.CHAT, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get file history
  getFileHistory: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.HISTORY.FILE, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get search history
  getSearchHistory: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.HISTORY.SEARCH, {
      params: { page, limit }
    });
    return response.data;
  },

  // Clear activity history
  clearActivityHistory: async () => {
    const response = await axios.delete(ENDPOINTS.HISTORY.CLEAR_ACTIVITY);
    return response.data;
  },

  // Clear chat history
  clearChatHistory: async () => {
    const response = await axios.delete(ENDPOINTS.HISTORY.CLEAR_CHAT);
    return response.data;
  },

  // Clear file history
  clearFileHistory: async () => {
    const response = await axios.delete(ENDPOINTS.HISTORY.CLEAR_FILE);
    return response.data;
  },

  // Clear search history
  clearSearchHistory: async () => {
    const response = await axios.delete(ENDPOINTS.HISTORY.CLEAR_SEARCH);
    return response.data;
  },

  // Get history details
  getHistoryDetails: async (historyId, type) => {
    const response = await axios.get(`${ENDPOINTS.HISTORY.DETAILS}/${historyId}`, {
      params: { type }
    });
    return response.data;
  },

  // Delete history item
  deleteHistoryItem: async (historyId, type) => {
    const response = await axios.delete(`${ENDPOINTS.HISTORY.DELETE}/${historyId}`, {
      data: { type }
    });
    return response.data;
  },

  // Get history statistics
  getHistoryStats: async () => {
    const response = await axios.get(ENDPOINTS.HISTORY.STATS);
    return response.data;
  },

  // Export history
  exportHistory: async (type, format = 'csv', timeRange = {}) => {
    const response = await axios.post(ENDPOINTS.HISTORY.EXPORT, {
      type,
      format,
      timeRange
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Get history by date range
  getHistoryByDateRange: async (type, startDate, endDate, page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.HISTORY.BY_DATE_RANGE, {
      params: {
        type,
        startDate,
        endDate,
        page,
        limit
      }
    });
    return response.data;
  }
};

export default historyService; 