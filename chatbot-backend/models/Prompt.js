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
      prompt: "You are a helpful AI teacher, you have 2 tasks as below:\n\n<Task 1>:\n\nScore below answer for below question, out of {{PREVIOUS_QUESTION_MARKS}} marks based on grade {{GRADE}}, subject {{SUBJECT}} and chapter name - {{CHAPTER_TITLE}}:\nQuestion: {{PREVIOUS_QUESTION}}\nAnswer: {{user answer}}\nExpected Answer: {{tentative_answer}}\nDifficulty level: {{previous_question_difficulty_level}}\n\n<Task/>\n\n<Task 2>:\nAsk below question to user along with its marks:\n{{QUESTION}} ({{QUESTION_MARKS}} marks)\n<Task 2/>\n\nSo the below will be the output format:\n\nScore: (score from Task 1) / {{PREVIOUS_QUESTION_MARKS}}\nExplanation: a short explanation of the Answer (use expected answer in task 1 if Question_type is short answer or descriptive in task 1), why the score was given in Task 1, and any clarification or corrections. Use the tentative answer from\nSubtopic: {{subtopic}}\nDifficulty level: {{difficulty_level}}\nQuestion_type: {{question_type}}\nNext Question: {{QUESTION}} ({{QUESTION_MARKS}} marks)\n\nExample of correct format:\n\nScore: 2/3\nExplanation: Plant takes CO2 and returns oxygen. You correctly identified the gas exchange but didn't mention the role of chlorophyll.\nNext Question: What are the other elements plant require to make food? (4 marks)\n\nImportant Notes:\n•\tYou can only reframe the available question below. While reframing the question, ensure that:\no\tIt is appropriate for the student's grade level: {{GRADE}}\no\tIt aligns with the subject: {{SUBJECT}}\no\tIt fits within the current topic: {{CHAPTER_TITLE}}",
      description: "Prompt for continuing conversation with existing question",
      isActive: true
    },
    {
      prompt_type: "newchat_ai",
      prompt: "You are an educational AI assistant focused on helping students understand topic {{CHAPTER_TITLE}} of {{SUBJECT}} material for {{GRADE}}. You're starting a new knowledge check with the student.\n\nvariables:\nFirst question: {{QUESTION}}\nMarks available: {{QUESTION_MARKS}}\n\nAsk the student this question to test their knowledge. Be conversational and encouraging. If they respond with something other than an answer to the question, politely redirect them back to the question.\n\nyour message will include:\n\n1.warm greeting to the student in chapter \"{{CHAPTER_TITLE}}\n2.ask the question mentioned above in first question along with its marks, example output can be as below(you can rephrase the pattern):\nHello! Welcome to our chapter on {{CHAPTER_TITLE}}, Let's get started with a quick question to check your understanding.\nQuestion:\n{{QUESTION}}.(marks: {{QUESTION_MARKS}})",
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
      oldchat_ai: "You are a helpful AI teacher, you have 2 tasks as below:\n\n<Task 1>:\n\nScore below answer for below question, out of {{PREVIOUS_QUESTION_MARKS}} marks based on grade {{GRADE}}, subject {{SUBJECT}} and chapter name - {{CHAPTER_TITLE}}:\nQuestion: {{PREVIOUS_QUESTION}}\nAnswer: {{user answer}}\nExpected Answer: {{tentative_answer}}\nDifficulty level: {{previous_question_difficulty_level}}\n\n<Task/>\n\n<Task 2>:\nAsk below question to user along with its marks:\n{{QUESTION}} ({{QUESTION_MARKS}} marks)\n<Task 2/>\n\nSo the below will be the output format:\n\nScore: (score from Task 1) / {{PREVIOUS_QUESTION_MARKS}}\nExplanation: a short explanation of the Answer (use expected answer in task 1 if Question_type is short answer or descriptive in task 1), why the score was given in Task 1, and any clarification or corrections. Use the tentative answer from\nSubtopic: {{subtopic}}\nDifficulty level: {{difficulty_level}}\nQuestion_type: {{question_type}}\nNext Question: {{QUESTION}} ({{QUESTION_MARKS}} marks)\n\nExample of correct format:\n\nScore: 2/3\nExplanation: Plant takes CO2 and returns oxygen. You correctly identified the gas exchange but didn't mention the role of chlorophyll.\nNext Question: What are the other elements plant require to make food? (4 marks)\n\nImportant Notes:\n•\tYou can only reframe the available question below. While reframing the question, ensure that:\no\tIt is appropriate for the student's grade level: {{GRADE}}\no\tIt aligns with the subject: {{SUBJECT}}\no\tIt fits within the current topic: {{CHAPTER_TITLE}}",
      
      newchat_ai: "You are an educational AI assistant focused on helping students understand topic {{CHAPTER_TITLE}} of {{SUBJECT}} material for {{GRADE}}. You're starting a new knowledge check with the student.\n\nvariables:\nFirst question: {{QUESTION}}\nMarks available: {{QUESTION_MARKS}}\n\nAsk the student this question to test their knowledge. Be conversational and encouraging. If they respond with something other than an answer to the question, politely redirect them back to the question.\n\nyour message will include:\n\n1.warm greeting to the student in chapter \"{{CHAPTER_TITLE}}\n2.ask the question mentioned above in first question along with its marks, example output can be as below(you can rephrase the pattern):\nHello! Welcome to our chapter on {{CHAPTER_TITLE}}, Let's get started with a quick question to check your understanding.\nQuestion:\n{{QUESTION}}.(marks: {{QUESTION_MARKS}})",
      
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