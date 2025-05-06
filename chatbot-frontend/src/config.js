const API_URL = process.env.REACT_APP_API_URL || 'https://chatbot-backend-v-4.onrender.com';

export const API_ENDPOINTS = {
  LOGIN: `${API_URL}/api/users/login`,
  SIGNUP: `${API_URL}/api/users/signup`,
  CHAT: `${API_URL}/api/chat/send`,
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
  UNSUBSCRIBE_BOOK: `${API_URL}/api/subscriptions/:bookId`,
  GET_CHAPTER_HISTORY: `${API_URL}/api/chat/chapter-history/:chapterId`,
  GET_CHAT_HISTORY: `${API_URL}/api/chat/history/:userId`,
  SEND_AUDIO: `${API_URL}/api/chat/send-audio`,
  TRANSCRIBE_AUDIO: `${API_URL}/api/chat/transcribe`,
  UPLOAD_BOOK_COVER: `${API_URL}/api/books/upload-cover`,
  GET_AUDIO: `${API_URL}/api/chat/audio/:fileId`,
  
  // Add the new chapter stats endpoint
  GET_CHAPTER_STATS: `${API_URL}/api/chat/chapter-stats/:chapterId`,
  
  // Chapter preparation endpoints
  PROCESS_TEXT_BATCH: `${API_URL}/api/chapters/process-text-batch`,
  
  // Notification endpoints
  GET_NOTIFICATIONS: `${API_URL}/api/notifications`,
  GET_FIRST_UNSEEN: `${API_URL}/api/notifications/first-unseen`,
  MARK_NOTIFICATION_SEEN: `${API_URL}/api/notifications/:notificationId/mark-seen`,
  SEED_NOTIFICATIONS: `${API_URL}/api/notifications/seed`,
};

export default API_URL; 