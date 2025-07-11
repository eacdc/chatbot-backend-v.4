// Directly set the API URL to ensure it's always available
const API_URL = 'https://chatbot-backend-v-4.onrender.com';
console.log("Using API_URL:", API_URL);

export const API_ENDPOINTS = {
  LOGIN: `${API_URL}/api/users/login`,
  SIGNUP: `${API_URL}/api/users/signup`,
  SEND_OTP: `${API_URL}/api/users/send-otp`,
  VERIFY_OTP: `${API_URL}/api/users/verify-otp`,
  RESEND_OTP: `${API_URL}/api/users/resend-otp`,
  CHECK_USERNAME: `${API_URL}/api/users/check-username`,
  CHAT: `${API_URL}/api/chat/send`,
  BOOKS: `${API_URL}/api/books`,
  CHAPTERS: `${API_URL}/api/chapters`,
  SUBSCRIPTIONS: `${API_URL}/api/subscriptions`,
  ADMIN_LOGIN: `${API_URL}/api/admins/login`,
  ADMIN_REGISTER: `${API_URL}/api/admins/register`,
  GET_BOOKS: `${API_URL}/api/books`,
  ADD_BOOK: `${API_URL}/api/books`,
  ADD_CHAPTER: `${API_URL}/api/chapters`,
  DELETE_BOOK: `${API_URL}/api/books/:bookId`,
  DELETE_CHAPTER: `${API_URL}/api/chapters/:chapterId`,
  USER_SIGNUP: `${API_URL}/api/users/register`,
  GET_USER: `${API_URL}/api/users/me`,
  UPDATE_USER_PROFILE: `${API_URL}/api/users/profile`,
  UPLOAD_PROFILE_PICTURE: `${API_URL}/api/users/upload-profile-picture`,
  DELETE_PROFILE_PICTURE: `${API_URL}/api/users/delete-profile-picture`,
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
  ENHANCED_BATCH_PROCESS: `${API_URL}/api/chapters/enhanced-batch-process`,
  GENERATE_EMBEDDINGS: `${API_URL}/api/chapters/generate-embeddings`,
  SEMANTIC_SEARCH: `${API_URL}/api/chapters/semantic-search`,
  ANALYZE_QUESTION: `${API_URL}/api/chapters/analyze-question/:chapterId`,
  GENERATE_QNA: `${API_URL}/api/chapters/generate-qna`,
  
  // Notification endpoints
  GET_NOTIFICATIONS: `${API_URL}/api/notifications`,
  GET_FIRST_UNSEEN: `${API_URL}/api/notifications/first-unseen`,
  MARK_NOTIFICATION_SEEN: `${API_URL}/api/notifications/:notificationId/mark-seen`,
  MARK_ALL_NOTIFICATIONS_SEEN: `${API_URL}/api/notifications/mark-all-seen`,
  SEED_NOTIFICATIONS: `${API_URL}/api/notifications/seed`,
  
  // User statistics endpoints
  GET_USER_STATS: `${API_URL}/api/stats/user`,
};

export default API_URL; 