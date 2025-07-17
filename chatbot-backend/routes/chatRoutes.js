const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const Chapter = require("../models/Chapter");
const OpenAI = require("openai");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const authenticateUser = require("../middleware/authMiddleware");
const Prompt = require("../models/Prompt");
const Config = require("../models/Config");
const Book = require("../models/Book");
const QnALists = require("../models/QnALists");
const { storeAudio, getAudioStream, getAudioUrl } = require('../utils/gridfs');
const ffmpeg = require("fluent-ffmpeg");

// Initialize default configs if needed
(async () => {
  try {
    await Config.initDefaults();
  } catch (error) {
    console.error("Error initializing config defaults:", error);
  }
})();

// Function to get questionMode config - always enabled now
async function isQuestionModeEnabled() {
  // Always return true - question mode is always enabled
  return true;
}

if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: Missing OpenAI API Key in environment variables.");
    process.exit(1);
}

// Create an OpenAI client using DeepSeek for chat completions
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_D, baseURL: 'https://api.deepseek.com' });

// Create a separate OpenAI client for agent selection using the standard OpenAI API
const openaiSelector = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Create a separate OpenAI client for audio transcription using the standard OpenAI API
const openaiTranscription = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configure multer storage for audio files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, "../uploads");
        // Create the directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename with timestamp
        const uniqueFilename = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        // Accept audio files only
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error("Only audio files are allowed!"), false);
        }
    }
});

// Add a map to track previous questions for each user-chapter pair
const previousQuestionsMap = new Map();

// Function to beautify oldchat_ai responses using GPT-4.1
async function beautifyBotResponse(message) {
    if (!message || typeof message !== 'string') {
        return message;
    }
    
    try {
        const beautifyResponse = await openaiSelector.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                {
                    role: "system",
                    content: `You are a text formatter. Your job is to take educational chatbot responses and make them beautifully formatted and easy to read.

CRITICAL RULES - MUST FOLLOW EXACTLY:
1. PRESERVE ALL ORIGINAL CONTENT: Do not change, add, remove, or modify any text, emojis, symbols, or formatting
2. PRESERVE ALL EMOJIS: Keep every emoji exactly as it appears in the original message
3. PRESERVE ALL FORMATTING: Keep all existing markdown, bullet points, numbering, and text styling
4. PRESERVE ALL SYMBOLS: Keep mathematical symbols, unicode characters, and special characters exactly as they are
5. Only add line breaks and spacing for better readability
6. Use clear visual separators between different sections if needed
7. Keep the original tone, style, and all content completely unchanged
8. Return only the formatted text with preserved emojis and formatting
9. If the original message already has good formatting and emojis, return it exactly as is

Your job is ONLY to improve spacing and line breaks while keeping 100% of the original content, emojis, and formatting intact.

DO NOT:
- Remove or change any emojis
- Remove or change any formatting
- Modify any text content
- Add new content
- Change the tone or style`
                },
                {
                    role: "user", 
                    content: message
                }
            ],
            temperature: 0,
            max_tokens: 1500
        });
        
        return beautifyResponse.choices[0].message.content.trim();
    } catch (error) {
        console.error("Error beautifying response:", error);
        // Return original message if beautification fails
        return message;
    }
}

