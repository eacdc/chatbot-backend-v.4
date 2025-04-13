import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const settingsService = {
  /**
   * Get user settings
   * @returns {Promise<object>} User settings data
   */
  getUserSettings: () => {
    return axios.get(ENDPOINTS.SETTINGS.USER)
      .then(response => response.data);
  },

  /**
   * Update user settings
   * @param {object} settings - Updated settings
   * @returns {Promise<object>} Updated settings data
   */
  updateUserSettings: (settings) => {
    return axios.put(ENDPOINTS.SETTINGS.USER, settings)
      .then(response => response.data);
  },

  /**
   * Get application settings
   * @returns {Promise<object>} Application settings data
   */
  getAppSettings: () => {
    return axios.get(ENDPOINTS.SETTINGS.APP)
      .then(response => response.data);
  },

  /**
   * Update application settings (admin only)
   * @param {object} settings - Updated settings
   * @returns {Promise<object>} Updated settings data
   */
  updateAppSettings: (settings) => {
    return axios.put(ENDPOINTS.SETTINGS.APP, settings)
      .then(response => response.data);
  },

  /**
   * Get notification settings
   * @returns {Promise<object>} Notification settings data
   */
  getNotificationSettings: () => {
    return axios.get(ENDPOINTS.SETTINGS.NOTIFICATIONS)
      .then(response => response.data);
  },

  /**
   * Update notification settings
   * @param {object} settings - Updated settings
   * @returns {Promise<object>} Updated settings data
   */
  updateNotificationSettings: (settings) => {
    return axios.put(ENDPOINTS.SETTINGS.NOTIFICATIONS, settings)
      .then(response => response.data);
  },

  /**
   * Get privacy settings
   * @returns {Promise<object>} Privacy settings data
   */
  getPrivacySettings: () => {
    return axios.get(ENDPOINTS.SETTINGS.PRIVACY)
      .then(response => response.data);
  },

  /**
   * Update privacy settings
   * @param {object} settings - Updated settings
   * @returns {Promise<object>} Updated settings data
   */
  updatePrivacySettings: (settings) => {
    return axios.put(ENDPOINTS.SETTINGS.PRIVACY, settings)
      .then(response => response.data);
  },

  /**
   * Get appearance settings
   * @returns {Promise<object>} Appearance settings data
   */
  getAppearanceSettings: () => {
    return axios.get(ENDPOINTS.SETTINGS.APPEARANCE)
      .then(response => response.data);
  },

  /**
   * Update appearance settings
   * @param {object} settings - Updated settings
   * @returns {Promise<object>} Updated settings data
   */
  updateAppearanceSettings: (settings) => {
    return axios.put(ENDPOINTS.SETTINGS.APPEARANCE, settings)
      .then(response => response.data);
  },

  /**
   * Get language settings
   * @returns {Promise<object>} Language settings data
   */
  getLanguageSettings: () => {
    return axios.get(ENDPOINTS.SETTINGS.LANGUAGE)
      .then(response => response.data);
  },

  /**
   * Update language settings
   * @param {object} settings - Updated settings
   * @returns {Promise<object>} Updated settings data
   */
  updateLanguageSettings: (settings) => {
    return axios.put(ENDPOINTS.SETTINGS.LANGUAGE, settings)
      .then(response => response.data);
  },

  /**
   * Get accessibility settings
   * @returns {Promise<object>} Accessibility settings data
   */
  getAccessibilitySettings: () => {
    return axios.get(ENDPOINTS.SETTINGS.ACCESSIBILITY)
      .then(response => response.data);
  },

  /**
   * Update accessibility settings
   * @param {object} settings - Updated settings
   * @returns {Promise<object>} Updated settings data
   */
  updateAccessibilitySettings: (settings) => {
    return axios.put(ENDPOINTS.SETTINGS.ACCESSIBILITY, settings)
      .then(response => response.data);
  },

  /**
   * Get integration settings
   * @returns {Promise<object>} Integration settings data
   */
  getIntegrationSettings: () => {
    return axios.get(ENDPOINTS.SETTINGS.INTEGRATIONS)
      .then(response => response.data);
  },

  /**
   * Update integration settings
   * @param {object} settings - Updated settings
   * @returns {Promise<object>} Updated settings data
   */
  updateIntegrationSettings: (settings) => {
    return axios.put(ENDPOINTS.SETTINGS.INTEGRATIONS, settings)
      .then(response => response.data);
  },

  /**
   * Export all settings
   * @param {string} format - Export format (default: 'json')
   * @returns {Promise<Blob>} Exported settings blob
   */
  exportSettings: (format = 'json') => {
    return axios.get(`${ENDPOINTS.SETTINGS.EXPORT}?format=${format}`, {
      responseType: 'blob'
    }).then(response => response.data);
  },

  /**
   * Import settings
   * @param {FormData} formData - Form data with settings file
   * @returns {Promise<object>} Import result
   */
  importSettings: (formData) => {
    return axios.post(ENDPOINTS.SETTINGS.IMPORT, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }).then(response => response.data);
  },

  /**
   * Reset settings to default
   * @param {string} type - Settings type to reset
   * @returns {Promise<object>} Reset result
   */
  resetSettings: (type) => {
    return axios.post(`${ENDPOINTS.SETTINGS.RESET}?type=${type}`)
      .then(response => response.data);
  }
};

export default settingsService; 