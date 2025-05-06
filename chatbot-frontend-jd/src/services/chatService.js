import serviceFactory from './serviceFactory';
import { ENDPOINTS } from '../utils/config';
import axios from '../utils/axios';

const chatService = {
  // Get chat history
  getChatHistory: serviceFactory.createGet(ENDPOINTS.CHAT.HISTORY),

  // Get a specific chat
  getChat: (chatId) => {
    return serviceFactory.createGet(`${ENDPOINTS.CHAT.GET}/${chatId}`)();
  },

  // Start a new chat
  startChat: (initialMessage) => {
    return serviceFactory.createPost(ENDPOINTS.CHAT.START)({ message: initialMessage });
  },

  // Send a message in an existing chat
  sendMessage: (chatId, message) => {
    return serviceFactory.createPost(`${ENDPOINTS.CHAT.SEND}/${chatId}`)({ message });
  },

  // Delete a chat
  deleteChat: (chatId) => {
    return serviceFactory.createDelete(`${ENDPOINTS.CHAT.DELETE}/${chatId}`)();
  },

  // Clear chat history
  clearHistory: serviceFactory.createDelete(ENDPOINTS.CHAT.CLEAR),

  // Get chat suggestions
  getSuggestions: serviceFactory.createGet(ENDPOINTS.CHAT.SUGGESTIONS),

  // Save a chat as favorite
  saveAsFavorite: (chatId) => {
    return serviceFactory.createPost(`${ENDPOINTS.CHAT.FAVORITE}/${chatId}`)();
  },

  // Remove a chat from favorites
  removeFromFavorites: (chatId) => {
    return serviceFactory.createDelete(`${ENDPOINTS.CHAT.FAVORITE}/${chatId}`)();
  },

  // Get favorite chats
  getFavorites: serviceFactory.createGet(ENDPOINTS.CHAT.FAVORITES),

  // Export chat to PDF
  exportToPDF: (chatId) => {
    return async () => {
      try {
        const response = await axios.get(`${ENDPOINTS.CHAT.EXPORT}/${chatId}`, {
          responseType: 'blob'
        });
        return response.data;
      } catch (error) {
        console.error(`Error exporting chat to PDF:`, error);
        throw error;
      }
    };
  },

  // Share chat
  shareChat: (chatId, recipientEmail) => {
    return serviceFactory.createPost(`${ENDPOINTS.CHAT.SHARE}/${chatId}`)({
      recipientEmail
    });
  }
};

export default chatService; 