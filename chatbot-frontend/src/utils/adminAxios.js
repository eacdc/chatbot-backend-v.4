import axios from 'axios';
import { API_ENDPOINTS } from '../config';

// Get the API URL from environment or use default
const API_URL = process.env.REACT_APP_API_URL || 'https://chatbot-backend-v-4.onrender.com';

console.log('Admin API URL:', API_URL);

const adminAxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 300000, // 5 minutes timeout for long text processing operations
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for adding admin auth token
adminAxiosInstance.interceptors.request.use(
  (config) => {
    console.log('Admin request URL:', config.url); // Debug log
    
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
      console.log('Admin token added to request'); // Debug log
    }
    
    return config;
  },
  (error) => {
    console.error('Admin request error:', error); // Debug log
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
adminAxiosInstance.interceptors.response.use(
  (response) => {
    console.log('Admin response status:', response.status); // Debug log
    return response;
  },
  async (error) => {
    console.error('Admin response error:', error.message); // Debug log
    
    if (error.response) {
      console.error('Status:', error.response.status); // Debug log
      console.error('Data:', error.response.data); // Debug log
    } else if (error.request) {
      console.error('No response received'); // Debug log
    }
    
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      console.log('Admin unauthorized, redirecting to login'); // Debug log
      
      // Clear admin token and redirect to login
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminId');
      
      // Only redirect if we're in a browser environment
      if (typeof window !== 'undefined') {
        window.location.href = '/admin-login';
      }
    }

    return Promise.reject(error);
  }
);

export default adminAxiosInstance; 