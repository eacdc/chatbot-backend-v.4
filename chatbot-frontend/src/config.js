// Directly set the API URL to ensure it's always available
const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://chatbot-backend-v-4.onrender.com'
  : 'http://localhost:5000';

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
  
  // Score and statistics endpoints
  GET_RECENT_ACTIVITY: `${API_URL}/api/scores/recent-activity/:userId`,
  GET_SCOREBOARD: `${API_URL}/api/scores/scoreboard/:userId`,
  GET_PROGRESS_DETAILS: `${API_URL}/api/scores/progress-details/:userId`,
  GET_ASSESSMENT_DATA: `${API_URL}/api/scores/assessment-data/:userId`,
  GET_PERFORMANCE_OVERVIEW: `${API_URL}/api/scores/performance-overview/:userId`,
  
  // New Search and Collection APIs
  SEARCH_BOOKS: `${API_URL}/api/books/search`,
  SEARCH_SUGGESTIONS: `${API_URL}/api/books/search-suggestions`,
  GET_USER_COLLECTION: `${API_URL}/api/subscriptions/collection`,
  GET_COLLECTION_SUMMARY: `${API_URL}/api/subscriptions/collection/summary`,
  
  // User stats endpoints
  GET_USER_STATS: `${API_URL}/api/stats/user/:userId`,
  GET_USER_STATS_NEW: `${API_URL}/api/stats-new/user/:userId`,
  
  // Notification endpoints
  GET_NOTIFICATIONS: `${API_URL}/api/notifications`,
  
  // Admin endpoints
  ADMIN_DASHBOARD: `${API_URL}/api/admin/dashboard`,
  ADMIN_USERS: `${API_URL}/api/admin/users`,
  ADMIN_BOOKS: `${API_URL}/api/admin/books`,
  ADMIN_CHAPTERS: `${API_URL}/api/admin/chapters`,
  
  // Prompt management
  GET_PROMPTS: `${API_URL}/api/prompts`,
  UPDATE_PROMPT: `${API_URL}/api/prompts/:type`,
  
  // Config endpoints
  GET_CONFIG: `${API_URL}/api/config`,
  UPDATE_CONFIG: `${API_URL}/api/config/:key`,
  
  // Reset endpoints
  RESET_QUESTIONS: `${API_URL}/api/chat/reset-questions/:chapterId`,
  GET_PROGRESSION_STATUS: `${API_URL}/api/chat/progression-status/:chapterId`,
  
  // Test endpoints
  TEST_UPLOAD: `${API_URL}/api/books/test-upload`,
  FIX_ZERO_SCORES: `${API_URL}/api/chat/fix-zero-scores/:chapterId`
};

// Export the base URL as well for direct usage
export { API_URL }; 