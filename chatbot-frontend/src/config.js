const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  LOGIN: `${API_URL}/api/users/login`,
  SIGNUP: `${API_URL}/api/users/signup`,
  CHAT: `${API_URL}/api/chat`,
  BOOKS: `${API_URL}/api/books`,
  CHAPTERS: `${API_URL}/api/chapters`,
  SUBSCRIPTIONS: `${API_URL}/api/subscriptions`,
  ADMIN_LOGIN: `${API_URL}/api/admins/login`,
  ADMIN_REGISTER: `${API_URL}/api/admins/register`,
};

export default API_URL; 