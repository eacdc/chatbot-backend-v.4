import axios from 'axios';
import { API_URL } from '../config';

// Create axios instance with default config
const instance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  // Add timeout to prevent hanging requests
  timeout: 30000, // 30 seconds
});

// Request interceptor
instance.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to: ${config.baseURL}${config.url}`);
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("Authorization header set with token");
    } else {
      console.log("No token found in localStorage, request will be unauthenticated");
    }
    return config;
  },
  (error) => {
    console.error("Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor
instance.interceptors.response.use(
  (response) => {
    console.log(`Response received from ${response.config.url}: Status ${response.status}`);
    return response;
  },
  async (error) => {
    console.error("Response interceptor error:", error.message);
    if (error.response) {
      console.error(`Response error: ${error.response.status} from ${error.config?.url}`);
    }
    
    const originalRequest = error.config;
    
    // Add retry mechanism for network errors (like "Connection reset by peer")
    // Only retry if this is a network error and we haven't retried too many times already
    if (error.code === 'ECONNRESET' || error.message.includes('Connection reset by peer') || 
        error.code === 'ECONNABORTED' || error.message.includes('timeout') || 
        !error.response && error.request) {
      
      // Track retry count
      originalRequest.retryCount = originalRequest.retryCount || 0;
      const maxRetries = 3;
      
      // If we haven't reached max retries
      if (originalRequest.retryCount < maxRetries) {
        console.log(`Network error detected. Retrying request (${originalRequest.retryCount + 1}/${maxRetries})...`);
        
        // Increment retry count
        originalRequest.retryCount += 1;
        
        // Implement exponential backoff
        const delay = Math.min(1000 * Math.pow(2, originalRequest.retryCount - 1), 10000);
        console.log(`Waiting ${delay}ms before retry...`);
        
        return new Promise(resolve => {
          setTimeout(() => {
            console.log(`Retrying request to ${originalRequest.url}`);
            resolve(axios(originalRequest));
          }, delay);
        });
      } else {
        console.error(`Request to ${originalRequest.url} failed after ${maxRetries} retries`);
      }
    }

    // If error is 401 and we haven't tried to refresh token yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log("Got 401 unauthorized, attempting token refresh...");
      originalRequest._retry = true;

      try {
        // Try to refresh the token - simplified for now since we don't have proper refresh token logic
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          console.error("No refresh token available");
          throw new Error("No refresh token available");
        }
        
        // For now, just let authentication fail
        console.error("Token refresh not implemented");
        throw new Error("Token refresh not implemented");
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError.message);
        
        // If refresh token fails, check if this is a chapter request
        // For chapter requests, we don't want to redirect automatically
        const isChapterRequest = originalRequest.url.includes('/books/') && originalRequest.url.includes('/chapters');
        
        if (!isChapterRequest) {
          // Only redirect to login for non-chapter requests
          console.log("Clearing authentication and redirecting to login...");
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