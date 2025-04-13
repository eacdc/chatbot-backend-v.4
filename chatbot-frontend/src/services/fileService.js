import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

const fileService = {
  // Upload a file
  uploadFile: async (file, type = 'document') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    const response = await axios.post(ENDPOINTS.FILES.UPLOAD, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Get list of uploaded files
  getFiles: async (page = 1, limit = 10, type = null) => {
    const params = { page, limit };
    if (type) params.type = type;
    const response = await axios.get(ENDPOINTS.FILES.LIST, { params });
    return response.data;
  },

  // Get file details
  getFileDetails: async (fileId) => {
    const response = await axios.get(`${ENDPOINTS.FILES.DETAILS}/${fileId}`);
    return response.data;
  },

  // Delete a file
  deleteFile: async (fileId) => {
    const response = await axios.delete(`${ENDPOINTS.FILES.DELETE}/${fileId}`);
    return response.data;
  },

  // Download a file
  downloadFile: async (fileId) => {
    const response = await axios.get(`${ENDPOINTS.FILES.DOWNLOAD}/${fileId}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Share a file
  shareFile: async (fileId, shareData) => {
    const response = await axios.post(`${ENDPOINTS.FILES.SHARE}/${fileId}`, shareData);
    return response.data;
  },

  // Get file sharing status
  getSharingStatus: async (fileId) => {
    const response = await axios.get(`${ENDPOINTS.FILES.SHARING_STATUS}/${fileId}`);
    return response.data;
  },

  // Update file metadata
  updateMetadata: async (fileId, metadata) => {
    const response = await axios.put(`${ENDPOINTS.FILES.METADATA}/${fileId}`, metadata);
    return response.data;
  },

  // Get file preview
  getPreview: async (fileId) => {
    const response = await axios.get(`${ENDPOINTS.FILES.PREVIEW}/${fileId}`);
    return response.data;
  },

  // Convert file format
  convertFormat: async (fileId, targetFormat) => {
    const response = await axios.post(`${ENDPOINTS.FILES.CONVERT}/${fileId}`, {
      targetFormat
    });
    return response.data;
  }
};

export default fileService; 