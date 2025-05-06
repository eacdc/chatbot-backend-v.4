import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const securityService = {
  // Get security status
  getSecurityStatus: async () => {
    const response = await axios.get(ENDPOINTS.SECURITY.STATUS);
    return response.data;
  },

  // Get security logs
  getSecurityLogs: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.SECURITY.LOGS, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get security alerts
  getSecurityAlerts: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.SECURITY.ALERTS, {
      params: { page, limit }
    });
    return response.data;
  },

  // Update security settings
  updateSecuritySettings: async (settings) => {
    const response = await axios.put(ENDPOINTS.SECURITY.SETTINGS, settings);
    return response.data;
  },

  // Get security settings
  getSecuritySettings: async () => {
    const response = await axios.get(ENDPOINTS.SECURITY.SETTINGS);
    return response.data;
  },

  // Get security audit logs
  getAuditLogs: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.SECURITY.AUDIT_LOGS, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get security incidents
  getSecurityIncidents: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.SECURITY.INCIDENTS, {
      params: { page, limit }
    });
    return response.data;
  },

  // Report security incident
  reportIncident: async (incident) => {
    const response = await axios.post(ENDPOINTS.SECURITY.REPORT_INCIDENT, incident);
    return response.data;
  },

  // Update incident status
  updateIncidentStatus: async (incidentId, status) => {
    const response = await axios.put(`${ENDPOINTS.SECURITY.UPDATE_INCIDENT}/${incidentId}`, { status });
    return response.data;
  },

  // Get security policies
  getSecurityPolicies: async () => {
    const response = await axios.get(ENDPOINTS.SECURITY.POLICIES);
    return response.data;
  },

  // Update security policy
  updateSecurityPolicy: async (policyId, updates) => {
    const response = await axios.put(`${ENDPOINTS.SECURITY.POLICIES}/${policyId}`, updates);
    return response.data;
  },

  // Get security vulnerabilities
  getVulnerabilities: async (page = 1, limit = 10) => {
    const response = await axios.get(ENDPOINTS.SECURITY.VULNERABILITIES, {
      params: { page, limit }
    });
    return response.data;
  },

  // Get vulnerability details
  getVulnerabilityDetails: async (vulnerabilityId) => {
    const response = await axios.get(`${ENDPOINTS.SECURITY.VULNERABILITY_DETAILS}/${vulnerabilityId}`);
    return response.data;
  },

  // Update vulnerability status
  updateVulnerabilityStatus: async (vulnerabilityId, status) => {
    const response = await axios.put(`${ENDPOINTS.SECURITY.UPDATE_VULNERABILITY}/${vulnerabilityId}`, { status });
    return response.data;
  },

  // Get security statistics
  getSecurityStats: async (timeRange = 'week') => {
    const response = await axios.get(ENDPOINTS.SECURITY.STATS, {
      params: { timeRange }
    });
    return response.data;
  },

  // Get security recommendations
  getSecurityRecommendations: async () => {
    const response = await axios.get(ENDPOINTS.SECURITY.RECOMMENDATIONS);
    return response.data;
  },

  // Apply security recommendation
  applyRecommendation: async (recommendationId) => {
    const response = await axios.post(`${ENDPOINTS.SECURITY.APPLY_RECOMMENDATION}/${recommendationId}`);
    return response.data;
  },

  // Get security compliance status
  getComplianceStatus: async () => {
    const response = await axios.get(ENDPOINTS.SECURITY.COMPLIANCE);
    return response.data;
  },

  // Run security scan
  runSecurityScan: async (options = {}) => {
    const response = await axios.post(ENDPOINTS.SECURITY.SCAN, options);
    return response.data;
  },

  // Get scan results
  getScanResults: async (scanId) => {
    const response = await axios.get(`${ENDPOINTS.SECURITY.SCAN_RESULTS}/${scanId}`);
    return response.data;
  }
};

export default securityService; 