import axios from '../utils/axios';
import { ENDPOINTS } from '../utils/config';

// Get token from localStorage
export const getToken = () => {
  return localStorage.getItem('token');
};

// Get refresh token
export const refreshToken = async () => {
  // Implementation depends on your backend
  console.log("Refreshing token...");
  // Add your refresh token logic here
};

const authService = {
  // Login user
  login: async (credentials) => {
    const response = await axios.post(ENDPOINTS.AUTH.LOGIN, credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Register new user
  register: async (userData) => {
    const response = await axios.post(ENDPOINTS.AUTH.REGISTER, userData);
    return response.data;
  },

  // Logout user
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Get current user
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  // Forgot password
  forgotPassword: async (email) => {
    const response = await axios.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
    return response.data;
  },

  // Reset password
  resetPassword: async (token, newPassword) => {
    const response = await axios.post(ENDPOINTS.AUTH.RESET_PASSWORD, {
      token,
      newPassword
    });
    return response.data;
  },

  // Verify email
  verifyEmail: async (token) => {
    const response = await axios.post(ENDPOINTS.AUTH.VERIFY_EMAIL, { token });
    return response.data;
  },

  // Resend verification email
  resendVerification: async (email) => {
    const response = await axios.post(ENDPOINTS.AUTH.RESEND_VERIFICATION, { email });
    return response.data;
  },

  // Refresh token
  refreshToken: async () => {
    const response = await axios.post(ENDPOINTS.AUTH.REFRESH_TOKEN);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  },

  // Update password
  updatePassword: async (currentPassword, newPassword) => {
    const response = await axios.put(ENDPOINTS.AUTH.UPDATE_PASSWORD, {
      currentPassword,
      newPassword
    });
    return response.data;
  },

  // Get token (exported both as a function and as part of the service)
  getToken
};

export default authService; 