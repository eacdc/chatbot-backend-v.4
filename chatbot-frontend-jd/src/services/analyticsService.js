import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const analyticsService = {
  /**
   * Get user analytics data
   * @param {string} timeRange - Time range for analytics (default: 'week')
   * @returns {Promise<object>} User analytics data
   */
  getUserAnalytics: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.ANALYTICS.USER}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get chat analytics data
   * @param {string} timeRange - Time range for analytics (default: 'week')
   * @returns {Promise<object>} Chat analytics data
   */
  getChatAnalytics: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.ANALYTICS.CHAT}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get content usage analytics
   * @param {string} timeRange - Time range for analytics (default: 'week')
   * @returns {Promise<object>} Content usage analytics data
   */
  getContentAnalytics: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.ANALYTICS.CONTENT}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get usage trend analysis
   * @param {string} metric - Metric type to analyze
   * @param {string} timeRange - Time range for trends (default: 'week')
   * @returns {Promise<object>} Usage trend data
   */
  getUsageTrends: (metric, timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.ANALYTICS.TRENDS}?metric=${metric}&timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get user engagement metrics
   * @param {string} timeRange - Time range for metrics (default: 'week')
   * @returns {Promise<object>} User engagement data
   */
  getEngagementMetrics: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.ANALYTICS.ENGAGEMENT}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get query pattern analysis
   * @param {string} timeRange - Time range for analysis (default: 'week')
   * @returns {Promise<object>} Query pattern data
   */
  getQueryPatterns: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.ANALYTICS.QUERY_PATTERNS}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get performance analytics
   * @param {string} timeRange - Time range for analytics (default: 'week')
   * @returns {Promise<object>} Performance analytics data
   */
  getPerformanceAnalytics: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.ANALYTICS.PERFORMANCE}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get retention analysis
   * @param {string} cohort - Cohort type
   * @param {string} timeRange - Time range for analysis (default: 'month')
   * @returns {Promise<object>} Retention analysis data
   */
  getRetentionAnalysis: (cohort, timeRange = 'month') => {
    return axios.get(`${ENDPOINTS.ANALYTICS.RETENTION}?cohort=${cohort}&timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get user feedback analysis
   * @param {string} timeRange - Time range for analysis (default: 'week')
   * @returns {Promise<object>} User feedback analysis data
   */
  getFeedbackAnalysis: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.ANALYTICS.FEEDBACK}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get AI model performance metrics
   * @param {string} model - Model name/identifier
   * @param {string} timeRange - Time range for metrics (default: 'week')
   * @returns {Promise<object>} AI model performance data
   */
  getModelPerformance: (model, timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.ANALYTICS.MODEL_PERFORMANCE}?model=${model}&timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Get user demographic data
   * @returns {Promise<object>} User demographic data
   */
  getUserDemographics: () => {
    return axios.get(ENDPOINTS.ANALYTICS.DEMOGRAPHICS)
      .then(response => response.data);
  },

  /**
   * Get user session analysis
   * @param {string} timeRange - Time range for analysis (default: 'week')
   * @returns {Promise<object>} User session analysis data
   */
  getSessionAnalysis: (timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.ANALYTICS.SESSIONS}?timeRange=${timeRange}`)
      .then(response => response.data);
  },

  /**
   * Export analytics data
   * @param {string} format - Export format (default: 'csv')
   * @param {string} type - Analytics type
   * @param {string} timeRange - Time range for data (default: 'week')
   * @returns {Promise<Blob>} Exported data blob
   */
  exportAnalytics: (format = 'csv', type, timeRange = 'week') => {
    return axios.get(`${ENDPOINTS.ANALYTICS.EXPORT}?format=${format}&type=${type}&timeRange=${timeRange}`, {
      responseType: 'blob'
    }).then(response => response.data);
  },

  /**
   * Get custom analytics report
   * @param {object} params - Report parameters
   * @returns {Promise<object>} Custom analytics report data
   */
  getCustomReport: (params) => {
    return axios.post(ENDPOINTS.ANALYTICS.CUSTOM_REPORT, params)
      .then(response => response.data);
  },

  /**
   * Get saved analytics reports
   * @returns {Promise<Array>} List of saved reports
   */
  getSavedReports: () => {
    return axios.get(ENDPOINTS.ANALYTICS.SAVED_REPORTS)
      .then(response => response.data);
  },

  /**
   * Save analytics report
   * @param {object} report - Report configuration
   * @returns {Promise<object>} Saved report data
   */
  saveReport: (report) => {
    return axios.post(ENDPOINTS.ANALYTICS.SAVED_REPORTS, report)
      .then(response => response.data);
  }
};

export default analyticsService; 