import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const sharingService = {
  // Share chat
  shareChat: async (chatId, shareConfig) => {
    const response = await axios.post(`${ENDPOINTS.SHARING.CHAT}/${chatId}`, shareConfig);
    return response.data;
  },

  // Share file
  shareFile: async (fileId, shareConfig) => {
    const response = await axios.post(`${ENDPOINTS.SHARING.FILE}/${fileId}`, shareConfig);
    return response.data;
  },

  // Get shared items
  getSharedItems: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.SHARING.ITEMS, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get shared item details
  getSharedItemDetails: async (shareId) => {
    const response = await axios.get(`${ENDPOINTS.SHARING.DETAILS}/${shareId}`);
    return response.data;
  },

  // Update sharing settings
  updateSharingSettings: async (shareId, settings) => {
    const response = await axios.put(`${ENDPOINTS.SHARING.SETTINGS}/${shareId}`, settings);
    return response.data;
  },

  // Revoke sharing access
  revokeAccess: async (shareId, userId) => {
    const response = await axios.delete(`${ENDPOINTS.SHARING.REVOKE}/${shareId}/${userId}`);
    return response.data;
  },

  // Get sharing history
  getSharingHistory: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.SHARING.HISTORY, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get shared with me items
  getSharedWithMe: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.SHARING.SHARED_WITH_ME, {
      params: { page, limit }
    });
    return response.data;
  },

  // Accept shared item
  acceptSharedItem: async (shareId) => {
    const response = await axios.post(`${ENDPOINTS.SHARING.ACCEPT}/${shareId}`);
    return response.data;
  },

  // Reject shared item
  rejectSharedItem: async (shareId) => {
    const response = await axios.post(`${ENDPOINTS.SHARING.REJECT}/${shareId}`);
    return response.data;
  },

  // Get sharing statistics
  getSharingStats: async () => {
    const response = await axios.get(ENDPOINTS.SHARING.STATS);
    return response.data;
  },

  // Generate sharing link
  generateSharingLink: async (itemId, itemType, options = {}) => {
    const response = await axios.post(ENDPOINTS.SHARING.GENERATE_LINK, {
      itemId,
      itemType,
      options
    });
    return response.data;
  },

  // Validate sharing link
  validateSharingLink: async (link) => {
    const response = await axios.post(ENDPOINTS.SHARING.VALIDATE_LINK, { link });
    return response.data;
  }
};

export default sharingService; 