import axios from 'axios';
import { API_URL } from '../config';

// Create axios instance with default config
const instance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh token yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token - simplified for now since we don't have proper refresh token logic
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }
        
        // For now, just let authentication fail
        throw new Error("Token refresh not implemented");
      } catch (refreshError) {
        // If refresh token fails, check if this is a chapter request
        // For chapter requests, we don't want to redirect automatically
        const isChapterRequest = originalRequest.url.includes('/books/') && originalRequest.url.includes('/chapters');
        
        if (!isChapterRequest) {
          // Only redirect to login for non-chapter requests
          localStorage.removeItem('token');
          localStorage.removeItem('userId');
          localStorage.removeItem('isAuthenticated');
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    const errorMessage = error.response?.data?.message || 'An error occurred';
    console.error('API Error:', errorMessage);
    
    return Promise.reject(error);
  }
);

export default instance; 