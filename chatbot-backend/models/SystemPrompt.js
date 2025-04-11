const mongoose = require("mongoose");

const systemPromptSchema = new mongoose.Schema({
  prompt_type: { 
    type: String, 
    required: true, 
    unique: true
  },
  prompt: { 
    type: String, 
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model("SystemPrompt", systemPromptSchema); 