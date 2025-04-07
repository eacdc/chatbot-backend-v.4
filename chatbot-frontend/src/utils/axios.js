import axios from 'axios';
import { API_ENDPOINTS } from '../config';

// Get the API URL from environment or use default
const API_URL = process.env.REACT_APP_API_URL || 'https://chatbot-backend-v-4.onrender.com';

console.log('API URL:', API_URL); // Debug log

const axiosInstance = axios.create({
  baseURL: API_URL, // Just use the root URL, not a specific endpoint
  timeout: 300000, // 5 minutes timeout for long operations
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for adding auth token
axiosInstance.interceptors.request.use(
  (config) => {
    console.log('Request URL:', config.url); // Debug log
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Token added to request'); // Debug log
    }
    
    return config;
  },
  (error) => {
    console.error('Request error:', error); // Debug log
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
axiosInstance.interceptors.response.use(
  (response) => {
    console.log('Response status:', response.status); // Debug log
    return response;
  },
  async (error) => {
    console.error('Response error:', error.message); // Debug log
    
    if (error.response) {
      console.error('Status:', error.response.status); // Debug log
      console.error('Data:', error.response.data); // Debug log
    } else if (error.request) {
      console.error('No response received'); // Debug log
    }
    
    const originalRequest = error.config;

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      console.log('Attempting token refresh'); // Debug log

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/api/auth/refresh-token`, {
            refreshToken
          });

          const newToken = response.data.token;
          localStorage.setItem('token', newToken);
          console.log('Token refreshed successfully'); // Debug log
          
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        // If refresh token fails, logout user
        console.error('Token refresh failed:', refreshError.message); // Debug log
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    if (error.response?.status === 403) {
      // Handle forbidden access
      console.log('Forbidden access, redirecting to unauthorized'); // Debug log
      window.location.href = '/unauthorized';
    }

    return Promise.reject(error);
  }
);

export default axiosInstance; 