// Send Message & Get AI Response with Question Prompts
router.post("/send", authenticateUser, async (req, res) => {
    try {
        const { userId, message, chapterId } = req.body;
        // Initialize variables for scoring that will be used later in the function
        let marksAwarded = 0;
        let maxScore = 1;

        if (!userId || !message || !chapterId) {
            return res.status(400).json({ error: "User ID, chapter ID, and message are required" });
        }

        // Get the questionMode config
        const questionModeEnabled = await isQuestionModeEnabled();

        // Handle chapter-specific chats
        let chat;
        let currentQuestion = null;
        let previousQuestion = null;
        let currentScore = null;
        let previousMessages = [];
        let bookGrade = null;
        let bookSubject = null;
        let bookId = null;
        let chapterTitle = "General Chapter";
        
        // Initialize classification with a default value
        let classification = "explanation_ai"; // Default classification
        
        // Check if there's a previous question for this user-chapter combination
        const userChapterKey = `${userId}-${chapterId}`;
        if (previousQuestionsMap.has(userChapterKey)) {
            previousQuestion = previousQuestionsMap.get(userChapterKey);
            console.log(`Found previous question for ${userChapterKey}: ${previousQuestion.question ? previousQuestion.question.substring(0, 30) + '...' : 'No question text'}`);
        }
        
            chat = await Chat.findOne({ userId, chapterId });
        
        // Get previous messages for context
        if (chat && chat.messages && chat.messages.length > 0) {
            if (classification === "explanation_ai") {
                // For explanation agent, use more context - last 6 messages
            previousMessages = chat.messages.slice(-6);
            } else {
                // For other agents, use only the last assistant message + current user message
                const assistantMessages = chat.messages.filter(msg => msg.role === "assistant").slice(-1);
                const userMessages = chat.messages.filter(msg => msg.role === "user").slice(-1);
                previousMessages = [...assistantMessages, ...userMessages];
            }
        }
        
        if (!chat) {
            chat = new Chat({ 
                userId, 
                chapterId, 
                messages: [],
                metadata: {}
            });
        }
            
            // Fetch chapter details
            try {
                const chapter = await Chapter.findById(chapterId);
            
            if (!chapter) {
                return res.status(404).json({ error: "Chapter not found" });
            }
            
            // Get associated book information for grade level and subject
            chapterTitle = chapter.title || "General Chapter";
            
            try {
                const book = await Book.findById(chapter.bookId);
                if (book) {
                    bookId = book._id;
                    bookSubject = book.subject || "General";
                    bookGrade = book.grade;
                }
            } catch (bookErr) {
                console.error("Error fetching book information:", bookErr);
            }

            // Get the last 3 messages from the chat history for context
            const lastThreeMessages = previousMessages.slice(-6).filter(msg => msg.role === 'user' || msg.role === 'assistant').slice(-6);
            
            // Create messages array for the classifier with chat history
           const intentAnalysisMessages = [
  {
    role: "system",
    content: `You are an AI that classifies user messages into exactly one of the following four categories:

- "oldchat_ai"
- "newchat_ai"
- "closureChat_ai"
- "explanation_ai"

Your job is to read the user's latest message and the recent chat history, and classify the intent into one of these categories.

Respond only with a JSON object like this:
{ "agent": "oldchat_ai" }

Rules:
1. "oldchat_ai":
   - Ongoing conversation (not a greeting)
   - User is continuing a knowledge check or answering a question
   - select this agent even if user says he/she dont know the answer

2. "newchat_ai":
   - First message, like "Hi", "Hello"
   - User says they are ready to begin
   - No previous question in session

3. "closureChat_ai":
   - User wants to stop, see score, or end assessment
   - Says: "finish", "stop", "done", "end", "that's all"

4. "explanation_ai":
   - Asking for explanation or clarification
   - Not an answer, but a question about the topic
   - General doubt or concept help

Return only the JSON object. Do not include anything else.`,
  },
];
            
            // Add chat history
            lastThreeMessages.forEach(msg => {
                intentAnalysisMessages.push({ role: msg.role, content: msg.content });
            });
            
            // Add the current user message
            intentAnalysisMessages.push({ role: "user", content: message });

            // Call OpenAI to get the agent classification
            try {
                const intentAnalysis = await openaiSelector.chat.completions.create({
                    model: "gpt-4.1",
                    messages: intentAnalysisMessages,
                    temperature: 0,  // Using temperature 0 for consistent, deterministic outputs
                });

                // Extract the classification
               const responseContent = intentAnalysis.choices[0].message.content.trim();
  const result = JSON.parse(responseContent);
  classification = result.agent;
                
                // Log the selected agent
                console.log(`Selected agent: "${classification}"`);
            } catch (selectorError) {
                console.error("ERROR in agent selection:", selectorError);
                // Using the default classification set above
                console.log(`FALLBACK: Using default agent "${classification}"`);
            }

            // Handle questions differently based on context
            if (chapter.questionPrompt && chapter.questionPrompt.length > 0) {
                
                // Special case for assessment or explanation mode
                if (questionModeEnabled && classification === "oldchat_ai" || classification === "newchat_ai") {
                    
                    // For assessment mode, we want to select a specific question based on subtopic progression
                    // Check if the user has answered any questions yet for this chapter
                    const answeredQuestionIds = [];
                    try {
                        // Get all questions the user has answered for this chapter
                        const answeredQuestions = await QnALists.getAnsweredQuestionsForChapter(userId, chapterId);
                        answeredQuestions.forEach(q => answeredQuestionIds.push(q.questionId));
                    } catch (error) {
                        // If there's an error, assume no questions answered
                    }
                    
                    // Get or initialize progression tracking from chat metadata
                    if (!chat.metadata) {
                        chat.metadata = {};
                    }
                    
                    if (!chat.metadata.progressionTracker) {
                        chat.metadata.progressionTracker = {
                            currentDifficulty: "Easy",
                            subtopicsCompleted: {
                                Easy: [],
                                Medium: [],
                                Hard: []
                            }
                        };
                    }
                    
                    const progressionTracker = chat.metadata.progressionTracker;
                    
                    // Get all unique subtopics from chapter questions
                    const allSubtopics = [...new Set(chapter.questionPrompt.map(q => q.subtopic).filter(s => s))]
                    console.log(`Available subtopics: ${allSubtopics.join(', ')}`);
                    
                    // Function to select question based on progression rules
                    function selectQuestionByProgression() {
                        const currentDifficulty = progressionTracker.currentDifficulty;
                        console.log(`Current difficulty level: ${currentDifficulty}`);
                        
                        // Initialize lastSubtopic in progressionTracker if it doesn't exist
                        if (!progressionTracker.lastSubtopic) {
                            progressionTracker.lastSubtopic = "";
                        }
                        
                        // Filter questions by current difficulty level
                        const questionsAtCurrentDifficulty = chapter.questionPrompt.filter(q => 
                            q.difficultyLevel === currentDifficulty && 
                            !answeredQuestionIds.includes(q.questionId)
                        );
                        
                        if (questionsAtCurrentDifficulty.length === 0) {
                            console.log(`No unanswered questions at ${currentDifficulty} difficulty`);
                            return null;
                        }
                        
                        // Get subtopics that haven't been completed at current difficulty
                        const completedSubtopics = progressionTracker.subtopicsCompleted[currentDifficulty];
                        const remainingSubtopics = allSubtopics.filter(subtopic => 
                            !completedSubtopics.includes(subtopic)
                        );
                        
                        console.log(`Completed subtopics at ${currentDifficulty}: ${completedSubtopics.join(', ')}`);
                        console.log(`Remaining subtopics at ${currentDifficulty}: ${remainingSubtopics.join(', ')}`);
                        console.log(`Last subtopic used: ${progressionTracker.lastSubtopic || 'None'}`);
                        
                        let selectedQuestion = null;
                        
                        if (remainingSubtopics.length > 0) {
                            // Filter out the last subtopic to prevent back-to-back repetition
                            const availableSubtopics = remainingSubtopics.filter(subtopic => 
                                subtopic !== progressionTracker.lastSubtopic || remainingSubtopics.length === 1
                            );
                            
                            // If all remaining subtopics are the same as the last one, just use what we have
                            const subtopicsToUse = availableSubtopics.length > 0 ? availableSubtopics : remainingSubtopics;
                            
                            // Select a random subtopic from available ones (that's not the same as last time)
                            const randomSubtopicIndex = Math.floor(Math.random() * subtopicsToUse.length);
                            const targetSubtopic = subtopicsToUse[randomSubtopicIndex];
                            
                            console.log(`Last subtopic: ${progressionTracker.lastSubtopic}`);
                            console.log(`Selected new subtopic: ${targetSubtopic}`);
                            
                            // Update the lastSubtopic in the tracker
                            progressionTracker.lastSubtopic = targetSubtopic;
                            
                            // Find questions from the target subtopic at current difficulty
                            const subtopicQuestions = questionsAtCurrentDifficulty.filter(q => 
                                q.subtopic === targetSubtopic
                            );
                            
                            if (subtopicQuestions.length > 0) {
                                // Select a random question from the target subtopic
                                const randomQuestionIndex = Math.floor(Math.random() * subtopicQuestions.length);
                                selectedQuestion = subtopicQuestions[randomQuestionIndex];
                                
                                // Mark this subtopic as completed for current difficulty only if all questions used
                                const unansweredQuestionsInSubtopic = questionsAtCurrentDifficulty.filter(q => 
                                    q.subtopic === targetSubtopic && 
                                    !answeredQuestionIds.includes(q.questionId)
                                ).length;
                                
                                // If this was the last question in the subtopic, mark it as completed
                                if (unansweredQuestionsInSubtopic <= 1 && !completedSubtopics.includes(targetSubtopic)) {
                                    progressionTracker.subtopicsCompleted[currentDifficulty].push(targetSubtopic);
                                    console.log(`Marked subtopic "${targetSubtopic}" as completed for ${currentDifficulty} difficulty`);
                                }
                            }
                        } else {
                            // All subtopics completed at current difficulty, advance to next difficulty
                            if (currentDifficulty === "Easy") {
                                progressionTracker.currentDifficulty = "Medium";
                                // Reset the lastSubtopic when changing difficulty
                                progressionTracker.lastSubtopic = "";
                                console.log(`Advanced to Medium difficulty`);
                                return selectQuestionByProgression(); // Recursive call with new difficulty
                            } else if (currentDifficulty === "Medium") {
                                progressionTracker.currentDifficulty = "Hard";
                                // Reset the lastSubtopic when changing difficulty
                                progressionTracker.lastSubtopic = "";
                                console.log(`Advanced to Hard difficulty`);
                                return selectQuestionByProgression(); // Recursive call with new difficulty
                            } else {
                                // All difficulties completed, select any remaining question
                                const allUnansweredQuestions = chapter.questionPrompt.filter(q => 
                                    !answeredQuestionIds.includes(q.questionId)
                                );
                                
                                if (allUnansweredQuestions.length > 0) {
                                    // Avoid the same subtopic as the last question if possible
                                    const filteredQuestions = allUnansweredQuestions.filter(q => 
                                        q.subtopic !== progressionTracker.lastSubtopic
                                    );
                                    
                                    // Use filtered questions if available, otherwise use all unanswered
                                    const questionsToChooseFrom = filteredQuestions.length > 0 ? 
                                        filteredQuestions : allUnansweredQuestions;
                                    
                                    const randomIndex = Math.floor(Math.random() * questionsToChooseFrom.length);
                                    selectedQuestion = questionsToChooseFrom[randomIndex];
                                    
                                    // Update the lastSubtopic
                                    if (selectedQuestion && selectedQuestion.subtopic) {
                                        progressionTracker.lastSubtopic = selectedQuestion.subtopic;
                                    }
                                    
                                    console.log(`All progression completed, selected random remaining question from subtopic: ${selectedQuestion.subtopic || 'Unknown'}`);
                                }
                            }
                        }
                        
                        return selectedQuestion;
                    }
                    
                    // Select question using progression logic
                    let questionPrompt = selectQuestionByProgression();
                    
                    // Fallback: if no question selected by progression, select any unanswered question
                    if (!questionPrompt) {
                        const unansweredQuestions = chapter.questionPrompt.filter(q => 
                            !answeredQuestionIds.includes(q.questionId)
                        );
                        
                        if (unansweredQuestions.length > 0) {
                            const randomIndex = Math.floor(Math.random() * unansweredQuestions.length);
                            questionPrompt = unansweredQuestions[randomIndex];
                            console.log(`Fallback: Selected random unanswered question`);
                        } else {
                            // If all questions are answered, randomly select any question
                            const randomIndex = Math.floor(Math.random() * chapter.questionPrompt.length);
                            questionPrompt = chapter.questionPrompt[randomIndex];
                            console.log(`All questions answered. Selected random question for review`);
                        }
                    }
                    
                    if (questionPrompt) {
                        currentQuestion = questionPrompt;
                        currentScore = questionPrompt.question_marks || 1;
                        
                        console.log(`Selected question: ID=${questionPrompt.questionId}`);
                        console.log(`Question: "${questionPrompt.question ? questionPrompt.question.substring(0, 50) + '...' : 'No question text'}"`);
                        console.log(`Subtopic: ${questionPrompt.subtopic || 'No subtopic'}`);
                        console.log(`Difficulty: ${questionPrompt.difficultyLevel || 'No difficulty'}`);
                        console.log(`Marks: ${questionPrompt.question_marks || 1}`);
                        
                        // Save progression tracker back to chat metadata
                        chat.metadata.progressionTracker = progressionTracker;
                        
                        // Log the question marks that will be used
                        console.log(`📊 Question marks for ${classification}: ${currentQuestion.question_marks || 1}`);
                        if (previousQuestion) {
                            console.log(`📊 Previous question marks: ${previousQuestion.question_marks || 1}`);
                        }
                    }
                    
                } else if (classification === "explanation_ai") {
                    // For explanation mode, we'll just use the first question as reference material
                    const questionPrompt = chapter.questionPrompt[0];
                    currentQuestion = questionPrompt;
                }
            }
            
            // Construct the appropriate system prompt based on classification
            let systemPrompt = "";
            
            // Different prompts based on the classification
            if (classification === "oldchat_ai") {
                // Get the oldchat_ai prompt template
                const oldChatPrompt = await Prompt.getPromptByType("oldchat_ai");
                
                // Replace placeholders with actual values
                systemPrompt = oldChatPrompt
                    .replace(/\{\{SUBJECT\}\}/g, bookSubject || "general subject")
                    .replace(/\{\{GRADE\}\}/g, bookGrade || "appropriate grade")
                    .replace(/\{\{CHAPTER_TITLE\}\}/g, chapterTitle || "this chapter")
                    .replace(/\{\{QUESTION\}\}/g, currentQuestion ? currentQuestion.question : "review questions")
                    .replace(/\{\{QUESTION_MARKS\}\}/g, currentQuestion ? currentQuestion.question_marks || 1 : 1)
                    .replace(/\{\{PREVIOUS_QUESTION_MARKS\}\}/g, previousQuestion ? previousQuestion.question_marks || 1 : 1)
                    .replace(/\{\{PREVIOUS_QUESTION\}\}/g, previousQuestion ? previousQuestion.question : "No previous question")
                    .replace(/\{\{user answer\}\}/g, message || "No answer provided")
                    .replace(/\{\{tentative_answer\}\}/g, previousQuestion ? (previousQuestion.tentativeAnswer || "Not provided") : "Not provided")
                    .replace(/\{\{previous_question_type\}\}/g, previousQuestion ? (previousQuestion.question_type || "Not specified") : "Not specified")
                    .replace(/\{\{subtopic\}\}/g, currentQuestion ? (currentQuestion.subtopic || "General") : "General")
                    .replace(/\{\{difficulty_level\}\}/g, currentQuestion ? (currentQuestion.difficultyLevel || "Not specified") : "Not specified")
                    .replace(/\{\{question_type\}\}/g, currentQuestion ? (currentQuestion.question_type || "General") : "General");
                
                // Log the marks values used in the prompt
                console.log(`📊 oldchat_ai prompt replacement - QUESTION_MARKS: ${currentQuestion ? currentQuestion.question_marks || 1 : 1}`);
                console.log(`📊 oldchat_ai prompt replacement - PREVIOUS_QUESTION_MARKS: ${previousQuestion ? previousQuestion.question_marks || 1 : 1}`);
                console.log(`📊 oldchat_ai prompt replacement - PREVIOUS_QUESTION: ${previousQuestion ? previousQuestion.question?.substring(0, 50) + '...' : 'No previous question'}`);
                console.log(`📊 oldchat_ai prompt replacement - USER_ANSWER: ${message?.substring(0, 50) + '...' || 'No answer provided'}`);
                console.log(`📊 oldchat_ai prompt replacement - TENTATIVE_ANSWER: ${previousQuestion ? (previousQuestion.tentativeAnswer?.substring(0, 50) + '...' || 'Not provided') : 'Not provided'}`);
                console.log(`📊 oldchat_ai prompt replacement - PREVIOUS_DIFFICULTY: ${previousQuestion ? (previousQuestion.difficultyLevel || 'Not specified') : 'Not specified'}`);
                console.log(`📊 oldchat_ai prompt replacement - CURRENT_SUBTOPIC: ${currentQuestion ? (currentQuestion.subtopic || 'General') : 'General'}`);
                console.log(`📊 oldchat_ai prompt replacement - CURRENT_DIFFICULTY: ${currentQuestion ? (currentQuestion.difficultyLevel || 'Not specified') : 'Not specified'}`);
                console.log(`📊 oldchat_ai prompt replacement - CURRENT_QUESTION_TYPE: ${currentQuestion ? (currentQuestion.question_type || 'General') : 'General'}`);
                
                // Enhanced debugging - log complete question objects and their key properties
                console.log(`🔍 PLACEHOLDER DEBUG - Previous Question Object:`, {
                    questionId: previousQuestion?.questionId,
                    tentativeAnswer: previousQuestion?.tentativeAnswer,
                    difficultyLevel: previousQuestion?.difficultyLevel,
                    subtopic: previousQuestion?.subtopic,
                    question_type: previousQuestion?.question_type,
                    hasObject: !!previousQuestion
                });
                
                console.log(`🔍 PLACEHOLDER DEBUG - Current Question Object:`, {
                    questionId: currentQuestion?.questionId,
                    tentativeAnswer: currentQuestion?.tentativeAnswer,
                    difficultyLevel: currentQuestion?.difficultyLevel,
                    subtopic: currentQuestion?.subtopic,
                    question_type: currentQuestion?.question_type,
                    hasObject: !!currentQuestion
                });
                
                // Log each placeholder value as it's being used
                console.log(`🔧 PLACEHOLDER VALUES BEING USED:`);
                console.log(`  - {{tentative_answer}}: "${previousQuestion ? (previousQuestion.tentativeAnswer || "Not provided") : "Not provided"}"`);
                console.log(`  - {{previous_question_difficulty_level}}: "${previousQuestion ? (previousQuestion.difficultyLevel || "Not specified") : "Not specified"}"`);
                console.log(`  - {{subtopic}}: "${currentQuestion ? (currentQuestion.subtopic || "General") : "General"}"`);
                console.log(`  - {{difficulty_level}}: "${currentQuestion ? (currentQuestion.difficultyLevel || "Not specified") : "Not specified"}"`);
                console.log(`  - {{question_type}}: "${currentQuestion ? (currentQuestion.question_type || "General") : "General"}"`);
                
            } else if (classification === "newchat_ai") {
                // Get the newchat_ai prompt template
                const newChatPrompt = await Prompt.getPromptByType("newchat_ai");
                
                // Replace placeholders with actual values
                systemPrompt = newChatPrompt
                    .replace(/\{\{SUBJECT\}\}/g, bookSubject || "general subject")
                    .replace(/\{\{GRADE\}\}/g, bookGrade || "appropriate grade")
                    .replace(/\{\{CHAPTER_TITLE\}\}/g, chapterTitle || "this chapter")
                    .replace(/\{\{QUESTION\}\}/g, currentQuestion ? currentQuestion.question : "review questions")
                    .replace(/\{\{QUESTION_ID\}\}/g, currentQuestion ? currentQuestion.questionId : "Q1")
                    .replace(/\{\{QUESTION_MARKS\}\}/g, currentQuestion ? currentQuestion.question_marks || 1 : 1);
                
                // Log the marks values used in the prompt
                console.log(`📊 newchat_ai prompt replacement - QUESTION_MARKS: ${currentQuestion ? currentQuestion.question_marks || 1 : 1}`);
                
            } else if (classification === "closureChat_ai") {
                // Get the closurechat_ai prompt template
                const closureChatPrompt = await Prompt.getPromptByType("closurechat_ai");
                
                // Get stats for the user on this chapter
                const statsForClosure = await QnALists.getChapterStatsForClosure(userId, chapterId);
                
                // Replace placeholders with actual values
                systemPrompt = closureChatPrompt
                    .replace(/\{\{SUBJECT\}\}/g, bookSubject || "general subject")
                    .replace(/\{\{GRADE\}\}/g, bookGrade || "appropriate grade")
                    .replace(/\{\{CHAPTER_TITLE\}\}/g, chapterTitle || "this chapter")
                    .replace(/\{\{TOTAL_QUESTIONS\}\}/g, statsForClosure.totalQuestions)
                    .replace(/\{\{ANSWERED_QUESTIONS\}\}/g, statsForClosure.answeredQuestions)
                    .replace(/\{\{TOTAL_MARKS\}\}/g, statsForClosure.totalMarks)
                    .replace(/\{\{EARNED_MARKS\}\}/g, statsForClosure.earnedMarks)
                    .replace(/\{\{PERCENTAGE\}\}/g, Math.round(statsForClosure.percentage))
                    .replace(/\{\{CORRECT_ANSWERS\}\}/g, statsForClosure.correctAnswers)
                    .replace(/\{\{PARTIAL_ANSWERS\}\}/g, statsForClosure.partialAnswers)
                    .replace(/\{\{INCORRECT_ANSWERS\}\}/g, statsForClosure.incorrectAnswers)
                    .replace(/\{\{TIME_SPENT\}\}/g, statsForClosure.timeSpentMinutes);
                
            } else if (classification === "explanation_ai") {
                // Get the explanation_ai prompt template
                const explanationPrompt = await Prompt.getPromptByType("explanation_ai");
                
                // Replace placeholders with actual values
                systemPrompt = explanationPrompt
                    .replace(/\{\{SUBJECT\}\}/g, bookSubject || "general subject")
                    .replace(/\{\{GRADE\}\}/g, bookGrade || "appropriate grade")
                    .replace(/\{\{CHAPTER_TITLE\}\}/g, chapterTitle || "this chapter")
                    .replace(/\{\{CHAPTER_CONTENT\}\}/g, chapter.prompt || "No specific content available for this chapter.");
            } else {
                // Default to explanation prompt for unrecognized classifications
                const explanationPrompt = await Prompt.getPromptByType("explanation_ai");
                
                // Replace placeholders with actual values
                systemPrompt = explanationPrompt
                    .replace(/\{\{SUBJECT\}\}/g, bookSubject || "general subject")
                    .replace(/\{\{GRADE\}\}/g, bookGrade || "appropriate grade")
                    .replace(/\{\{CHAPTER_TITLE\}\}/g, chapterTitle || "this chapter")
                    .replace(/\{\{CHAPTER_CONTENT\}\}/g, chapter.prompt || "No specific content available for this chapter.");
            }
            
            // Add formatting instructions
            systemPrompt += `\n\nPlease format your response using Markdown for clarity. Use **bold** for important points, *italics* for emphasis, and - for bullet points when listing items.

IMPORTANT FORMATTING INSTRUCTIONS:
1. DO NOT use LaTeX formatting for mathematical expressions under any circumstances.
2. DO NOT use \\( \\frac{a}{b} \\) notation. Instead use simple text like (a/b).
3. DO NOT use syntax like \\text{}, \\frac{}, \\times, or any other LaTeX commands.
4. Format all mathematical operations using plain text:
   - For fractions, use the / symbol: 3/7 instead of \\frac{3}{7}
   - For multiplication, use × or *: 3 × 4 instead of \\times
   - For division, use ÷ or /: 6 ÷ 2 instead of \\div
5. Format complex expressions clearly with parentheses if needed:
   - Use (3/7 × 4/9) instead of \\( \\frac{3}{7} \\times \\frac{4}{9} \\)
   - Use (4/11 × 4/7) instead of \\( \\frac{4}{11} \\times \\frac{4}{7} \\)
6. For lettered items in lists use: a) 3/7 × 4/9 instead of a) \\( \\frac{3}{7} \\times \\frac{4}{9} \\)
7. All mathematical content must use ONLY plain text formatting.
8. ALWAYS format these elements with proper Markdown:
   - **Questions:** Make all questions bold with "**Question:**" prefix 
   - **Scores:** Make scores bold with "**Score:**" prefix (e.g., **Score:** 3/5)
   - **Explanations:** Make explanation headers bold with "**Explanation:**" prefix
   - **Next Question:** Make next question instructions bold with "**Next Question:**" prefix
   - **Important Notes:** Use bold for any important notes or warnings
9. When providing examples or solutions, use code blocks with triple backticks for clear formatting.
10. Use headers appropriately: # for main sections, ## for subsections.`;

            // Check if request is coming from the specified origin and add language instruction
            const requestOrigin = req.headers.origin || req.headers.referer || '';
            if (requestOrigin.includes('chatbot-frontend-v-4-jd-1.onrender.com')) {
                // Pass subject information directly in the prompt without conditional checks
                systemPrompt += `\n\nIMPORTANT LANGUAGE INSTRUCTION:
The subject is "{{SUBJECT}}". If the subject is English or English language, communicate in English. For all other subjects, all communication should be done in French, even the headings like Score,Marks,Explanation,Question,Next Question, etc. Please respond to all questions and interactions in the appropriate language based on this rule.`.replace("{{SUBJECT}}", bookSubject || "general");
                            } else if (requestOrigin.includes('chatbot-backend-v-4.onrender.com')) {
                // Bengali language instruction for the specific origin
                systemPrompt += `\n\nIMPORTANT LANGUAGE INSTRUCTION:
The subject is "{{SUBJECT}}". If the subject is English or English language, communicate in English. For all other subjects, all communication should be done in Bengali, even the headings like Score,Marks,Explanation,Question,Next Question, etc. Please respond to all questions and interactions in the appropriate language based on this rule.`.replace("{{SUBJECT}}", bookSubject || "general");
            }
            
            // If we have no questions or question mode is disabled, default to an explanation prompt
            if (!chapter.questionPrompt || chapter.questionPrompt.length === 0) {
                // Get the explanation_ai prompt template as a fallback
                const explanationPrompt = await Prompt.getPromptByType("explanation_ai");
                
                // Replace placeholders with actual values
                systemPrompt = explanationPrompt
                    .replace(/\{\{SUBJECT\}\}/g, bookSubject || "general subject")
                    .replace(/\{\{GRADE\}\}/g, bookGrade || "appropriate grade")
                    .replace(/\{\{CHAPTER_TITLE\}\}/g, chapterTitle || "this chapter")
                    .replace(/\{\{CHAPTER_CONTENT\}\}/g, chapter.prompt || "No specific content available for this chapter.");
                
                // Add formatting instructions
                systemPrompt += `\n\nPlease format your response using Markdown for clarity. Use **bold** for important points, *italics* for emphasis, and - for bullet points when listing items.

IMPORTANT FORMATTING INSTRUCTIONS:
1. DO NOT use LaTeX formatting for mathematical expressions under any circumstances.
2. DO NOT use \\( \\frac{a}{b} \\) notation. Instead use simple text like (a/b).
3. DO NOT use syntax like \\text{}, \\frac{}, \\times, or any other LaTeX commands.
4. Format all mathematical operations using plain text:
   - For fractions, use the / symbol: 3/7 instead of \\frac{3}{7}
   - For multiplication, use × or *: 3 × 4 instead of \\times
   - For division, use ÷ or /: 6 ÷ 2 instead of \\div
5. Format complex expressions clearly with parentheses if needed:
   - Use (3/7 × 4/9) instead of \\( \\frac{3}{7} \\times \\frac{4}{9} \\)
   - Use (4/11 × 4/7) instead of \\( \\frac{4}{11} \\times \\frac{4}{7} \\)
6. For lettered items in lists use: a) 3/7 × 4/9 instead of a) \\( \\frac{3}{7} \\times \\frac{4}{9} \\)
7. All mathematical content must use ONLY plain text formatting.
8. ALWAYS format these elements with proper Markdown:
   - **Questions:** Make all questions bold with "**Question:**" prefix 
   - **Scores:** Make scores bold with "**Score:**" prefix (e.g., **Score:** 3/5)
   - **Explanations:** Make explanation headers bold with "**Explanation:**" prefix
   - **Next Question:** Make next question instructions bold with "**Next Question:**" prefix
   - **Important Notes:** Use bold for any important notes or warnings
9. When providing examples or solutions, use code blocks with triple backticks for clear formatting.
10. Use headers appropriately: # for main sections, ## for subsections.`;

                // Check if request is coming from the specified origin and add language instruction
                if (requestOrigin.includes('chatbot-frontend-v-4-jd-1.onrender.com')) {
                    // Pass subject information directly in the prompt without conditional checks
                    systemPrompt += `\n\nIMPORTANT LANGUAGE INSTRUCTION:
The subject is "{{SUBJECT}}". If the subject is English or English language, communicate in English. For all other subjects, all communication should be done in French, even the headings like Score,Marks,Explanation,Question,Next Question, etc. Please respond to all questions and interactions in the appropriate language based on this rule.`.replace("{{SUBJECT}}", bookSubject || "general");
                } else if (requestOrigin.includes('chatbot-backend-v-4.onrender.com')) {
                    // Bengali language instruction for the specific origin
                    systemPrompt += `\n\nIMPORTANT LANGUAGE INSTRUCTION:
The subject is "{{SUBJECT}}". If the subject is English or English language, communicate in English. For all other subjects, all communication should be done in Bengali, even the headings like Score,Marks,Explanation,Question,Next Question, etc. Please respond to all questions and interactions in the appropriate language based on this rule.`.replace("{{SUBJECT}}", bookSubject || "general");
                }
            }
             console.log(`System Prompt ${systemPrompt}`);
            // Prepare the messages to send to OpenAI
            let messagesForOpenAI = [];
            if (!Array.isArray(messagesForOpenAI)) {
                messagesForOpenAI = [];
            }
            
            // Add the system message
            messagesForOpenAI.push({
                role: "system",
                content: systemPrompt
            });
            
            // Add previous messages for context
            if (previousMessages && previousMessages.length > 0) {
                previousMessages.forEach(msg => {
                    messagesForOpenAI.push({ role: msg.role, content: msg.content });
                });
            }
            
            // Add the current user message
            messagesForOpenAI.push({ role: "user", content: message });
            
            // Make the OpenAI request with retry logic
            const makeOpenAIRequest = async (retryCount = 0, maxRetries = 2) => {
                try {
                    // Attempt the request
                    console.log(`📊 messagesForOpenAI: ${JSON.stringify(messagesForOpenAI)}`);
                    const response = await openaiSelector.chat.completions.create({
                        model: "gpt-4.1", // For DeepSeek API we use this model
                        messages: messagesForOpenAI,
                        temperature: 0.25,
                        max_tokens: 1000
                      
                    });
            
            return response;
          } catch (error) {
            // If we've reached max retries, throw the error
            if (retryCount >= maxRetries) {
              throw error;
            }
            
                    // Exponential backoff: wait longer between each retry
                    const delay = Math.pow(2, retryCount) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
            
                    // Try again
            return makeOpenAIRequest(retryCount + 1, maxRetries);
          }
        };
        
            // Call OpenAI with retries
            const openaiResponse = await makeOpenAIRequest();

            if (!openaiResponse || !openaiResponse.choices || !openaiResponse.choices[0]) {
                return res.status(500).json({ error: "Invalid response from OpenAI" });
        }

            // Extract the bot message
            const botMessage = openaiResponse.choices[0].message.content;
            console.log(`🤖 Bot reply (first 100 chars): ${botMessage.substring(0, 100)}...`);
            console.log(`📏 Bot reply full length: ${botMessage.length} characters`);
            console.log(`📄 Bot reply full content:\n${botMessage}`);
            console.log(`📄 Bot reply JSON stringify: ${JSON.stringify(botMessage)}`);

            // Parse array response format for oldchat_ai
            let finalBotMessage = botMessage;
            let extractedScore = null;
            let extractedMaxScore = null;
            
            if (classification === "oldchat_ai" && previousQuestion) {
                try {
                    // Check if the response contains array format with brackets
                    if (botMessage.trim().startsWith('[') && botMessage.trim().endsWith(']')) {
                        // Try to parse the response as an array
                        const responseArray = JSON.parse(botMessage);
                        
                        if (Array.isArray(responseArray) && responseArray.length >= 3) {
                            // Check if it's the new object-based format
                            if (typeof responseArray[0] === 'object' && responseArray[0].bot_answer &&
                                typeof responseArray[1] === 'object' && responseArray[1].score &&
                                typeof responseArray[2] === 'object' && responseArray[2].question_marks) {
                                
                                // New object-based format: [{"bot_answer": "..."}, {"score": "0"}, {"question_marks": "1"}]
                                finalBotMessage = responseArray[0].bot_answer; // Bot answer content
                                extractedScore = parseFloat(responseArray[1].score); // Score for previous question
                                extractedMaxScore = parseFloat(responseArray[2].question_marks); // Max score for previous question
                                
                                console.log(`✅ Parsed object-based array response successfully:`);
                                console.log(`📝 Message: ${finalBotMessage.substring(0, 100)}...`);
                                console.log(`📊 Score: ${extractedScore}/${extractedMaxScore}`);
                                console.log(`🔍 ZERO SCORE DEBUG [Object Array Parse]: extractedScore=${extractedScore}, type=${typeof extractedScore}, isZero=${extractedScore === 0}`);
                                
                            } else if (typeof responseArray[0] === 'string' || typeof responseArray[0] === 'number') {
                                // Old simple array format: ["message", 0, 2]
                                finalBotMessage = responseArray[0]; // Message content
                                extractedScore = parseFloat(responseArray[1]); // Score for previous question
                                extractedMaxScore = parseFloat(responseArray[2]); // Max score for previous question
                                
                                console.log(`✅ Parsed simple JSON array response successfully:`);
                                console.log(`📝 Message: ${finalBotMessage.substring(0, 100)}...`);
                                console.log(`📊 Score: ${extractedScore}/${extractedMaxScore}`);
                                console.log(`🔍 ZERO SCORE DEBUG [Simple Array Parse]: extractedScore=${extractedScore}, type=${typeof extractedScore}, isZero=${extractedScore === 0}`);
                            } else {
                                console.log(`⚠️ Unknown JSON array format, falling back to original message`);
                                finalBotMessage = botMessage;
                            }
                        } else {
                            console.log(`⚠️ JSON array format invalid (length < 3), falling back to original message`);
                            finalBotMessage = botMessage;
                        }
                    } else if (botMessage.includes(',') && botMessage.trim().startsWith('[')) {
                        // Handle non-JSON array format like: [ content, 0, 2 ]
                        const arrayMatch = botMessage.match(/^\s*\[\s*(.*?)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]\s*$/s);
                        
                        if (arrayMatch && arrayMatch.length >= 4) {
                            finalBotMessage = arrayMatch[1].trim(); // Message content
                            extractedScore = parseFloat(arrayMatch[2]); // Score for previous question
                            extractedMaxScore = parseFloat(arrayMatch[3]); // Max score for previous question
                            
                            console.log(`✅ Parsed non-JSON array response successfully:`);
                            console.log(`📝 Message: ${finalBotMessage.substring(0, 100)}...`);
                            console.log(`📊 Score: ${extractedScore}/${extractedMaxScore}`);
                            console.log(`🔍 ZERO SCORE DEBUG [Non-JSON Array Parse]: extractedScore=${extractedScore}, type=${typeof extractedScore}, isZero=${extractedScore === 0}`);
                        } else {
                            console.log(`⚠️ Non-JSON array format invalid, falling back to original message`);
                            finalBotMessage = botMessage;
                        }
                    } else {
                        console.log(`⚠️ Response not in array format, using original message`);
                        finalBotMessage = botMessage;
                    }
                } catch (parseError) {
                    console.log(`⚠️ Failed to parse response as array, using original message:`, parseError.message);
                    finalBotMessage = botMessage;
                }
            }

            // Save the message to chat history - BUT WAIT FOR BEAUTIFICATION FIRST
            // We'll save after beautification to ensure DB and user get the same content
            
            // If in question mode and classification is oldchat_ai, process scores and update questions
            if (classification === "oldchat_ai") {
                console.log(`🔍 DEBUG: Starting score processing - Classification: ${classification}`);
                // Check if we have a valid previous question to record the answer for
                if (previousQuestion) {
                    console.log(`🔍 DEBUG: Previous question found - ID: ${previousQuestion.questionId}, Text: ${previousQuestion.question?.substring(0, 30)}...`);
                    
                    // Use extracted scores from array or fallback to 0
                    let marksAwarded = 0;
                    let maxScore = previousQuestion.question_marks || 1;
                    
                    if (extractedScore !== null && extractedMaxScore !== null) {
                        marksAwarded = extractedScore;
                        maxScore = extractedMaxScore;
                        console.log(`✅ Using scores from array response: ${marksAwarded}/${maxScore}`);
                    } else {
                        console.log(`⚠️ No valid scores in array response, using default: ${marksAwarded}/${maxScore}`);
                    }
                    
                    // Verify the extracted score is valid
                    if (isNaN(marksAwarded) || marksAwarded < 0) {
                        console.log(`❌ Invalid score detected: ${marksAwarded}. Resetting to 0.`);
                                marksAwarded = 0;
                        console.log(`🔍 ZERO SCORE DEBUG: Setting marksAwarded to exactly 0 after validation`);
                    }
                    
                    // Ensure maxScore is positive
                    if (isNaN(maxScore) || maxScore <= 0) {
                        console.log(`❌ Invalid maxScore detected: ${maxScore}. Using question's marks: ${previousQuestion.question_marks || 1}`);
                        maxScore = previousQuestion.question_marks || 1;
                    }
                    
                    // Final score validation - make sure score doesn't exceed max
                    if (marksAwarded > maxScore) {
                        console.log(`⚠️ Score exceeds maximum: ${marksAwarded}/${maxScore}. Capping at ${maxScore}.`);
                        marksAwarded = maxScore;
                    }
                    
                    console.log(`📊 FINAL SCORE DETERMINATION: ${marksAwarded}/${maxScore}`);
                    console.log(`🔍 ZERO SCORE DEBUG: Final marksAwarded value: ${marksAwarded}, type: ${typeof marksAwarded}, isZero: ${marksAwarded === 0}, toString(): "${marksAwarded.toString()}"`);
                
                try {
                        console.log(`🔍 DEBUG: About to call markQuestionAsAnswered with score ${marksAwarded}/${maxScore}`);
                        console.log(`🔍 DEBUG: Parameters for markQuestionAsAnswered:`);
                        console.log(`  - userId: ${userId}`);
                        console.log(`  - chapterId: ${chapterId}`);
                        console.log(`  - questionId: ${previousQuestion.questionId}`);
                        console.log(`  - marksAwarded: ${marksAwarded} (type: ${typeof marksAwarded}, isZero: ${marksAwarded === 0})`);
                        console.log(`  - maxScore: ${maxScore} (type: ${typeof maxScore})`);
                        console.log(`  - questionText length: ${(previousQuestion.question || "").length}`);
                        console.log(`  - answerText length: ${message.length}`);
                        
                        // Record the answer for the PREVIOUS question with the user's current message as the answer
                        await markQuestionAsAnswered(
                            userId, 
                            chapterId, 
                            previousQuestion.questionId, 
                            marksAwarded, 
                            maxScore,
                            previousQuestion.question || "", // Use previous question text
                            message // Current message is the answer to the previous question
                        );
                        
                        console.log(`✅ Successfully recorded answer for previous question: ${previousQuestion.questionId} with score ${marksAwarded}/${maxScore}`);
                } catch (markError) {
                    console.error(`❌ ERROR marking question as answered:`, markError);
                    console.error(`❌ Error details - Question ID: ${previousQuestion.questionId}, Score: ${marksAwarded}/${maxScore}`);
                    }
                } else {
                    console.log(`⚠️ No previous question found to record score for`);
                }
            } else {
                console.log(`🔍 DEBUG: Classification ${classification} not eligible for score recording`);
            }
            
            // Store current question as the previous question for next time, for both oldchat_ai and newchat_ai
            if (questionModeEnabled && (classification === "oldchat_ai" || classification === "newchat_ai")) {
                if (currentQuestion) {
                    previousQuestionsMap.set(userChapterKey, currentQuestion);
                    console.log(`✅ Set current question as previous for next time: ${currentQuestion.questionId}`);
                } else {
                    console.log(`⚠️ No current question to set as previous for next time`);
                }
            }
            
            // Log the marksAwarded value before sending the response
            console.log(`Final score to be returned: marksAwarded=${marksAwarded}, classification=${classification}`);
            
            // Beautify the response for oldchat_ai using GPT-4.1 (with improved emoji/formatting preservation)
            if (classification === "oldchat_ai") {
                console.log(`🎨 Beautifying oldchat_ai response (preserving emojis and formatting)...`);
                try {
                    const originalMessage = finalBotMessage;
                    finalBotMessage = await beautifyBotResponse(finalBotMessage);
                    console.log(`✅ Response beautified successfully`);
                    console.log(`📝 Original length: ${originalMessage.length}, Beautified length: ${finalBotMessage.length}`);
                } catch (beautifyError) {
                    console.error(`❌ Error beautifying response:`, beautifyError);
                    // Continue with original message if beautification fails
                }
            }
            
            // NOW save the message to chat history AFTER beautification
            // This ensures both database and user get the same beautified content
            chat.messages.push({ role: "user", content: message });
            chat.messages.push({ role: "assistant", content: finalBotMessage });
            
            // Update the lastActive timestamp
            chat.lastActive = Date.now();
            
            await chat.save();
            
            console.log(`💾 Saved beautified assistant message to DB (length: ${finalBotMessage.length})`);
            console.log(`💾 Last saved message content: ${chat.messages[chat.messages.length - 1].content.substring(0, 100)}...`);
            
            // Prepare the response object
            // Special debugging for zero scores before creating response object
            if (marksAwarded === 0 && previousQuestion && classification === "oldchat_ai") {
                console.log(`🔍 ZERO SCORE DEBUG [Response]: Zero score should be included in response object`);
                console.log(`🔍 ZERO SCORE DEBUG [Response]: marksAwarded=${marksAwarded}, type=${typeof marksAwarded}`);
                console.log(`🔍 ZERO SCORE DEBUG [Response]: classification=${classification}, previousQuestion exists: ${!!previousQuestion}`);
            }
            
            const responseObject = {
                message: finalBotMessage,
                questionId: currentQuestion ? currentQuestion.questionId : null,
                fullQuestion: currentQuestion,
                agentType: classification,
                previousQuestionId: previousQuestion ? previousQuestion.questionId : null,
                score: {
                    marksAwarded: (previousQuestion && classification === "oldchat_ai" && typeof marksAwarded !== 'undefined') ? marksAwarded : null,
                    maxMarks: (previousQuestion && classification === "oldchat_ai" && typeof maxScore !== 'undefined') ? maxScore : null,
                    previousQuestion: previousQuestion ? previousQuestion.question : null
                }
            };
            
            // Debug logging specifically for the score property in the response object
            console.log(`🔍 RESPONSE OBJECT DEBUG: Score in response:`, {
                marksAwarded: responseObject.score.marksAwarded, 
                marksAwardedType: typeof responseObject.score.marksAwarded,
                isZero: responseObject.score.marksAwarded === 0,
                maxMarks: responseObject.score.maxMarks,
                classification: classification,
                isPreviousQuestion: !!previousQuestion
            });
            
            console.log(`🚀 Response being sent to frontend:`);
            console.log(`🚀 Message length: ${responseObject.message.length}`);
            console.log(`🚀 Message content (first 200 chars): ${responseObject.message.substring(0, 200)}...`);
            console.log(`🚀 Full response object:`, JSON.stringify(responseObject, null, 2));
            
            // Return the response
            return res.json(responseObject);
        } catch (chapterError) {
            console.error("Error fetching chapter:", chapterError);
            if (chapterError.name === 'CastError') {
                console.error(`Invalid chapterId format: ${chapterId}`);
                return res.status(400).json({ error: "Invalid chapter ID format" });
            }
            return res.status(500).json({ error: "Error fetching chapter details", details: chapterError.message });
        }
    } catch (error) {
        console.error("Error processing message:", error);
        console.error("Request details:", { userId, chapterId });
        return res.status(500).json({ 
            error: "Error processing message", 
            details: error.message || "Unknown error"
        });
    }
});

