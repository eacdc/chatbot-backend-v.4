const API_URL = process.env.REACT_APP_API_URL || 'https://chatbot-backend-v-4.onrender.com';

export const API_ENDPOINTS = {
  LOGIN: `${API_URL}/api/users/login`,
  SIGNUP: `${API_URL}/api/users/signup`,
  CHAT: `${API_URL}/api/chat`,
  BOOKS: `${API_URL}/api/books`,
  CHAPTERS: `${API_URL}/api/chapters`,
  SUBSCRIPTIONS: `${API_URL}/api/subscriptions`,
  ADMIN_LOGIN: `${API_URL}/api/admins/login`,
  ADMIN_REGISTER: `${API_URL}/api/admins/register`,
  GET_BOOKS: `${API_URL}/api/books`,
  ADD_BOOK: `${API_URL}/api/books`,
  ADD_CHAPTER: `${API_URL}/api/chapters`,
  USER_SIGNUP: `${API_URL}/api/users/register`,
  GET_USER: `${API_URL}/api/users/me`,
  GET_BOOK_CHAPTERS: `${API_URL}/api/books/:bookId/chapters`,
  GET_SUBSCRIPTIONS: `${API_URL}/api/subscriptions/my-subscriptions`,
  GET_CHAPTER_HISTORY: `${API_URL}/api/chat/chapter-history/:chapterId`,
  GET_CHAT_HISTORY: `${API_URL}/api/chat/history/:userId`,
  SEND_AUDIO: `${API_URL}/api/chat/send-audio`,
  TRANSCRIBE_AUDIO: `${API_URL}/api/chat/transcribe`,
  
  // Chapter preparation endpoints
  PROCESS_TEXT: `${API_URL}/api/chapters/process-text`,
  GENERATE_QNA: `${API_URL}/api/chapters/generate-qna`,
  GENERATE_FINAL_PROMPT: `${API_URL}/api/chapters/generate-final-prompt`
};

export default API_URL; 