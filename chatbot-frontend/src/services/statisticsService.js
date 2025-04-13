import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const statisticsService = {
  // Get overall statistics
  getOverallStats: async (timeRange = 'week') => {
    const response = await axios.get(ENDPOINTS.STATISTICS.OVERALL, {
      params: { timeRange }
    });
    return response.data;
  },

  // Get user statistics
  getUserStats: async (timeRange = 'week') => {
    const response = await axios.get(ENDPOINTS.STATISTICS.USER, {
      params: { timeRange }
    });
    return response.data;
  },

  // Get chat statistics
  getChatStats: async (timeRange = 'week') => {
    const response = await axios.get(ENDPOINTS.STATISTICS.CHAT, {
      params: { timeRange }
    });
    return response.data;
  },

  // Get file statistics
  getFileStats: async (timeRange = 'week') => {
    const response = await axios.get(ENDPOINTS.STATISTICS.FILE, {
      params: { timeRange }
    });
    return response.data;
  },

  // Get search statistics
  getSearchStats: async (timeRange = 'week') => {
    const response = await axios.get(ENDPOINTS.STATISTICS.SEARCH, {
      params: { timeRange }
    });
    return response.data;
  },

  // Get performance statistics
  getPerformanceStats: async (timeRange = 'week') => {
    const response = await axios.get(ENDPOINTS.STATISTICS.PERFORMANCE, {
      params: { timeRange }
    });
    return response.data;
  },

  // Get usage statistics
  getUsageStats: async (timeRange = 'week') => {
    const response = await axios.get(ENDPOINTS.STATISTICS.USAGE, {
      params: { timeRange }
    });
    return response.data;
  },

  // Get error statistics
  getErrorStats: async (timeRange = 'week') => {
    const response = await axios.get(ENDPOINTS.STATISTICS.ERROR, {
      params: { timeRange }
    });
    return response.data;
  },

  // Get custom statistics report
  getCustomReport: async (metrics, timeRange, groupBy) => {
    const response = await axios.post(ENDPOINTS.STATISTICS.CUSTOM_REPORT, {
      metrics,
      timeRange,
      groupBy
    });
    return response.data;
  },

  // Export statistics
  exportStats: async (type, timeRange, format = 'csv') => {
    const response = await axios.get(ENDPOINTS.STATISTICS.EXPORT, {
      params: { type, timeRange, format },
      responseType: 'blob'
    });
    return response.data;
  },

  // Get real-time statistics
  getRealTimeStats: async () => {
    const response = await axios.get(ENDPOINTS.STATISTICS.REAL_TIME);
    return response.data;
  },

  // Get statistics dashboard data
  getDashboardData: async () => {
    const response = await axios.get(ENDPOINTS.STATISTICS.DASHBOARD);
    return response.data;
  },

  // Get statistics by date range
  getStatsByDateRange: async (type, startDate, endDate) => {
    const response = await axios.get(ENDPOINTS.STATISTICS.BY_DATE_RANGE, {
      params: { type, startDate, endDate }
    });
    return response.data;
  },

  // Get statistics comparison
  getStatsComparison: async (type, timeRanges) => {
    const response = await axios.post(ENDPOINTS.STATISTICS.COMPARISON, {
      type,
      timeRanges
    });
    return response.data;
  }
};

export default statisticsService; 