// Transcribe audio and get AI response
router.post("/transcribe", authenticateUser, upload.single("audio"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No audio file uploaded" });
        }

        // Log detailed information about the uploaded file
        console.log('Audio file details:', {
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            encoding: req.file.encoding,
            fieldname: req.file.fieldname,
            destination: req.file.destination,
            path: req.file.path
        });

        const audioFilePath = path.join(__dirname, "../uploads", req.file.filename);
        let filePathToTranscribe = audioFilePath;
        
        // Check if we need to convert the file (for Safari/MacOS webm files)
        const isIPhone = req.headers['user-agent'] && 
                        (req.headers['user-agent'].includes("iPhone") || 
                         (req.headers['user-agent'].includes("Safari") && 
                          !req.headers['user-agent'].includes("Chrome")));
                          
        // Handle iPhone .m4a files with mimetype audio/webm
        if (isIPhone && req.file.originalname.endsWith('.m4a')) {
            try {
                console.log("Converting iPhone audio file to mp3 format");
                // Create a different output filename to avoid in-place editing errors
                const mp3FilePath = audioFilePath.replace(path.extname(audioFilePath), "") + ".mp3";
                
                // Rename the file directly if it's not a valid m4a (iOS sometimes sends incorrect file with m4a extension)
                try {
                    // Check if we can read the file header to determine if it's a real m4a
                    const fileHeader = fs.readFileSync(audioFilePath, { length: 8 });
                    // If it's not a valid m4a (doesn't have ftyp header), just rename it
                    if (!fileHeader.toString().includes('ftyp')) {
                        console.log("iPhone file appears to not be a valid m4a, renaming to correct extension");
                        const correctedFilePath = audioFilePath.replace(path.extname(audioFilePath), ".webm");
                        fs.renameSync(audioFilePath, correctedFilePath);
                        filePathToTranscribe = correctedFilePath;
                        // Skip conversion since we just renamed
                        console.log("Using renamed file for transcription");
                        return;
                    }
                } catch (headerError) {
                    console.error("Error checking file header:", headerError);
                    // Continue with conversion attempt
                }
                
                // Convert the file using fluent-ffmpeg
                await new Promise((resolve, reject) => {
                    ffmpeg(audioFilePath)
                        .outputOptions([
                            '-vn',
                            '-ar 44100',
                            '-ac 2',
                            '-b:a 192k'
                        ])
                        .save(mp3FilePath)
                        .on('end', () => {
                            console.log("Conversion successful");
                            resolve();
                        })
                        .on('error', (err) => {
                            console.error("Error during conversion", err);
                            reject(err);
                        });
                });
                
                console.log("Using converted file for transcription");
                filePathToTranscribe = mp3FilePath;
            } catch (conversionError) {
                console.error("Error converting audio file:", conversionError);
                // As a last resort, try renaming to match the mimetype
                try {
                    const webmFilePath = audioFilePath.replace(path.extname(audioFilePath), ".webm");
                    fs.renameSync(audioFilePath, webmFilePath);
                    filePathToTranscribe = webmFilePath;
                    console.log("Conversion failed, using renamed file instead");
                } catch (renameError) {
                    console.error("Error renaming file:", renameError);
                    // Continue with original file if all else fails
                }
            }
        }
        // Original Safari webm handling
        else if (req.file.mimetype === "audio/webm" && isIPhone) {
            try {
                console.log("Converting Safari webm file to mp3 format");
                const mp3FilePath = audioFilePath.replace(path.extname(audioFilePath), "") + ".mp3";
                
                // Convert webm to mp3 using fluent-ffmpeg
                await new Promise((resolve, reject) => {
                    ffmpeg(audioFilePath)
                        .outputOptions([
                            '-vn',
                            '-ar 44100',
                            '-ac 2',
                            '-b:a 192k'
                        ])
                        .save(mp3FilePath)
                        .on('end', () => {
                            console.log("Conversion successful");
                            resolve();
                        })
                        .on('error', (err) => {
                            console.error("Error during conversion", err);
                            reject(err);
                        });
                });
                
                console.log("Using converted file for transcription");
                filePathToTranscribe = mp3FilePath;
            } catch (conversionError) {
                console.error("Error converting audio file:", conversionError);
                // Continue with original file if conversion fails
            }
        }
        
        // Add timeout for the OpenAI transcription request
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Transcription request timed out')), 45000);
        });

        // Transcribe the audio using OpenAI's API
        const transcriptionPromise = openaiTranscription.audio.transcriptions.create({
            file: fs.createReadStream(filePathToTranscribe),
            model: "whisper-1"
        });

        // Use Promise.race to implement the timeout
        const transcription = await Promise.race([transcriptionPromise, timeoutPromise]);
        
        // Clean up temporary files
        fs.unlinkSync(audioFilePath);
        if (filePathToTranscribe !== audioFilePath && fs.existsSync(filePathToTranscribe)) {
            fs.unlinkSync(filePathToTranscribe);
        }
        
        // Check for empty transcription
        if (!transcription.text || transcription.text.trim() === "") {
            return res.status(400).json({ error: "Couldn't transcribe audio. The file might be empty or corrupted." });
        }
        
        // Get the user's chat history
        const chatHistory = await Chat.findOne({ 
            userId: req.body.userId,
            chapterId: req.body.chapterId || null 
        });

        // Create or update chat history with this transcribed message
        if (chatHistory) {
            // Add this message to existing chat
            chatHistory.messages.push({
                role: "user",
                content: transcription.text,
                isAudio: true
            });
            await chatHistory.save();
        } else {
            // Create a new chat with this message
            await Chat.create({
                userId: req.body.userId,
                chapterId: req.body.chapterId || null,
                messages: [{
                    role: "user",
                    content: transcription.text,
                    isAudio: true
                }]
            });
        }

        // Return the transcribed text and redirect to text processing
        return res.status(200).json({
            transcription: transcription.text,
            redirect: true
        });
    } catch (error) {
        console.error("Transcription error:", error);
        
        // Clean up temporary file if it exists
        if (req.file) {
            const audioFilePath = path.join(__dirname, "../uploads", req.file.filename);
            if (fs.existsSync(audioFilePath)) {
                fs.unlinkSync(audioFilePath);
            }
        }
        
        return res.status(500).json({ 
            error: error.message || "Failed to transcribe audio message" 
        });
    }
});

// Get Chat History for a Specific Chapter
router.get("/chapter-history/:chapterId", authenticateUser, async (req, res) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user.userId;
        
        console.log(`Fetching chat history for chapter ${chapterId} and user ${userId}`);
        
        const chat = await Chat.findOne({ userId, chapterId });
        
        if (!chat || !Array.isArray(chat.messages)) {
            console.log(`No chat history found for chapter ${chapterId} and user ${userId}`);
            return res.json([]);
        }
        
        // Return all messages without filtering
        console.log(`Returning ${chat.messages.length} messages for chapter ${chapterId}`);
        res.json(chat.messages);
        
    } catch (error) {
        console.error("Error fetching chapter chat history:", error);
        res.status(500).json({ error: "Failed to fetch chapter chat history" });
    }
});

// Get Chapter Statistics for Live Score Display
router.get("/chapter-stats/:chapterId", authenticateUser, async (req, res) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user.userId;
        
        console.log(`📊 Fetching chapter stats for chapter ${chapterId} and user ${userId}`);
        
        // First check Chat metadata for debugging
        const chat = await Chat.findOne({ userId, chapterId });
        if (chat && chat.metadata) {
            console.log(`📊 Chat metadata found:`, {
                answeredQuestions: chat.metadata.answeredQuestions?.length || 0,
                totalMarks: chat.metadata.totalMarks || 0,
                earnedMarks: chat.metadata.earnedMarks || 0,
                firstFewAnswered: chat.metadata.answeredQuestions?.slice(0, 3) || []
            });
        } else {
            console.log(`📊 No chat metadata found for user ${userId} and chapter ${chapterId}`);
        }
        
        // Also check QnALists records
        const qnaRecord = await QnALists.findOne({ studentId: userId, chapterId });
        if (qnaRecord && qnaRecord.qnaDetails) {
            console.log(`📊 QnALists record found:`, {
                totalQnaDetails: qnaRecord.qnaDetails.length,
                answeredQnaDetails: qnaRecord.qnaDetails.filter(q => q.status === 1).length,
                firstFewDetails: qnaRecord.qnaDetails.slice(0, 3).map(q => ({
                    questionId: q.questionId,
                    status: q.status,
                    score: q.score,
                    questionMarks: q.questionMarks
                }))
            });
        } else {
            console.log(`📊 No QnALists record found for user ${userId} and chapter ${chapterId}`);
        }
        
        // Get stats from QnALists
        const stats = await QnALists.getChapterStats(userId, chapterId);
        console.log(`📊 QnALists.getChapterStats returned:`, stats);
        
        // Only return stats if there are answered questions
        if (stats.answeredQuestions === 0) {
            console.log(`📊 No answered questions for chapter ${chapterId} and user ${userId}`);
            return res.json({ hasStats: false });
        }
        
        // Return the stats with a flag indicating there are stats
        console.log(`📊 Returning stats for chapter ${chapterId}: ${stats.earnedMarks}/${stats.totalMarks} (${stats.percentage}%)`);
        return res.json({
            hasStats: true,
            earnedMarks: stats.earnedMarks,
            totalMarks: stats.totalMarks,
            percentage: stats.percentage,
            answeredQuestions: stats.answeredQuestions,
            totalQuestions: stats.totalQuestions
        });
        
    } catch (error) {
        console.error("📊 Error fetching chapter stats:", error);
        res.status(500).json({ error: "Failed to fetch chapter statistics" });
    }
});

