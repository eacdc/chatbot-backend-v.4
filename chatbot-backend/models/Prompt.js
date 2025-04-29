const mongoose = require("mongoose");

const promptSchema = new mongoose.Schema({
  prompt_type: { 
    type: String, 
    required: true, 
    unique: true,
    // Add common agent types
    enum: [
      // Standard system prompts
      "goodText", 
      "qna", 
      "finalPrompt", 
      "questionPrompt",
      // Agent types
      "general", 
      "math", 
      "science", 
      "literature", 
      "history", 
      "language", 
      "programming",
      "physics",
      "chemistry",
      "biology",
      "assessment" // Added for assessment handling
    ]
  },
  prompt: { 
    type: String, 
    required: true
  },
  description: {
    type: String,
    default: "System prompt for the AI"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Initialize default agent prompts if they don't exist
promptSchema.statics.initDefaults = async function() {
  const defaults = [
    {
      prompt_type: "general",
      prompt: "You are a helpful AI assistant that discusses books and literature. You provide informative, friendly responses that help students learn.",
      description: "Default general assistant prompt",
      isActive: true
    },
    {
      prompt_type: "math",
      prompt: "You are a math tutor specializing in helping students understand mathematical concepts. Explain step-by-step solutions to problems, and provide clear, logical reasoning.",
      description: "Math tutor prompt",
      isActive: true
    },
    {
      prompt_type: "science",
      prompt: "You are a science educator who explains scientific concepts clearly and accurately. Use examples and analogies to help students understand complex topics.",
      description: "Science educator prompt",
      isActive: true
    },
    {
      prompt_type: "literature",
      prompt: "You are a literature professor who analyzes texts, themes, and literary techniques. Help students understand and appreciate literary works.",
      description: "Literature professor prompt",
      isActive: true
    },
    {
      prompt_type: "assessment",
      prompt: "You are an assessment AI focused on evaluating student answers. Grade the answer based solely on its content and correctness. Be objective and do not provide additional explanations or teaching. Focus only on determining if the answer is correct and awarding appropriate marks. After your assessment, ALWAYS include a line with 'MARKS: X/Y' at the end, where X is the marks awarded and Y is the total possible marks.",
      description: "Assessment grading prompt",
      isActive: true
    }
  ];

  for (const config of defaults) {
    const exists = await this.findOne({ prompt_type: config.prompt_type });
    if (!exists) {
      console.log(`Creating default prompt for ${config.prompt_type}`);
      await this.create(config);
    }
  }
};

module.exports = mongoose.model("Prompt", promptSchema); 