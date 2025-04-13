import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const userService = {
  // Get user profile
  getProfile: async () => {
    const response = await axios.get(ENDPOINTS.USER.PROFILE);
    return response.data;
  },

  // Update user profile
  updateProfile: async (profileData) => {
    const response = await axios.put(ENDPOINTS.USER.PROFILE, profileData);
    return response.data;
  },

  // Upload profile picture
  uploadProfilePicture: async (file) => {
    const formData = new FormData();
    formData.append('profilePicture', file);
    const response = await axios.post(ENDPOINTS.USER.UPLOAD_PICTURE, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Get user preferences
  getPreferences: async () => {
    const response = await axios.get(ENDPOINTS.USER.PREFERENCES);
    return response.data;
  },

  // Update user preferences
  updatePreferences: async (preferences) => {
    const response = await axios.put(ENDPOINTS.USER.PREFERENCES, preferences);
    return response.data;
  },

  // Get user activity history
  getActivityHistory: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.USER.ACTIVITY_HISTORY, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get user statistics
  getStatistics: async () => {
    const response = await axios.get(ENDPOINTS.USER.STATISTICS);
    return response.data;
  },

  // Delete user account
  deleteAccount: async () => {
    const response = await axios.delete(ENDPOINTS.USER.DELETE_ACCOUNT);
    return response.data;
  },

  // Export user data
  exportData: async () => {
    const response = await axios.get(ENDPOINTS.USER.EXPORT_DATA, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export default userService; 