// Get General Chat History
router.get("/general-history", authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // console.log removed;
        
        const chat = await Chat.findOne({ userId, chapterId: null });
        
        if (!chat || !Array.isArray(chat.messages)) {
            // console.log removed;
            return res.json([]);
        }
        
        // console.log removed;
        res.json(chat.messages);
        
    } catch (error) {
        console.error("Error fetching general chat history:", error);
        res.status(500).json({ error: "Failed to fetch general chat history" });
    }
});

// Get Chat History by User ID
router.get("/history/:userId", authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;

        // Verify the requesting user is the same as the userId parameter
        if (req.user.userId !== userId) {
            return res.status(403).json({ error: "Unauthorized to access this user's chat history" });
        }

        const chat = await Chat.findOne({ userId, chapterId: null });

        if (!chat || !Array.isArray(chat.messages)) {
            return res.json([]);
        }

        res.json(chat.messages);

    } catch (error) {
        console.error("Error fetching user chat history:", error);
        res.status(500).json({ error: "Failed to fetch user chat history" });
    }
});

// Get progression status for a chapter
router.get("/progression-status/:chapterId", authenticateUser, async (req, res) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user.userId;
        
        console.log(`Fetching progression status for chapter ${chapterId} and user ${userId}`);
        
        // Find the chat document to get progression tracker
        const chat = await Chat.findOne({ userId, chapterId });
        
        if (!chat || !chat.metadata || !chat.metadata.progressionTracker) {
            return res.json({
                hasProgression: false,
                currentDifficulty: "Easy",
                subtopicsCompleted: {
                    Easy: [],
                    Medium: [],
                    Hard: []
                },
                allSubtopics: []
            });
        }
        
        // Get chapter details to find all subtopics
        const chapter = await Chapter.findById(chapterId);
        const allSubtopics = chapter && chapter.questionPrompt ? 
            [...new Set(chapter.questionPrompt.map(q => q.subtopic).filter(s => s))] : [];
        
        const progressionTracker = chat.metadata.progressionTracker;
        
        return res.json({
            hasProgression: true,
            currentDifficulty: progressionTracker.currentDifficulty,
            subtopicsCompleted: progressionTracker.subtopicsCompleted,
            allSubtopics: allSubtopics,
            progressSummary: {
                easy: {
                    completed: progressionTracker.subtopicsCompleted.Easy.length,
                    total: allSubtopics.length
                },
                medium: {
                    completed: progressionTracker.subtopicsCompleted.Medium.length,
                    total: allSubtopics.length
                },
                hard: {
                    completed: progressionTracker.subtopicsCompleted.Hard.length,
                    total: allSubtopics.length
                }
            }
        });
        
    } catch (error) {
        console.error("Error fetching progression status:", error);
        res.status(500).json({ error: "Failed to fetch progression status" });
    }
});

