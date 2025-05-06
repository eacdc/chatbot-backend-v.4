import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const favoritesService = {
  // Add item to favorites
  addToFavorites: async (itemId, itemType) => {
    const response = await axios.post(ENDPOINTS.FAVORITES.ADD, {
      itemId,
      itemType
    });
    return response.data;
  },

  // Remove item from favorites
  removeFromFavorites: async (itemId, itemType) => {
    const response = await axios.delete(`${ENDPOINTS.FAVORITES.REMOVE}/${itemId}`, {
      data: { itemType }
    });
    return response.data;
  },

  // Get all favorites
  getFavorites: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.FAVORITES.GET_ALL, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get favorites by type
  getFavoritesByType: async (itemType, page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.FAVORITES.GET_BY_TYPE, {
      params: { itemType, page, limit }
    });
    return response.data;
  },

  // Check if item is favorited
  isFavorited: async (itemId, itemType) => {
    const response = await axios.get(`${ENDPOINTS.FAVORITES.CHECK}/${itemId}`, {
      params: { itemType }
    });
    return response.data;
  },

  // Get favorite details
  getFavoriteDetails: async (favoriteId) => {
    const response = await axios.get(`${ENDPOINTS.FAVORITES.DETAILS}/${favoriteId}`);
    return response.data;
  },

  // Update favorite
  updateFavorite: async (favoriteId, updates) => {
    const response = await axios.put(`${ENDPOINTS.FAVORITES.UPDATE}/${favoriteId}`, updates);
    return response.data;
  },

  // Clear all favorites
  clearFavorites: async () => {
    const response = await axios.delete(ENDPOINTS.FAVORITES.CLEAR_ALL);
    return response.data;
  },

  // Clear favorites by type
  clearFavoritesByType: async (itemType) => {
    const response = await axios.delete(ENDPOINTS.FAVORITES.CLEAR_BY_TYPE, {
      data: { itemType }
    });
    return response.data;
  },

  // Get favorites statistics
  getFavoritesStats: async () => {
    const response = await axios.get(ENDPOINTS.FAVORITES.STATS);
    return response.data;
  },

  // Export favorites
  exportFavorites: async (format = 'csv') => {
    const response = await axios.get(ENDPOINTS.FAVORITES.EXPORT, {
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  },

  // Import favorites
  importFavorites: async (file) => {
    const formData = new FormData();
    formData.append('favorites', file);
    const response = await axios.post(ENDPOINTS.FAVORITES.IMPORT, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }
};

export default favoritesService; 