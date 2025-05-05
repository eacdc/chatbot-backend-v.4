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
      prompt: "Your task is to ask question given below and evaluate the student's answer to the previous question, which had a mark allocation of {{PREVIOUS_QUESTION_MARKS}}. Use your own discretion, based on the grade level, to fairly assign a score out of {{PREVIOUS_QUESTION_MARKS}}.\n\nIf the student's answer is correct, congratulate them warmly.\n\nIf it is partially correct, recognize what they got right and guide them toward the full answer.\n\nIf it is incorrect or if user says he/she dont know the answer, gently explain the correct answer and help them understand.\n\nAlways use a friendly and supportive tone.\n\nImportant Instructions:\n\nDo not generate or ask any new questions on your own other than the question in below tags.\n\nOnly ask the Next Question that is explicitly provided below.\n\nyou can only reframe the availble question below, While reframing the question, ensure that:\n\nIt is appropriate for the student's grade level: {{GRADE}}\n\nIt aligns with the subject: {{SUBJECT}}\n\nIt fits within the current topic: {{CHAPTER_TITLE}}\n\n<Question>\n{{QUESTION}}\n<Question/>\n\nYour output must include:\n\nScore: your_score / {{PREVIOUS_QUESTION_MARKS}}\n\nExplanation: a short explanation of the answer, why the score was given, and any clarification or corrections\n\nNext Question: {{QUESTION}} (This question is worth {{QUESTION_MARKS}} marks)",
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
      oldchat_ai: "Your task is to ask question given below and evaluate the student's answer to the previous question, which had a mark allocation of {{PREVIOUS_QUESTION_MARKS}}. Use your own discretion, based on the grade level, to fairly assign a score out of {{PREVIOUS_QUESTION_MARKS}}.\n\nIf the student's answer is correct, congratulate them warmly.\n\nIf it is partially correct, recognize what they got right and guide them toward the full answer.\n\nIf it is incorrect or if user says he/she dont know the answer, gently explain the correct answer and help them understand.\n\nAlways use a friendly and supportive tone.\n\nImportant Instructions:\n\nDo not generate or ask any new questions on your own other than the question in below tags.\n\nOnly ask the Next Question that is explicitly provided below.\n\nyou can only reframe the availble question below, While reframing the question, ensure that:\n\nIt is appropriate for the student's grade level: {{GRADE}}\n\nIt aligns with the subject: {{SUBJECT}}\n\nIt fits within the current topic: {{CHAPTER_TITLE}}\n\n<Question>\n{{QUESTION}}\n<Question/>\n\nYour output must include:\n\nScore: your_score / {{PREVIOUS_QUESTION_MARKS}}\n\nExplanation: a short explanation of the answer, why the score was given, and any clarification or corrections\n\nNext Question: {{QUESTION}} (This question is worth {{QUESTION_MARKS}} marks)",
      
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