// Reset question status and progression for a chapter
router.post("/reset-questions/:chapterId", authenticateUser, async (req, res) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user.userId;
        
        console.log(`Resetting questions and progression for chapter ${chapterId} and user ${userId}`);
        
        // Find the chapter to reset
        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }
        
        // Get the questions for this chapter
        const questions = chapter.questionPrompt || [];
        if (questions.length === 0) {
            return res.status(400).json({ error: "No questions found for this chapter" });
        }
        
        // Find existing chat history for this user and chapter
        const existingChat = await Chat.findOne({
            userId,
            chapterId
        });
        
        if (existingChat) {
            // Reset question status in the questions array
            const resetQuestions = questions.map(q => ({
                ...q,
                questionId: q.questionId || `QID-${chapterId}-${q.Q}-${Date.now()}`,
                question_answered: false,
                marks_gained: 0
            }));
            
            // Update the chapter with reset questions
            await Chapter.findByIdAndUpdate(chapterId, {
                questionPrompt: resetQuestions
            });
            
            // Reset chat messages and progression tracker
            existingChat.messages = [];
            existingChat.metadata = {
                answeredQuestions: [],
                totalMarks: 0,
                earnedMarks: 0,
                progressionTracker: {
                    currentDifficulty: "Easy",
                    subtopicsCompleted: {
                        Easy: [],
                        Medium: [],
                        Hard: []
                    }
                }
            };
            await existingChat.save();
            
            // Clear any stored previous questions for this user-chapter combination
            const userChapterKey = `${userId}-${chapterId}`;
            if (previousQuestionsMap.has(userChapterKey)) {
                previousQuestionsMap.delete(userChapterKey);
                console.log(`Cleared previous question mapping for ${userChapterKey}`);
            }
            
            // Delete all QnA records for this user and chapter
            try {
                await QnALists.deleteMany({ studentId: userId, chapterId: chapterId });
                console.log(`Deleted QnA records for user ${userId} and chapter ${chapterId}`);
            } catch (qnaError) {
                console.error("Error deleting QnA records:", qnaError);
            }
            
            console.log(`Reset progress: ${resetQuestions.length} questions, chat history, and progression tracker`);
            res.json({ 
                success: true, 
                message: `Progress reset for ${resetQuestions.length} questions`,
                progressionReset: true
            });
        } else {
            // No chat history found, nothing to reset
            console.log(`No existing progress found for user ${userId} and chapter ${chapterId}`);
            res.json({ 
                success: true, 
                message: "No progress to reset",
                progressionReset: false
            });
        }
    } catch (error) {
        console.error("Error resetting question status:", error);
        res.status(500).json({ error: "Failed to reset question status" });
    }
});

