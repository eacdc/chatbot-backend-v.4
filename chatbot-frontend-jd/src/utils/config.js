// API Configuration
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Authentication Configuration
export const TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

// Route Configuration
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  PROFILE: '/profile',
  DASHBOARD: '/dashboard',
  CHAPTERS: '/chapters',
  CHAPTER_DETAIL: '/chapters/:id',
  QNA: '/qna',
  SETTINGS: '/settings',
  UNAUTHORIZED: '/unauthorized',
  NOT_FOUND: '/404'
};

// Theme Configuration
export const THEME = {
  PRIMARY_COLOR: '#1976d2',
  SECONDARY_COLOR: '#dc004e',
  BACKGROUND_COLOR: '#f5f5f5',
  TEXT_COLOR: '#333333',
  ERROR_COLOR: '#f44336',
  SUCCESS_COLOR: '#4caf50',
  WARNING_COLOR: '#ff9800'
};

// API Endpoints
export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile'
  },
  USER: {
    PROFILE: '/user/profile',
    UPDATE: '/user/update',
    EXPORT: '/user/export'
  },
  CHAPTERS: {
    LIST: '/chapters',
    DETAIL: '/chapters/:id',
    CREATE: '/chapters',
    UPDATE: '/chapters/:id',
    DELETE: '/chapters/:id'
  },
  PROMPTS: {
    LIST: '/prompts',
    DETAIL: '/prompts/:type',
    UPDATE: '/prompts/:type'
  },
  CHAT: {
    HISTORY: '/chat/history',
    START: '/chat/start',
    SEND: '/chat/send',
    DELETE: '/chat/delete',
    CLEAR: '/chat/clear',
    SUGGESTIONS: '/chat/suggestions',
    FAVORITE: '/chat/favorite',
    UNFAVORITE: '/chat/unfavorite',
    EXPORT: '/chat/export',
    SHARE: '/chat/share'
  },
  FAVORITES: {
    LIST: '/favorites',
    ADD: '/favorites/add',
    REMOVE: '/favorites/remove',
    EXPORT: '/favorites/export'
  },
  HISTORY: {
    LIST: '/history',
    DETAIL: '/history/:id',
    DELETE: '/history/:id',
    CLEAR: '/history/clear',
    EXPORT: '/history/export'
  },
  FEEDBACK: {
    SUBMIT: '/feedback/submit',
    LIST: '/feedback/list',
    DETAIL: '/feedback/:id',
    STATS: '/feedback/stats',
    EXPORT: '/feedback/export'
  },
  SHARING: {
    SHARE: '/sharing/share',
    LIST: '/sharing/list',
    DETAIL: '/sharing/:id',
    REVOKE: '/sharing/:id',
    SETTINGS: '/sharing/settings'
  },
  SUGGESTIONS: {
    LIST: '/suggestions',
    RELATED: '/suggestions/related',
    POPULAR: '/suggestions/popular',
    TRENDING: '/suggestions/trending',
    SUBMIT: '/suggestions/submit'
  },
  TAGS: {
    LIST: '/tags',
    POPULAR: '/tags/popular',
    ADD: '/tags/add',
    REMOVE: '/tags/remove',
    SEARCH: '/tags/search',
    RELATED: '/tags/related'
  },
  STATISTICS: {
    USAGE: '/statistics/usage',
    PERFORMANCE: '/statistics/performance',
    USER: '/statistics/user',
    CONTENT: '/statistics/content',
    TRENDS: '/statistics/trends',
    EXPORT: '/statistics/export'
  },
  ERROR: {
    REPORT: '/error/report',
    LOGS: '/error/logs',
    DETAIL: '/error/:id',
    UPDATE_STATUS: '/error/:id/status',
    ASSIGN: '/error/:id/assign',
    STATS: '/error/stats',
    TRENDS: '/error/trends',
    CATEGORIES: '/error/categories',
    BY_CATEGORY: '/error/category/:categoryId',
    RESOLUTION_TIME: '/error/:id/resolution-time',
    IMPACT: '/error/:id/impact',
    DEPENDENCIES: '/error/:id/dependencies',
    EXPORT: '/error/export',
    NOTIFICATIONS: '/error/notifications',
    NOTIFICATION_SETTINGS: '/error/notification-settings'
  },
  PERFORMANCE: {
    OVERALL: '/performance/overall',
    API: '/performance/api',
    DATABASE: '/performance/database',
    FRONTEND: '/performance/frontend',
    BACKEND: '/performance/backend',
    RESOURCES: '/performance/resources',
    ALERTS: '/performance/alerts',
    TRENDS: '/performance/trends',
    BOTTLENECKS: '/performance/bottlenecks',
    RECOMMENDATIONS: '/performance/recommendations',
    REALTIME: '/performance/realtime',
    COMPARISON: '/performance/comparison',
    EXPORT: '/performance/export',
    DASHBOARD: '/performance/dashboard',
    ALERT_SETTINGS: '/performance/alert-settings'
  },
  MONITORING: {
    SYSTEM_HEALTH: '/monitoring/system-health',
    SERVICE_STATUS: '/monitoring/service/:id',
    ALL_SERVICES: '/monitoring/services',
    RESOURCE: '/monitoring/resource',
    METRICS: '/monitoring/metrics',
    SERVICE_METRICS: '/monitoring/service/:id/metrics',
    ALERTS: '/monitoring/alerts',
    ALERT_STATUS: '/monitoring/alert/:id/status',
    DASHBOARD: '/monitoring/dashboard',
    LOGS: '/monitoring/logs',
    CONFIG: '/monitoring/config',
    STATS: '/monitoring/stats',
    EXPORT: '/monitoring/export',
    REALTIME: '/monitoring/realtime',
    THRESHOLDS: '/monitoring/thresholds'
  },
  LOGGING: {
    APPLICATION: '/logs/application',
    ERROR: '/logs/error',
    ACCESS: '/logs/access',
    SECURITY: '/logs/security',
    AUDIT: '/logs/audit',
    DETAIL: '/logs/:id',
    SEARCH: '/logs/search',
    STATS: '/logs/stats',
    EXPORT: '/logs/export',
    LEVELS: '/logs/levels',
    LEVEL: '/logs/level',
    RETENTION: '/logs/retention',
    PATTERNS: '/logs/patterns',
    PATTERN: '/logs/pattern',
    REALTIME: '/logs/realtime'
  },
  BACKUP: {
    CREATE: '/backup/create',
    LIST: '/backup/list',
    DETAIL: '/backup/:id',
    DELETE: '/backup/:id',
    RESTORE: '/backup/:id/restore',
    DOWNLOAD: '/backup/:id/download',
    STATUS: '/backup/:id/status',
    CANCEL: '/backup/:id/cancel',
    SCHEDULE: '/backup/schedule',
    STATS: '/backup/stats',
    CONFIG: '/backup/config',
    VERIFY: '/backup/:id/verify',
    LOGS: '/backup/:id/logs',
    STORAGE: '/backup/storage',
    CLEANUP: '/backup/cleanup'
  },
  EXPORT: {
    CHAT: '/export/chat',
    USER_DATA: '/export/user-data',
    HISTORY: '/export/history',
    STATS: '/export/statistics',
    LOGS: '/export/logs',
    CONFIG: '/export/config',
    BACKUPS: '/export/backups'
  },
  ANALYTICS: {
    USER: '/analytics/user',
    CHAT: '/analytics/chat',
    CONTENT: '/analytics/content',
    TRENDS: '/analytics/trends',
    ENGAGEMENT: '/analytics/engagement',
    QUERY_PATTERNS: '/analytics/query-patterns',
    PERFORMANCE: '/analytics/performance',
    RETENTION: '/analytics/retention',
    FEEDBACK: '/analytics/feedback',
    MODEL_PERFORMANCE: '/analytics/model-performance',
    DEMOGRAPHICS: '/analytics/demographics',
    SESSIONS: '/analytics/sessions',
    EXPORT: '/analytics/export',
    CUSTOM_REPORT: '/analytics/custom-report',
    SAVED_REPORTS: '/analytics/saved-reports'
  },
  SETTINGS: {
    USER: '/settings/user',
    APP: '/settings/app',
    NOTIFICATIONS: '/settings/notifications',
    PRIVACY: '/settings/privacy',
    APPEARANCE: '/settings/appearance',
    LANGUAGE: '/settings/language',
    ACCESSIBILITY: '/settings/accessibility',
    INTEGRATIONS: '/settings/integrations',
    EXPORT: '/settings/export',
    IMPORT: '/settings/import',
    RESET: '/settings/reset'
  },
  FILE: {
    UPLOAD: '/file/upload',
    DOWNLOAD: '/file/:id',
    LIST: '/file/list',
    DELETE: '/file/:id',
    METADATA: '/file/:id/metadata',
    SHARE: '/file/:id/share'
  }
};

// Local Storage Keys
export const STORAGE_KEYS = {
  USER: 'user',
  THEME: 'theme',
  LANGUAGE: 'language'
};

// Pagination
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

// Timeouts
export const API_TIMEOUT = 30000; // 30 seconds
export const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes 