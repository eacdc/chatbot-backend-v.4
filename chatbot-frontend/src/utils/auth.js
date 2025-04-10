import axiosInstance from './axios';
import { API_ENDPOINTS } from '../config';

// 30 minutes in milliseconds
const SESSION_TIMEOUT = 30 * 60 * 1000;

/**
 * Handles user login
 * @param {Object} credentials - User credentials
 * @returns {Promise} Response from the server
 */
export const login = async (credentials) => {
  console.log("Login attempt with:", { username: credentials.username, password: '******' });
  
  try {
    console.log("Calling login endpoint:", API_ENDPOINTS.LOGIN);
    const response = await axiosInstance.post(API_ENDPOINTS.LOGIN, credentials);
    
    console.log("Login response:", response.status, response.data ? 'Data received' : 'No data');
    
    if (response.data && response.data.token) {
      console.log("Token received, storing in localStorage");
      
      // Ensure we clear any previous values first
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userGrade');
      
      // Set new values
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('userId', response.data.userId);
      localStorage.setItem('isAuthenticated', 'true');
      
      // Store user grade if available
      if (response.data.grade) {
        localStorage.setItem('userGrade', response.data.grade);
      }
      
      // Set last activity timestamp
      updateLastActivity();
      
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }
      
      // Add a slight delay to ensure localStorage is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
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
 * Updates the last activity timestamp
 */
export const updateLastActivity = () => {
  localStorage.setItem('lastActivityTime', Date.now().toString());
};

/**
 * Checks if the session has timed out
 * @returns {boolean} True if session has timed out
 */
export const hasSessionTimedOut = () => {
  const lastActivity = localStorage.getItem('lastActivityTime');
  if (!lastActivity) return false;
  
  const now = Date.now();
  const lastActivityTime = parseInt(lastActivity, 10);
  return now - lastActivityTime > SESSION_TIMEOUT;
};

/**
 * Setup activity listeners to track user activity
 */
export const setupActivityTracking = () => {
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  
  const resetTimer = () => {
    if (isAuthenticated()) {
      updateLastActivity();
    }
  };
  
  // Add event listeners for user activity
  activityEvents.forEach(event => {
    document.addEventListener(event, resetTimer, { passive: true });
  });
  
  // Check for session timeout every minute
  const checkSessionTimeout = () => {
    if (isAuthenticated() && hasSessionTimedOut()) {
      console.log('Session timed out due to inactivity');
      logout();
    }
  };
  
  // Set interval to check session timeout
  const intervalId = setInterval(checkSessionTimeout, 60000); // Check every minute
  
  // Store intervalId to clear it when needed
  window._sessionTimeoutInterval = intervalId;
  
  return () => {
    // Cleanup function
    activityEvents.forEach(event => {
      document.removeEventListener(event, resetTimer);
    });
    clearInterval(intervalId);
  };
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
      updateLastActivity(); // Update activity time on token refresh
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
  localStorage.removeItem('lastActivityTime');
  localStorage.removeItem('userGrade');
  
  // Clear session timeout interval
  if (window._sessionTimeoutInterval) {
    clearInterval(window._sessionTimeoutInterval);
  }
  
  window.location.href = '/login';
};

/**
 * Checks if user is authenticated and session is valid
 * @returns {boolean}
 */
export const isAuthenticated = () => {
  const token = localStorage.getItem('token');
  const isAuth = localStorage.getItem('isAuthenticated') === 'true' && !!token;
  
  if (!isAuth) {
    return false;
  }
  
  // Check for session timeout
  if (hasSessionTimedOut()) {
    console.log('Session expired during authentication check');
    return false;
  }
  
  // Check if token looks valid (simple check)
  if (token && typeof token === 'string' && token.length > 20) {
    return true;
  }
  
  return false;
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

/**
 * Checks if admin is authenticated
 * @returns {boolean}
 */
export const isAdminAuthenticated = () => {
  const adminToken = localStorage.getItem('adminToken');
  
  if (!adminToken) {
    return false;
  }
  
  // Check if token looks valid (simple check)
  if (adminToken && typeof adminToken === 'string' && adminToken.length > 20) {
    return true;
  }
  
  return false;
}; 