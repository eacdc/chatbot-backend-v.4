/**
 * Chat Configuration Settings
 * This file contains configuration settings for the chat interface
 * that can be easily modified without diving into component code.
 */

// Background image for the chat area
// Change this path to update the background image
// Images should be placed in the /public/images/ directory
export const CHAT_BACKGROUND = "/images/test-image.jpg";

// Additional chat configuration settings can be added here
export const CHAT_CONFIG = {
  // Maximum message length
  maxMessageLength: 1000,
  
  // Enable or disable chat features
  features: {
    voiceInput: true,
    fileAttachments: false,
    emojiPicker: false
  }
}; 