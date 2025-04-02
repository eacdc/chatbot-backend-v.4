import axiosInstance from './axios';
import { API_ENDPOINTS } from '../config';

/**
 * Handles user login
 * @param {Object} credentials - User credentials
 * @returns {Promise} Response from the server
 */
export const login = async (credentials) => {
  console.log("Login attempt with:", { email: credentials.email, password: '******' });
  
  try {
    console.log("Calling login endpoint:", API_ENDPOINTS.LOGIN);
    const response = await axiosInstance.post(API_ENDPOINTS.LOGIN, credentials);
    
    console.log("Login response:", response.status, response.data ? 'Data received' : 'No data');
    
    if (response.data && response.data.token) {
      console.log("Token received, storing in localStorage");
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('userId', response.data.userId);
      localStorage.setItem('isAuthenticated', 'true');
      
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
      
      return response.data;
    } else {
      console.error("Login response missing token:", response.data);
      throw new Error("Invalid response from server - missing token");
    }
  } catch (error) {
    console.error("Login error:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else if (error.request) {
      console.error("No response received");
    }
    throw error;
  }
};

/**
 * Handles user signup
 * @param {Object} userData - User registration data
 * @returns {Promise} Response from the server
 */
export const signup = async (userData) => {
  const response = await axiosInstance.post(API_ENDPOINTS.USER_SIGNUP, userData);
  return response.data;
};

/**
 * Refreshes the authentication token
 * @returns {Promise<string>} New authentication token
 */
export const refreshToken = async () => {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token available');

    const response = await axiosInstance.post(API_ENDPOINTS.REFRESH_TOKEN, {
      refreshToken
    });

    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
      return response.data.token;
    }
    throw new Error('No token in refresh response');
  } catch (error) {
    logout();
    throw error;
  }
};

/**
 * Logs out the user
 */
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userId');
  localStorage.removeItem('isAuthenticated');
  window.location.href = '/login';
};

/**
 * Checks if user is authenticated
 * @returns {boolean}
 */
export const isAuthenticated = () => {
  return localStorage.getItem('isAuthenticated') === 'true' && !!localStorage.getItem('token');
};

/**
 * Gets the current user's ID
 * @returns {string|null}
 */
export const getCurrentUserId = () => {
  return localStorage.getItem('userId');
};

/**
 * Gets the current authentication token
 * @returns {string|null}
 */
export const getToken = () => {
  return localStorage.getItem('token');
}; 