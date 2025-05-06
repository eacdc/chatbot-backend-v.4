import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const searchService = {
  // Search across all content
  searchAll: async (query, page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.SEARCH.ALL, {
      params: { query, page, limit }
    });
    return response.data;
  },

  // Search in chats
  searchChats: async (query, page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.SEARCH.CHATS, {
      params: { query, page, limit }
    });
    return response.data;
  },

  // Search in files
  searchFiles: async (query, page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.SEARCH.FILES, {
      params: { query, page, limit }
    });
    return response.data;
  },

  // Search in messages
  searchMessages: async (query, page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.SEARCH.MESSAGES, {
      params: { query, page, limit }
    });
    return response.data;
  },

  // Get search suggestions
  getSuggestions: async (query) => {
    const response = await axios.get(ENDPOINTS.SEARCH.SUGGESTIONS, {
      params: { query }
    });
    return response.data;
  },

  // Get search filters
  getFilters: async () => {
    const response = await axios.get(ENDPOINTS.SEARCH.FILTERS);
    return response.data;
  },

  // Apply search filters
  applyFilters: async (query, filters, page = 1, limit = 10) => {
    const response = await axios.post(ENDPOINTS.SEARCH.APPLY_FILTERS, {
      query,
      filters,
      page,
      limit
    });
    return response.data;
  },

  // Save search query
  saveSearch: async (query, filters = {}) => {
    const response = await axios.post(ENDPOINTS.SEARCH.SAVE, {
      query,
      filters
    });
    return response.data;
  },

  // Get saved searches
  getSavedSearches: async () => {
    const response = await axios.get(ENDPOINTS.SEARCH.SAVED);
    return response.data;
  },

  // Delete saved search
  deleteSavedSearch: async (searchId) => {
    const response = await axios.delete(`${ENDPOINTS.SEARCH.DELETE_SAVED}/${searchId}`);
    return response.data;
  },

  // Get search history
  getSearchHistory: async () => {
    const response = await axios.get(ENDPOINTS.SEARCH.HISTORY);
    return response.data;
  },

  // Clear search history
  clearSearchHistory: async () => {
    const response = await axios.delete(ENDPOINTS.SEARCH.CLEAR_HISTORY);
    return response.data;
  }
};

export default searchService; 