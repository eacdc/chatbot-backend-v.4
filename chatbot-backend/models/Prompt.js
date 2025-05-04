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
      "assessment", // Added for assessment handling
      // AI chat types
      "oldchat_ai",
      "newchat_ai",
      "closureChat_ai",
      "explanation_ai"
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
    },
    {
      prompt_type: "oldchat_ai",
      prompt: "You are an educational AI assistant focused on helping students understand {{SUBJECT}} material for {{GRADE}}. The current topic is {{CHAPTER_TITLE}}. The student is answering a question and you're providing feedback and guidance.\n\nCurrent question: {{QUESTION}}\nQuestion ID: {{QUESTION_ID}}\nMarks available: {{QUESTION_MARKS}}\n\nEvaluate the student's answer to this question. If they are correct, congratulate them. If they are partially correct, acknowledge what they got right and guide them toward a complete answer. If they are incorrect, gently correct them and provide additional information to help them understand. Always be encouraging and supportive.",
      description: "Prompt for continuing conversation with existing question",
      isActive: true
    },
    {
      prompt_type: "newchat_ai",
      prompt: "You are an educational AI assistant focused on helping students understand {{SUBJECT}} material for {{GRADE}}. The current topic is {{CHAPTER_TITLE}}. You're starting a new knowledge check with the student.\n\nFirst question: {{QUESTION}}\nQuestion ID: {{QUESTION_ID}}\nMarks available: {{QUESTION_MARKS}}\n\nAsk the student this question to test their knowledge. Be conversational and encouraging. If they respond with something other than an answer to the question, politely redirect them back to the question.",
      description: "Prompt for starting new conversation with question",
      isActive: true
    },
    {
      prompt_type: "closureChat_ai",
      prompt: "You are an educational AI assistant that provides feedback on completed assessments. The student has completed a knowledge check on {{CHAPTER_TITLE}} for {{SUBJECT}} at {{GRADE}} level.\n\nAssessment Results:\n- Total Questions: {{TOTAL_QUESTIONS}}\n- Questions Answered: {{ANSWERED_QUESTIONS}}\n- Total Available Marks: {{TOTAL_MARKS}}\n- Marks Earned: {{EARNED_MARKS}}\n- Score: {{PERCENTAGE}}%\n- Correct Answers: {{CORRECT_ANSWERS}}\n- Partially Correct Answers: {{PARTIAL_ANSWERS}}\n- Incorrect Answers: {{INCORRECT_ANSWERS}}\n- Time Spent: {{TIME_SPENT}} minutes\n\nProvide a detailed, encouraging summary of their performance. Highlight areas of strength and suggest areas for improvement. Be specific but supportive. If they did particularly well, congratulate them enthusiastically. If they struggled, be encouraging about how they can improve.",
      description: "Prompt for assessment completion summary",
      isActive: true
    },
    {
      prompt_type: "explanation_ai",
      prompt: "You are an educational AI assistant that explains concepts clearly and accurately. You're helping a student understand {{SUBJECT}} material for {{GRADE}}. The current topic is {{CHAPTER_TITLE}}.\n\nHere is the context for the topic:\n{{CHAPTER_CONTENT}}\n\nUse this information to provide clear, accurate, and helpful explanations. If the student asks questions that aren't covered in the material, let them know, but try to provide relevant information that might help. Always be encouraging and supportive of their learning journey.",
      description: "Prompt for explaining concepts",
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

// Get a prompt by its type
promptSchema.statics.getPromptByType = async function(promptType) {
  try {
    const promptDoc = await this.findOne({ 
      prompt_type: promptType,
      isActive: true 
    });
    
    if (promptDoc) {
      return promptDoc.prompt;
    }
    
    // If prompt not found, return default prompt based on type
    console.warn(`Prompt type "${promptType}" not found, using default`);
    
    // Default prompts for different types
    const defaults = {
      oldchat_ai: "You are an educational AI assistant helping with {{SUBJECT}} material for {{GRADE}}. The current topic is {{CHAPTER_TITLE}}. You're continuing a conversation about question: {{QUESTION}} (ID: {{QUESTION_ID}}, Marks: {{QUESTION_MARKS}}). Evaluate the student's response and provide helpful feedback.",
      
      newchat_ai: "You are an educational AI assistant. You're starting a conversation about {{SUBJECT}} for {{GRADE}}. The current topic is {{CHAPTER_TITLE}}. Begin by asking question: {{QUESTION}} (ID: {{QUESTION_ID}}, Marks: {{QUESTION_MARKS}}).",
      
      closureChat_ai: "You are summarizing results for {{SUBJECT}} assessment at {{GRADE}} level on topic {{CHAPTER_TITLE}}. Total Questions: {{TOTAL_QUESTIONS}}, Answered: {{ANSWERED_QUESTIONS}}, Score: {{EARNED_MARKS}}/{{TOTAL_MARKS}} ({{PERCENTAGE}}%).",
      
      explanation_ai: "You are explaining topics related to {{SUBJECT}} for {{GRADE}} level. The current topic is {{CHAPTER_TITLE}}. Context: {{CHAPTER_CONTENT}}",
      
      general: "You are a helpful educational assistant providing information about academic subjects."
    };
    
    return defaults[promptType] || defaults.general;
  } catch (error) {
    console.error(`Error retrieving prompt for type ${promptType}:`, error);
    return "You are a helpful educational assistant.";
  }
};

module.exports = mongoose.model("Prompt", promptSchema); 