import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const backupService = {
  // Create backup
  createBackup: async (options = {}) => {
    const response = await axios.post(ENDPOINTS.BACKUP.CREATE, options);
    return response.data;
  },

  // Get all backups
  getAllBackups: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.BACKUP.GET_ALL, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get backup details
  getBackupDetails: async (backupId) => {
    const response = await axios.get(`${ENDPOINTS.BACKUP.DETAILS}/${backupId}`);
    return response.data;
  },

  // Delete backup
  deleteBackup: async (backupId) => {
    const response = await axios.delete(`${ENDPOINTS.BACKUP.DELETE}/${backupId}`);
    return response.data;
  },

  // Restore backup
  restoreBackup: async (backupId, options = {}) => {
    const response = await axios.post(`${ENDPOINTS.BACKUP.RESTORE}/${backupId}`, options);
    return response.data;
  },

  // Download backup
  downloadBackup: async (backupId) => {
    const response = await axios.get(`${ENDPOINTS.BACKUP.DOWNLOAD}/${backupId}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Get backup status
  getBackupStatus: async (backupId) => {
    const response = await axios.get(`${ENDPOINTS.BACKUP.STATUS}/${backupId}`);
    return response.data;
  },

  // Cancel backup
  cancelBackup: async (backupId) => {
    const response = await axios.post(`${ENDPOINTS.BACKUP.CANCEL}/${backupId}`);
    return response.data;
  },

  // Get backup schedule
  getBackupSchedule: async () => {
    const response = await axios.get(ENDPOINTS.BACKUP.SCHEDULE);
    return response.data;
  },

  // Update backup schedule
  updateBackupSchedule: async (schedule) => {
    const response = await axios.put(ENDPOINTS.BACKUP.SCHEDULE, schedule);
    return response.data;
  },

  // Get backup statistics
  getBackupStats: async () => {
    const response = await axios.get(ENDPOINTS.BACKUP.STATS);
    return response.data;
  },

  // Get backup configuration
  getBackupConfig: async () => {
    const response = await axios.get(ENDPOINTS.BACKUP.CONFIG);
    return response.data;
  },

  // Update backup configuration
  updateBackupConfig: async (config) => {
    const response = await axios.put(ENDPOINTS.BACKUP.CONFIG, config);
    return response.data;
  },

  // Verify backup
  verifyBackup: async (backupId) => {
    const response = await axios.post(`${ENDPOINTS.BACKUP.VERIFY}/${backupId}`);
    return response.data;
  },

  // Get backup logs
  getBackupLogs: async (backupId, page = 1, limit = 10) => {
    const response = await axios.get(`${ENDPOINTS.BACKUP.LOGS}/${backupId}`, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get backup storage info
  getBackupStorageInfo: async () => {
    const response = await axios.get(ENDPOINTS.BACKUP.STORAGE_INFO);
    return response.data;
  },

  // Clean up old backups
  cleanupOldBackups: async (options = {}) => {
    const response = await axios.post(ENDPOINTS.BACKUP.CLEANUP, options);
    return response.data;
  }
};

export default backupService; 