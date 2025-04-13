import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const exportService = {
  // Export chat to PDF
  exportChatToPDF: async (chatId, options = {}) => {
    const response = await axios.post(`${ENDPOINTS.EXPORT.CHAT_PDF}/${chatId}`, options, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Export chat to CSV
  exportChatToCSV: async (chatId, options = {}) => {
    const response = await axios.post(`${ENDPOINTS.EXPORT.CHAT_CSV}/${chatId}`, options, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Export multiple chats
  exportMultipleChats: async (chatIds, format = 'pdf', options = {}) => {
    const response = await axios.post(ENDPOINTS.EXPORT.MULTIPLE_CHATS, {
      chatIds,
      format,
      options
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Export user data
  exportUserData: async (format = 'json', options = {}) => {
    const response = await axios.post(ENDPOINTS.EXPORT.USER_DATA, {
      format,
      options
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Export analytics
  exportAnalytics: async (type, timeRange, format = 'csv') => {
    const response = await axios.get(ENDPOINTS.EXPORT.ANALYTICS, {
      params: { type, timeRange, format },
      responseType: 'blob'
    });
    return response.data;
  },

  // Export files
  exportFiles: async (fileIds, format = 'zip') => {
    const response = await axios.post(ENDPOINTS.EXPORT.FILES, {
      fileIds,
      format
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Get export history
  getExportHistory: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.EXPORT.HISTORY, {
      params: { page, limit }
    });
    return response.data;
  },

  // Cancel export
  cancelExport: async (exportId) => {
    const response = await axios.post(`${ENDPOINTS.EXPORT.CANCEL}/${exportId}`);
    return response.data;
  },

  // Get export status
  getExportStatus: async (exportId) => {
    const response = await axios.get(`${ENDPOINTS.EXPORT.STATUS}/${exportId}`);
    return response.data;
  },

  // Schedule export
  scheduleExport: async (exportConfig) => {
    const response = await axios.post(ENDPOINTS.EXPORT.SCHEDULE, exportConfig);
    return response.data;
  },

  // Get scheduled exports
  getScheduledExports: async () => {
    const response = await axios.get(ENDPOINTS.EXPORT.SCHEDULED);
    return response.data;
  },

  // Delete scheduled export
  deleteScheduledExport: async (scheduleId) => {
    const response = await axios.delete(`${ENDPOINTS.EXPORT.DELETE_SCHEDULED}/${scheduleId}`);
    return response.data;
  }
};

export default exportService; 