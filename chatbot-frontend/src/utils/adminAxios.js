import axios from 'axios';
import { API_ENDPOINTS } from '../config';

// Get the API URL from environment or use default
const API_URL = process.env.REACT_APP_API_URL || 'https://chatbot-backend-v-4.onrender.com';

console.log('Admin API URL:', API_URL);

const adminAxiosInstance = axios.create({
  timeout: 1800000, // 30 minutes timeout for very large text processing operations
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for adding admin auth token
adminAxiosInstance.interceptors.request.use(
  (config) => {
    console.log('Admin request URL:', config.url || 'No URL provided'); // Debug log
    
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
    console.log('Admin response raw data:', JSON.stringify(response.data)); // Log raw response data
    return response;
  },
  async (error) => {
    if (error.response) {
      // Handle 404 for "No chapters found" case differently
      if (error.response.status === 404 && 
          error.response.data?.error === "No chapters found for this book") {
        console.log('Admin response error: No chapters found for this book');
        console.log('Status:', error.response.status);
        console.log('Data:', error.response.data);
      }
      // Only log as error if it's not a 404 (which is often an expected response)
      else if (error.response.status !== 404) {
        console.error('Admin response error:', error.message); // Debug log
        console.error('Status:', error.response.status); // Debug log
        console.error('Data:', error.response.data); // Debug log
      } else {
        console.log('Admin response: No data found (404)'); // More appropriate log for 404s
        console.log('Status: 404');
        console.log('Data:', error.response.data);
      }
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

// Debug function to test API endpoints
export const testEndpoint = async (endpoint, data = {}) => {
  try {
    console.log(`Testing endpoint: ${endpoint}`);
    const response = await adminAxiosInstance.post(endpoint, data);
    console.log('Test response status:', response.status);
    console.log('Test response data:', JSON.stringify(response.data));
    return response;
  } catch (error) {
    console.error('Test error:', error);
    if (error.response) {
      console.error('Test error status:', error.response.status);
      console.error('Test error data:', error.response.data);
    }
    throw error;
  }
};

export default adminAxiosInstance; 