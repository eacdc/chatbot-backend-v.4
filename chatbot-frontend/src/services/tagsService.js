import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const tagsService = {
  // Create tag
  createTag: async (tagData) => {
    const response = await axios.post(ENDPOINTS.TAGS.CREATE, tagData);
    return response.data;
  },

  // Get all tags
  getAllTags: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.TAGS.GET_ALL, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get tag by ID
  getTagById: async (tagId) => {
    const response = await axios.get(`${ENDPOINTS.TAGS.GET_BY_ID}/${tagId}`);
    return response.data;
  },

  // Update tag
  updateTag: async (tagId, updates) => {
    const response = await axios.put(`${ENDPOINTS.TAGS.UPDATE}/${tagId}`, updates);
    return response.data;
  },

  // Delete tag
  deleteTag: async (tagId) => {
    const response = await axios.delete(`${ENDPOINTS.TAGS.DELETE}/${tagId}`);
    return response.data;
  },

  // Add tag to item
  addTagToItem: async (itemId, itemType, tagId) => {
    const response = await axios.post(ENDPOINTS.TAGS.ADD_TO_ITEM, {
      itemId,
      itemType,
      tagId
    });
    return response.data;
  },

  // Remove tag from item
  removeTagFromItem: async (itemId, itemType, tagId) => {
    const response = await axios.delete(ENDPOINTS.TAGS.REMOVE_FROM_ITEM, {
      data: { itemId, itemType, tagId }
    });
    return response.data;
  },

  // Get items by tag
  getItemsByTag: async (tagId, page = 1, limit = 10) => {
    const response = await axios.get(`${ENDPOINTS.TAGS.GET_ITEMS}/${tagId}`, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get popular tags
  getPopularTags: async (limit = 10) => {
    const response = await axios.get(ENDPOINTS.TAGS.POPULAR, {
      params: { limit }
    });
    return response.data;
  },

  // Search tags
  searchTags: async (query, page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.TAGS.SEARCH, {
      params: { query, page, limit }
    });
    return response.data;
  },

  // Get tag statistics
  getTagStats: async () => {
    const response = await axios.get(ENDPOINTS.TAGS.STATS);
    return response.data;
  },

  // Merge tags
  mergeTags: async (sourceTagId, targetTagId) => {
    const response = await axios.post(ENDPOINTS.TAGS.MERGE, {
      sourceTagId,
      targetTagId
    });
    return response.data;
  },

  // Get tag suggestions
  getTagSuggestions: async (query) => {
    const response = await axios.get(ENDPOINTS.TAGS.SUGGESTIONS, {
      params: { query }
    });
    return response.data;
  },

  // Get related tags
  getRelatedTags: async (tagId, limit = 10) => {
    const response = await axios.get(`${ENDPOINTS.TAGS.RELATED}/${tagId}`, {
      params: { limit }
    });
    return response.data;
  }
};

export default tagsService; 