import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const suggestionsService = {
  // Get chat suggestions
  getChatSuggestions: async (context) => {
    const response = await axios.post(ENDPOINTS.SUGGESTIONS.CHAT, { context });
    return response.data;
  },

  // Get search suggestions
  getSearchSuggestions: async (query) => {
    const response = await axios.get(ENDPOINTS.SUGGESTIONS.SEARCH, {
      params: { query }
    });
    return response.data;
  },

  // Get file suggestions
  getFileSuggestions: async (context) => {
    const response = await axios.post(ENDPOINTS.SUGGESTIONS.FILE, { context });
    return response.data;
  },

  // Get user suggestions
  getUserSuggestions: async (query) => {
    const response = await axios.get(ENDPOINTS.SUGGESTIONS.USER, {
      params: { query }
    });
    return response.data;
  },

  // Get tag suggestions
  getTagSuggestions: async (query) => {
    const response = await axios.get(ENDPOINTS.SUGGESTIONS.TAG, {
      params: { query }
    });
    return response.data;
  },

  // Get related content suggestions
  getRelatedContent: async (contentId, contentType) => {
    const response = await axios.get(ENDPOINTS.SUGGESTIONS.RELATED, {
      params: { contentId, contentType }
    });
    return response.data;
  },

  // Get trending suggestions
  getTrendingSuggestions: async (type) => {
    const response = await axios.get(ENDPOINTS.SUGGESTIONS.TRENDING, {
      params: { type }
    });
    return response.data;
  },

  // Get personalized suggestions
  getPersonalizedSuggestions: async (type) => {
    const response = await axios.get(ENDPOINTS.SUGGESTIONS.PERSONALIZED, {
      params: { type }
    });
    return response.data;
  },

  // Save suggestion feedback
  saveSuggestionFeedback: async (suggestionId, feedback) => {
    const response = await axios.post(`${ENDPOINTS.SUGGESTIONS.FEEDBACK}/${suggestionId}`, feedback);
    return response.data;
  },

  // Get suggestion history
  getSuggestionHistory: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.SUGGESTIONS.HISTORY, {
      params: { page, limit }
    });
    return response.data;
  },

  // Clear suggestion history
  clearSuggestionHistory: async () => {
    const response = await axios.delete(ENDPOINTS.SUGGESTIONS.CLEAR_HISTORY);
    return response.data;
  },

  // Update suggestion preferences
  updateSuggestionPreferences: async (preferences) => {
    const response = await axios.put(ENDPOINTS.SUGGESTIONS.PREFERENCES, preferences);
    return response.data;
  },

  // Get suggestion preferences
  getSuggestionPreferences: async () => {
    const response = await axios.get(ENDPOINTS.SUGGESTIONS.PREFERENCES);
    return response.data;
  }
};

export default suggestionsService; 