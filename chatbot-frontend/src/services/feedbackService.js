import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const feedbackService = {
  // Submit feedback
  submitFeedback: async (feedback) => {
    const response = await axios.post(ENDPOINTS.FEEDBACK.SUBMIT, feedback);
    return response.data;
  },

  // Get feedback history
  getFeedbackHistory: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.FEEDBACK.HISTORY, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get feedback details
  getFeedbackDetails: async (feedbackId) => {
    const response = await axios.get(`${ENDPOINTS.FEEDBACK.DETAILS}/${feedbackId}`);
    return response.data;
  },

  // Update feedback
  updateFeedback: async (feedbackId, updates) => {
    const response = await axios.put(`${ENDPOINTS.FEEDBACK.UPDATE}/${feedbackId}`, updates);
    return response.data;
  },

  // Delete feedback
  deleteFeedback: async (feedbackId) => {
    const response = await axios.delete(`${ENDPOINTS.FEEDBACK.DELETE}/${feedbackId}`);
    return response.data;
  },

  // Submit bug report
  submitBugReport: async (bugReport) => {
    const response = await axios.post(ENDPOINTS.FEEDBACK.BUG_REPORT, bugReport);
    return response.data;
  },

  // Submit feature request
  submitFeatureRequest: async (featureRequest) => {
    const response = await axios.post(ENDPOINTS.FEEDBACK.FEATURE_REQUEST, featureRequest);
    return response.data;
  },

  // Get bug reports
  getBugReports: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.FEEDBACK.BUG_REPORTS, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get feature requests
  getFeatureRequests: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.FEEDBACK.FEATURE_REQUESTS, {
      params: { page, limit }
    });
    return response.data;
  },

  // Vote on feature request
  voteFeatureRequest: async (featureId, vote) => {
    const response = await axios.post(`${ENDPOINTS.FEEDBACK.VOTE_FEATURE}/${featureId}`, { vote });
    return response.data;
  },

  // Get feedback statistics
  getFeedbackStats: async () => {
    const response = await axios.get(ENDPOINTS.FEEDBACK.STATS);
    return response.data;
  },

  // Export feedback
  exportFeedback: async (format = 'csv', filters = {}) => {
    const response = await axios.post(ENDPOINTS.FEEDBACK.EXPORT, {
      format,
      filters
    }, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export default feedbackService; 