// Store answered question in the chat document
// Add this function to track which questions a user has answered
async function markQuestionAsAnswered(userId, chapterId, questionId, marksAwarded, maxMarks, questionText, answerText) {
    try {
        console.log(`🏆 markQuestionAsAnswered called with:`, {
            userId,
            chapterId,
            questionId,
            marksAwarded,
            maxMarks,
            questionText: questionText?.substring(0, 50) + '...',
            answerText: answerText?.substring(0, 50) + '...'
        });
        
        // Find or create the chat document
        let chat = await Chat.findOne({ userId, chapterId });
        
        if (!chat) {
            console.log(`🏆 Creating new chat document for user ${userId} and chapter ${chapterId}`);
            chat = new Chat({
                userId,
                chapterId,
                messages: [],
                metadata: {
                    answeredQuestions: [],
                    totalMarks: 0,
                    earnedMarks: 0
                }
            });
        } else {
            console.log(`🏆 Found existing chat document for user ${userId} and chapter ${chapterId}`);
        }
        
        // Initialize metadata if it doesn't exist
        if (!chat.metadata) {
            console.log(`🏆 Initializing metadata for chat document`);
            chat.metadata = {
                answeredQuestions: [],
                totalMarks: 0,
                earnedMarks: 0
            };
        }
        
        if (!Array.isArray(chat.metadata.answeredQuestions)) {
            console.log(`🏆 Initializing answeredQuestions array`);
            chat.metadata.answeredQuestions = [];
        }
        
        console.log(`🏆 Before updating - answeredQuestions: ${chat.metadata.answeredQuestions.length}, totalMarks: ${chat.metadata.totalMarks}, earnedMarks: ${chat.metadata.earnedMarks}`);
        
        // Add question to the answered list if not already there
        if (!chat.metadata.answeredQuestions.includes(questionId)) {
            console.log(`🏆 Adding new question ${questionId} to answered list`);
            chat.metadata.answeredQuestions.push(questionId);
            
            // Update marks with extra validation
            // Ensure marks are valid numbers
            const validMaxMarks = (!isNaN(maxMarks) && maxMarks > 0) ? parseFloat(maxMarks) : 1;
            const validMarksAwarded = (!isNaN(marksAwarded)) ? Math.max(0, parseFloat(marksAwarded)) : 0;
            
            console.log(`🏆 Using validated marks: awarded=${validMarksAwarded}, max=${validMaxMarks}`);
            console.log(`🔍 ZERO SCORE DEBUG [markQuestionAsAnswered]: Original marksAwarded=${marksAwarded} (${typeof marksAwarded}), validMarksAwarded=${validMarksAwarded} (${typeof validMarksAwarded}), isZero: ${validMarksAwarded === 0}`);
            
            // Special debug for zero scores
            if (marksAwarded === 0 || validMarksAwarded === 0) {
                console.log(`🔍 ZERO SCORE DEBUG [markQuestionAsAnswered]: Zero score detected! Original=${marksAwarded}, Validated=${validMarksAwarded}`);
            }
            
            // Force convert to numbers with fallbacks to prevent NaN
            chat.metadata.totalMarks = parseFloat(chat.metadata.totalMarks || 0) + validMaxMarks;
            chat.metadata.earnedMarks = parseFloat(chat.metadata.earnedMarks || 0) + validMarksAwarded;
            
            console.log(`🏆 After updating - answeredQuestions: ${chat.metadata.answeredQuestions.length}, totalMarks: ${chat.metadata.totalMarks}, earnedMarks: ${chat.metadata.earnedMarks}`);
        
        // Log the structure of the updated chat metadata
        console.log(`🏆 Chat metadata structure:`, {
            hasMetadata: !!chat.metadata,
            metadataKeys: chat.metadata ? Object.keys(chat.metadata) : [],
            answeredQuestionsArray: Array.isArray(chat.metadata?.answeredQuestions),
            earnedMarksType: typeof chat.metadata?.earnedMarks,
            totalMarksType: typeof chat.metadata?.totalMarks
        });
            
            // Also record in QnALists
            try {
                console.log(`🏆 Recording answer for question ${questionId} in QnALists`);
                
                // Get the chapter to get the bookId and subject
                const chapter = await Chapter.findById(chapterId);
                const chapterBookId = chapter ? chapter.bookId : null;
                
                if (!chapterBookId) {
                    console.error(`🏆 Cannot find bookId for chapter ${chapterId}`);
                } else {
                    console.log(`🏆 Found bookId ${chapterBookId} for chapter ${chapterId}`);
                }
                
                // Get book details to check subject (for language determination)
                let bookSubject = "general subject";
                if (chapterBookId) {
                    const book = await Book.findById(chapterBookId);
                    if (book) {
                        bookSubject = book.subject || "general subject";
                        console.log(`🏆 Found book subject: ${bookSubject}`);
                    }
                }
                
                // Make sure we use the validated score values
                const qnaData = {
                    studentId: userId,
                    bookId: chapterBookId,
                    chapterId: chapterId,
                    questionId: questionId,
                    questionMarks: validMaxMarks, // Use validated max marks
                    score: validMarksAwarded,     // Use validated marks awarded
                    answerText: answerText || "",
                    questionText: questionText || "",
                    agentType: "oldchat_ai", // Always oldchat_ai for answered questions
                    subject: bookSubject // Add subject for reference
                };
                
                console.log(`🏆 Calling QnALists.recordAnswer with:`, {
                    ...qnaData,
                    answerText: qnaData.answerText.substring(0, 50) + '...',
                    questionText: qnaData.questionText.substring(0, 50) + '...'
                });
                
                // Track the actual recordAnswer operation in detail
                console.log(`🏆 QnALists.recordAnswer - Operation starting with data:`, JSON.stringify({
                    studentId: qnaData.studentId,
                    chapterId: qnaData.chapterId,
                    questionId: qnaData.questionId,
                    score: qnaData.score,
                    questionMarks: qnaData.questionMarks
                }));
                
                // Extra debug for zero scores
                if (qnaData.score === 0) {
                    console.log(`🔍 ZERO SCORE DEBUG [QnALists.recordAnswer]: Zero score being saved to database! score=${qnaData.score}, type=${typeof qnaData.score}`);
                    console.log(`🔍 ZERO SCORE DEBUG [QnALists.recordAnswer]: Full qnaData object:`);
                    console.log(JSON.stringify(qnaData, null, 2));
                }
                
                const recordResult = await QnALists.recordAnswer(qnaData);
                console.log(`🏆 QnALists.recordAnswer - Operation result:`, {
                    success: !!recordResult,
                    resultId: recordResult?._id?.toString(),
                    hasQnaDetails: !!recordResult?.qnaDetails,
                    qnaDetailsCount: recordResult?.qnaDetails?.length || 0
                });
                
                // Verify the record was actually saved by retrieving it
                const verifyRecord = await QnALists.findOne({ 
                    studentId: userId,
                    chapterId: chapterId,
                    "qnaDetails.questionId": questionId
                });
                
                console.log(`🏆 Verification - Record found: ${!!verifyRecord}`);
                if (verifyRecord) {
                    const questionEntry = verifyRecord.qnaDetails.find(q => q.questionId === questionId);
                    console.log(`🏆 Verification - Question entry found: ${!!questionEntry}`);
                    if (questionEntry) {
                        console.log(`🏆 Verification - Saved score: ${questionEntry.score}/${questionEntry.questionMarks}`);
                        
                        // Special verification for zero scores
                        if (validMarksAwarded === 0) {
                            console.log(`🔍 ZERO SCORE DEBUG [Verification]: Zero score verification check`);
                            console.log(`🔍 ZERO SCORE DEBUG [Verification]: Expected score to be 0, actual saved score: ${questionEntry.score}`);
                            console.log(`🔍 ZERO SCORE DEBUG [Verification]: Score type in DB: ${typeof questionEntry.score}`);
                            console.log(`🔍 ZERO SCORE DEBUG [Verification]: Is score exactly 0? ${questionEntry.score === 0}`);
                            console.log(`🔍 ZERO SCORE DEBUG [Verification]: Is score explicitly 0? ${questionEntry.score === 0}`);
                            console.log(`🔍 ZERO SCORE DEBUG [Verification]: Score as string: "${questionEntry.score.toString()}"`);
                            console.log(`🔍 ZERO SCORE DEBUG [Verification]: Score === "0"? ${questionEntry.score.toString() === "0"}`);
                        }
                    }
                }
                
                console.log(`🏆 Successfully recorded answer in QnALists`);
                
            } catch (qnaError) {
                console.error("🏆 Error recording answer in QnALists:", qnaError);
            }
        } else {
            console.log(`🏆 Question ${questionId} already in answered list, skipping`);
        }
        
        console.log(`🏆 Saving chat document with updated metadata`);
        await chat.save();
        console.log(`🏆 Successfully saved chat document`);
        
    } catch (error) {
        console.error("🏆 Error marking question as answered:", error);
        throw error;
    }
}

