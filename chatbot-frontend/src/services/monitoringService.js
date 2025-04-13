import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const monitoringService = {
  // Get system health status
  getSystemHealth: async () => {
    const response = await axios.get(ENDPOINTS.MONITORING.HEALTH);
    return response.data;
  },

  // Get service status
  getServiceStatus: async (serviceId) => {
    const response = await axios.get(`${ENDPOINTS.MONITORING.SERVICE_STATUS}/${serviceId}`);
    return response.data;
  },

  // Get all services status
  getAllServicesStatus: async () => {
    const response = await axios.get(ENDPOINTS.MONITORING.ALL_SERVICES);
    return response.data;
  },

  // Get resource monitoring data
  getResourceMonitoring: async (resourceType, timeRange = 'hour') => {
    const response = await axios.get(ENDPOINTS.MONITORING.RESOURCES, {
      params: { resourceType, timeRange }
    });
    return response.data;
  },

  // Get system metrics
  getSystemMetrics: async (timeRange = 'hour') => {
    const response = await axios.get(ENDPOINTS.MONITORING.SYSTEM_METRICS, {
      params: { timeRange }
    });
    return response.data;
  },

  // Get service metrics
  getServiceMetrics: async (serviceId, timeRange = 'hour') => {
    const response = await axios.get(`${ENDPOINTS.MONITORING.SERVICE_METRICS}/${serviceId}`, {
      params: { timeRange }
    });
    return response.data;
  },

  // Get monitoring alerts
  getMonitoringAlerts: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.MONITORING.ALERTS, {
      params: { page, limit }
    });
    return response.data;
  },

  // Update alert status
  updateAlertStatus: async (alertId, status) => {
    const response = await axios.put(`${ENDPOINTS.MONITORING.UPDATE_ALERT}/${alertId}`, { status });
    return response.data;
  },

  // Get monitoring dashboard data
  getDashboardData: async () => {
    const response = await axios.get(ENDPOINTS.MONITORING.DASHBOARD);
    return response.data;
  },

  // Get monitoring logs
  getMonitoringLogs: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.MONITORING.LOGS, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get monitoring configuration
  getMonitoringConfig: async () => {
    const response = await axios.get(ENDPOINTS.MONITORING.CONFIG);
    return response.data;
  },

  // Update monitoring configuration
  updateMonitoringConfig: async (config) => {
    const response = await axios.put(ENDPOINTS.MONITORING.CONFIG, config);
    return response.data;
  },

  // Get monitoring statistics
  getMonitoringStats: async (timeRange = 'day') => {
    const response = await axios.get(ENDPOINTS.MONITORING.STATS, {
      params: { timeRange }
    });
    return response.data;
  },

  // Export monitoring data
  exportMonitoringData: async (type, timeRange, format = 'csv') => {
    const response = await axios.get(ENDPOINTS.MONITORING.EXPORT, {
      params: { type, timeRange, format },
      responseType: 'blob'
    });
    return response.data;
  },

  // Get real-time monitoring data
  getRealTimeData: async () => {
    const response = await axios.get(ENDPOINTS.MONITORING.REAL_TIME);
    return response.data;
  },

  // Update monitoring thresholds
  updateThresholds: async (thresholds) => {
    const response = await axios.put(ENDPOINTS.MONITORING.THRESHOLDS, thresholds);
    return response.data;
  },

  // Get monitoring thresholds
  getThresholds: async () => {
    const response = await axios.get(ENDPOINTS.MONITORING.THRESHOLDS);
    return response.data;
  }
};

export default monitoringService; 