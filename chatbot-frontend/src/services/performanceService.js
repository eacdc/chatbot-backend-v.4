import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const performanceService = {
  /**
   * Get overall performance metrics
   * @param {string} timeRange - Time range for metrics (default: 'week')
   * @returns {Promise<object>} Performance metrics data
   */
  getOverallMetrics: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.PERFORMANCE.OVERALL}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get API performance metrics
   * @param {string} timeRange - Time range for metrics (default: 'week')
   * @returns {Promise<object>} API performance metrics data
   */
  getAPIMetrics: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.PERFORMANCE.API}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get database performance metrics
   * @param {string} timeRange - Time range for metrics (default: 'week')
   * @returns {Promise<object>} Database performance metrics data
   */
  getDatabaseMetrics: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.PERFORMANCE.DATABASE}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get frontend performance metrics
   * @param {string} timeRange - Time range for metrics (default: 'week')
   * @returns {Promise<object>} Frontend performance metrics data
   */
  getFrontendMetrics: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.PERFORMANCE.FRONTEND}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get backend performance metrics
   * @param {string} timeRange - Time range for metrics (default: 'week')
   * @returns {Promise<object>} Backend performance metrics data
   */
  getBackendMetrics: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.PERFORMANCE.BACKEND}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get resource usage metrics
   * @param {string} timeRange - Time range for metrics (default: 'week')
   * @returns {Promise<object>} Resource usage metrics data
   */
  getResourceMetrics: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.PERFORMANCE.RESOURCES}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get performance alerts
   * @param {number} page - Page number for pagination (default: 1)
   * @param {number} limit - Results per page (default: 10)
   * @returns {Promise<object>} Performance alerts data
   */
  getPerformanceAlerts: (page = 1, limit = 10) => {
    return axios.get(`${ENDPOINTS.PERFORMANCE.ALERTS}?page=${page}&limit=${limit}`)
      .then(response => response.data);
  },

  /**
   * Get performance trends
   * @param {string} metric - Metric type to analyze
   * @param {string} timeRange - Time range for trends (default: 'week')
   * @returns {Promise<object>} Performance trends data
   */
  getPerformanceTrends: (metric, timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.PERFORMANCE.TRENDS}?metric=${metric}&timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get performance bottlenecks
   * @param {string} timeRange - Time range for analysis (default: 'week')
   * @returns {Promise<object>} Performance bottlenecks data
   */
  getBottlenecks: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.PERFORMANCE.BOTTLENECKS}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get performance recommendations
   * @returns {Promise<object>} Performance recommendations data
   */
  getRecommendations: () => {
    return axios.get(ENDPOINTS.PERFORMANCE.RECOMMENDATIONS)
      .then(response => response.data);
  },

  /**
   * Get real-time performance metrics
   * @returns {Promise<object>} Real-time performance metrics data
   */
  getRealTimeMetrics: () => {
    return axios.get(ENDPOINTS.PERFORMANCE.REALTIME)
      .then(response => response.data);
  },

  /**
   * Get performance comparison data
   * @param {object} params - Comparison parameters
   * @returns {Promise<object>} Performance comparison data
   */
  getPerformanceComparison: (params) => {
    return axios.post(ENDPOINTS.PERFORMANCE.COMPARISON, params)
      .then(response => response.data);
  },

  /**
   * Export performance metrics
   * @param {string} format - Export format (default: 'csv')
   * @param {string} type - Metrics type
   * @param {string} timeRange - Time range for metrics (default: 'week')
   * @returns {Promise<Blob>} Exported data blob
   */
  exportMetrics: (format = 'csv', type, timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.PERFORMANCE.EXPORT}?format=${format}&type=${type}&timeRange=${timeRange}`, {
      responseType: 'blob'
    }).then(response => response.data);
  },

  /**
   * Get performance dashboard data
   * @returns {Promise<object>} Dashboard data
   */
  getDashboardData: () => {
    return axios.get(ENDPOINTS.PERFORMANCE.DASHBOARD)
      .then(response => response.data);
  },

  /**
   * Update performance alert settings
   * @param {object} settings - Alert settings
   * @returns {Promise<object>} Updated settings
   */
  updateAlertSettings: (settings) => {
    return axios.put(ENDPOINTS.PERFORMANCE.ALERT_SETTINGS, settings)
      .then(response => response.data);
  },

  /**
   * Get performance alert settings
   * @returns {Promise<object>} Alert settings
   */
  getAlertSettings: () => {
    return axios.get(ENDPOINTS.PERFORMANCE.ALERT_SETTINGS)
      .then(response => response.data);
  }
};

export default performanceService; 