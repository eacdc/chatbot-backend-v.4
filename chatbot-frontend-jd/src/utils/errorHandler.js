/**
 * Handles API errors and returns appropriate error messages
 * @param {Error} error - The error object from axios
 * @returns {string} Formatted error message
 */
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error
    const status = error.response.status;
    const message = error.response.data?.message;
    
    switch (status) {
      case 400:
        return message || 'Invalid request. Please check your input.';
      case 401:
        return 'Please login to continue.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return message || 'Resource not found.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return message || 'An unexpected error occurred.';
    }
  } else if (error.request) {
    // Request made but no response received
    if (!navigator.onLine) {
      return 'You are offline. Please check your internet connection.';
    }
    return 'Unable to reach the server. Please try again later.';
  } else {
    // Something happened in setting up the request
    return error.message || 'An unexpected error occurred.';
  }
};

/**
 * Handles authentication errors
 * @param {Error} error - The error object from axios
 * @returns {string} Formatted authentication error message
 */
export const handleAuthError = (error) => {
  if (error.response?.status === 401) {
    const message = error.response.data?.message;
    switch (message) {
      case 'invalid_credentials':
        return 'Invalid email or password.';
      case 'token_expired':
        return 'Your session has expired. Please login again.';
      case 'invalid_token':
        return 'Invalid authentication. Please login again.';
      default:
        return 'Authentication failed. Please try again.';
    }
  }
  return handleApiError(error);
};

/**
 * Handles form validation errors
 * @param {Object} errors - Object containing validation errors
 * @returns {Object} Formatted validation errors
 */
export const handleValidationErrors = (errors) => {
  const formattedErrors = {};
  
  for (const [field, error] of Object.entries(errors)) {
    if (Array.isArray(error)) {
      formattedErrors[field] = error[0]; // Take first error message
    } else if (typeof error === 'string') {
      formattedErrors[field] = error;
    } else {
      formattedErrors[field] = 'Invalid value';
    }
  }
  
  return formattedErrors;
}; 