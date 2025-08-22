import axios from '../utils/axios';
import { API_ENDPOINTS } from '../config';

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
    const response = await axios.post(API_ENDPOINTS.LOGIN, credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Register new user
  register: async (userData) => {
    const response = await axios.post(API_ENDPOINTS.SIGNUP, userData);
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
    const response = await axios.post(API_ENDPOINTS.FORGOT_PASSWORD, { email });
    return response.data;
  },

  // Reset password
  resetPassword: async (email, otp, newPassword) => {
    const response = await axios.post(API_ENDPOINTS.RESET_PASSWORD, {
      email,
      otp,
      newPassword
    });
    return response.data;
  },

  // Resend password reset OTP
  resendPasswordResetOTP: async (email) => {
    const response = await axios.post(API_ENDPOINTS.RESEND_PASSWORD_RESET_OTP, { email });
    return response.data;
  },

  // Verify email
  verifyEmail: async (email, otp) => {
    const response = await axios.post(API_ENDPOINTS.VERIFY_OTP, { email, otp });
    return response.data;
  },

  // Resend verification email
  resendVerification: async (email) => {
    const response = await axios.post(API_ENDPOINTS.RESEND_OTP, { email });
    return response.data;
  },

  // Refresh token
  refreshToken: async () => {
    const response = await axios.post(API_ENDPOINTS.LOGIN);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
    }
    return response.data;
  },

  // Update password
  updatePassword: async (currentPassword, newPassword) => {
    const response = await axios.put(API_ENDPOINTS.UPDATE_USER_PROFILE, {
      currentPassword,
      newPassword
    });
    return response.data;
  },

  // Get token (exported both as a function and as part of the service)
  getToken
};

export default authService; 