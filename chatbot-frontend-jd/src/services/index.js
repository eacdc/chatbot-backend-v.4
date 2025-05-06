// Import all services

// Authentication & User Management
import authService from './authService';
import userService from './userService';
import securityService from './securityService';

// Content Management
import chapterService from './chapterService';
import fileService from './fileService';
import searchService from './searchService';
import tagsService from './tagsService';

// Chat & Interaction
import chatService from './chatService';
import suggestionsService from './suggestionsService';
import feedbackService from './feedbackService';
import historyService from './historyService';
import favoritesService from './favoritesService';
import sharingService from './sharingService';
import exportService from './exportService';
import notificationService from './notificationService';

// Analytics & Monitoring
import analyticsService from './analyticsService';
import statisticsService from './statisticsService';
import monitoringService from './monitoringService';
import performanceService from './performanceService';
import errorService from './errorService';
import loggingService from './loggingService';

// System & Configuration
import settingsService from './settingsService';
import backupService from './backupService';

// Utils & Factories
import serviceFactory from './serviceFactory';

// Export services by category
export const Auth = {
  auth: authService,
  user: userService,
  security: securityService
};

export const Content = {
  chapters: chapterService,
  files: fileService,
  search: searchService,
  tags: tagsService
};

export const Chat = {
  chat: chatService,
  suggestions: suggestionsService,
  feedback: feedbackService,
  history: historyService,
  favorites: favoritesService,
  sharing: sharingService,
  export: exportService,
  notifications: notificationService
};

export const Analytics = {
  analytics: analyticsService,
  statistics: statisticsService,
  monitoring: monitoringService,
  performance: performanceService,
  errors: errorService,
  logs: loggingService
};

export const System = {
  settings: settingsService,
  backup: backupService
};

// Export all services as a flat structure for backward compatibility
export {
  authService,
  userService,
  securityService,
  chapterService,
  fileService,
  searchService,
  tagsService,
  chatService,
  suggestionsService,
  feedbackService,
  historyService,
  favoritesService,
  sharingService,
  exportService,
  notificationService,
  analyticsService,
  statisticsService,
  monitoringService,
  performanceService,
  errorService,
  loggingService,
  settingsService,
  backupService,
  serviceFactory
};

// Default export for all services
export default {
  Auth,
  Content,
  Chat,
  Analytics,
  System,
  serviceFactory
}; 