// Add a new endpoint to retrieve audio files by ID
router.get("/audio/:fileId", authenticateUser, async (req, res) => {
    try {
        const fileId = req.params.fileId;
        
        // Get the audio file from GridFS
        const audioFile = await getAudioStream(fileId);
        
        if (!audioFile) {
            return res.status(404).json({ error: "Audio file not found" });
        }
        
        // Set the content type header
        res.set('Content-Type', audioFile.contentType);
        res.set('Content-Disposition', `inline; filename="${audioFile.filename}"`);
        
        // Return the file stream
        audioFile.stream.pipe(res);
    } catch (error) {
        console.error("Error retrieving audio file:", error);
        res.status(500).json({ error: "Failed to retrieve audio file" });
    }
});

// Add the missing export statement
module.exports = router;

// TEMPORARY ROUTE: Fix zero scores for testing purposes
router.get("/fix-zero-scores/:chapterId", authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        const chapterId = req.params.chapterId;
        
        console.log(`🔧 FIX-SCORES: Attempting to fix zero scores for user ${userId} and chapter ${chapterId}`);
        
        // Find all QnA entries for this user and chapter
        const qnaRecord = await QnALists.findOne({ 
            studentId: userId,
            chapterId: chapterId
        });
        
        if (!qnaRecord || !qnaRecord.qnaDetails || qnaRecord.qnaDetails.length === 0) {
            return res.json({ 
                success: false, 
                message: "No records found to update",
                updated: 0
            });
        }
        
        // Count how many zero scores we have
        const zeroScores = qnaRecord.qnaDetails.filter(q => q.score === 0).length;
        console.log(`🔧 FIX-SCORES: Found ${zeroScores} questions with zero scores out of ${qnaRecord.qnaDetails.length}`);
        
        // Update each zero score to a default value (for testing)
        let updatedCount = 0;
        for (let i = 0; i < qnaRecord.qnaDetails.length; i++) {
            if (qnaRecord.qnaDetails[i].score === 0) {
                // Update to a default score for testing (70% of max)
                const questionMarks = qnaRecord.qnaDetails[i].questionMarks || 1;
                const newScore = Math.round(questionMarks * 0.7 * 10) / 10; // 70% rounded to 1 decimal
                
                qnaRecord.qnaDetails[i].score = newScore;
                updatedCount++;
                
                console.log(`🔧 FIX-SCORES: Updated question ${qnaRecord.qnaDetails[i].questionId} score from 0 to ${newScore}/${questionMarks}`);
            }
        }
        
        // Save the updated record
        if (updatedCount > 0) {
            await qnaRecord.save();
            console.log(`🔧 FIX-SCORES: Saved ${updatedCount} updated scores`);
            
            // Also update the chat metadata
        const chat = await Chat.findOne({ userId, chapterId });
            if (chat && chat.metadata) {
                // Recalculate earned marks from QnA data
                const totalEarnedMarks = qnaRecord.qnaDetails.reduce((sum, q) => sum + q.score, 0);
                
                // Update the earned marks in chat metadata
                chat.metadata.earnedMarks = totalEarnedMarks;
                await chat.save();
                
                console.log(`🔧 FIX-SCORES: Updated chat metadata earnedMarks to ${totalEarnedMarks}`);
            }
        }
        
        return res.json({ 
            success: true, 
            message: `Updated ${updatedCount} zero scores`,
            updated: updatedCount,
            totalQuestions: qnaRecord.qnaDetails.length
        });
        
    } catch (error) {
        console.error("Error fixing zero scores:", error);
        return res.status(500).json({ 
            success: false,
            error: "Error fixing zero scores", 
            details: error.message 
        });
    }
});
