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
const fetch = require("node-fetch"); // Make sure node-fetch is available

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

// Remove fetch polyfill to allow OpenAI SDK to handle HTTP requests natively
// The OpenAI SDK in Node.js 18+ can use the built-in fetch API
console.log('Allowing OpenAI SDK to use native fetch implementation');

// Add Blob polyfill for Node.js compatibility with OpenAI
if (typeof global.Blob === 'undefined') {
    try {
        const { Blob } = require('buffer');
        global.Blob = Blob;
    } catch (err) {
        // Fallback Blob implementation for older Node.js versions
        global.Blob = class Blob {
            constructor(parts = [], options = {}) {
                this.size = 0;
                this.type = options.type || '';
                this._parts = parts;
                
                // Calculate size
                for (const part of parts) {
                    if (typeof part === 'string') {
                        this.size += Buffer.byteLength(part);
                    } else if (part instanceof Buffer) {
                        this.size += part.length;
                    }
                }
            }
            
            async text() {
                return Buffer.concat(this._parts.map(p => 
                    typeof p === 'string' ? Buffer.from(p) : p
                )).toString();
            }
            
            async arrayBuffer() {
                return Buffer.concat(this._parts.map(p => 
                    typeof p === 'string' ? Buffer.from(p) : p
                )).buffer;
            }
        };
    }
}

// Add FormData polyfill for Node.js compatibility with OpenAI
// For OpenAI SDK compatibility, we need to avoid setting a global FormData
// and let the OpenAI SDK handle file uploads internally
console.log('Skipping FormData polyfill to allow OpenAI SDK to handle file uploads natively');

// Create mock OpenAI clients if API keys are missing
let openai, openaiSelector, openaiTranscription;

try {
    // Create an OpenAI client using DeepSeek for chat completions if key is available
    if (process.env.OPENAI_API_KEY_D) {
        openai = new OpenAI({ 
            apiKey: process.env.OPENAI_API_KEY_D, 
            baseURL: 'https://api.deepseek.com'
            // Let OpenAI SDK handle fetch internally
        });
        console.log("DeepSeek OpenAI client initialized successfully");
    } else {
        console.warn("OPENAI_API_KEY_D not found. DeepSeek features will be disabled.");
        // Create a mock OpenAI client
        openai = createMockOpenAIClient();
    }

    // Create a separate OpenAI client for agent selection using the standard OpenAI API
    if (process.env.OPENAI_API_KEY) {
        openaiSelector = new OpenAI({ 
            apiKey: process.env.OPENAI_API_KEY
            // Let OpenAI SDK handle fetch internally
        });
        console.log("OpenAI selector client initialized successfully");
    } else {
        console.warn("OPENAI_API_KEY not found. OpenAI selector features will be disabled.");
        openaiSelector = createMockOpenAIClient();
    }

    // Create a separate OpenAI client for audio transcription using the standard OpenAI API
    if (process.env.OPENAI_API_KEY) {
        openaiTranscription = new OpenAI({ 
            apiKey: process.env.OPENAI_API_KEY
            // Don't pass fetch directly for file uploads - let OpenAI SDK handle it
        });
        console.log("OpenAI transcription client initialized successfully");
    } else {
        console.warn("OPENAI_API_KEY not found. OpenAI transcription features will be disabled.");
        openaiTranscription = createMockOpenAIClient();
    }
} catch (error) {
    console.error("Error initializing OpenAI clients:", error);
    // Create mock clients if initialization fails
    openai = createMockOpenAIClient();
    openaiSelector = createMockOpenAIClient();
    openaiTranscription = createMockOpenAIClient();
}

// Helper function to create a mock OpenAI client
function createMockOpenAIClient() {
    return {
        chat: {
            completions: {
                create: async () => ({ 
                    choices: [{ message: { content: "OpenAI API is not available. Please configure your API key." } }] 
                })
            }
        },
        embeddings: {
            create: async () => ({ data: [{ embedding: Array(1536).fill(0) }] })
        },
        audio: {
            transcriptions: {
                create: async () => ({ text: "OpenAI API is not available for transcription." })
            }
        }
    };
}

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
async function beautifyBotResponse(message, questionAsked = false, currentQuestion = null) {
    if (!message || typeof message !== 'string') {
        return message;
    }
    
    try {
        let systemPrompt = "";
        
        if (questionAsked && currentQuestion) {
            // Special prompt when user is asking a question - filter out scoring and explanations
            const questionMarks = currentQuestion.question_marks || 1;
            systemPrompt = `You are a response formatter for an educational chatbot. The user is asking a question about the current question, so you need to:

CRITICAL TASKS - MUST FOLLOW EXACTLY:
1. REMOVE ALL SCORING INFORMATION: Remove any mentions of scores, marks awarded, score breakdowns, or grading information
2. REMOVE PREVIOUS QUESTION EXPLANATIONS: Remove any explanations, feedback, or analysis about the previous question
3. REMOVE SCORE-RELATED TEXT: Remove phrases like "Score:", "You got", "Marks:", "Your answer was", etc.
4. KEEP ONLY THE CURRENT QUESTION: Extract and present only the current question clearly
5. ADD QUESTION MARKS: Show the question with its marks (${questionMarks} mark${questionMarks > 1 ? 's' : ''})
6. ADD LEARN SECTION NOTICE: Add a polite message informing the user that for queries or doubts, they should use the "Learn" section
7. FORMAT NICELY: Use proper markdown formatting with **bold** for the question header

REQUIRED OUTPUT FORMAT (sentence construction can be changed slightly):

💡If you have any queries or doubts about this topic, please use the **Learn** section to get detailed explanations. Please continue with the quiz questions.
---
**Question:** [Current question text]
**Marks:** ${questionMarks} mark${questionMarks > 1 ? 's' : ''}

REMOVE:
- Any scoring information
- Any previous question feedback
- Any explanations of past answers
- Any score-related text

KEEP:
- Only the current question
- Question marks information
- Learn section notice`;
        } else {
            // Normal beautification prompt (preserve everything)
            systemPrompt = `You are a text formatter. Your job is to take educational chatbot responses and make them beautifully formatted and easy to read.

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
- Change the tone or style`;
        }
        
        const beautifyResponse = await openaiSelector.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user", 
                    content: message
                }
            ],
            temperature: 0.2,
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
    // Declare variables outside try block so they're available in catch block
    let userId, message, chapterId;
    
    try {
        // Ensure req.body exists before destructuring
        if (!req.body) {
            return res.status(400).json({ 
                error: "Missing request body", 
                details: "Request body is required"
            });
        }
        
        ({ userId, message, chapterId } = req.body);
        
        // Validate required fields
        if (!userId || !message || !chapterId) {
            return res.status(400).json({ 
                error: "Missing required fields", 
                details: "User ID, chapter ID, and message are required",
                received: {
                    hasUserId: !!userId,
                    hasMessage: !!message,
                    hasChapterId: !!chapterId
                }
            });
        }
        
        // Validate chapterId format (MongoDB ObjectId should be 24 characters)
        if (!isValidObjectId(chapterId)) {
            return res.status(400).json({ 
                error: "Invalid chapter ID format", 
                details: "Chapter ID must be a 24-character hexadecimal string",
                received: {
                    chapterId: chapterId,
                    length: chapterId ? chapterId.length : 0,
                    isValidFormat: isValidObjectId(chapterId)
                }
            });
        }
        
        // Initialize variables for scoring that will be used later in the function
        let marksAwarded = 0;
        let maxScore = 1;

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
        }
        
            // Ensure consistent types for chat lookup
            const chatQuery = { 
                userId: String(userId), 
                chapterId: String(chapterId) 
            };
            
            chat = await Chat.findOne(chatQuery);
            
            // Debug logging for chat lookup issues
            if (!chat) {
                console.log(`🔍 No existing chat found for user ${userId}, chapter ${chapterId} - creating new`);
            } else {
                console.log(`✅ Found existing chat (ID: ${chat._id}) with ${chat.messages?.length || 0} messages`);
            }
        
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
                userId: String(userId), 
                chapterId: String(chapterId), 
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
   - select this agent even if user says he/she don't know the answer and asks to explain the  answer.
   - Not an answer, but a question about the topic 
   - General doubt or concept help
   - If user askes for a clarification of a previously asked question


2. "newchat_ai":
   - First message, like "Hi", "Hello"
   - User says they are ready to begin
   - No previous question in session

3. "closureChat_ai":
   - User wants to stop, see score, or end assessment
   - Says: "finish", "stop", "done", "end", "that's all"`,
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
                } catch (selectorError) {
                    console.error("ERROR in agent selection:", selectorError);
                    // Using the default classification set above
                }

            // Early question detection - check if user is asking a question BEFORE question selection
            // This allows us to skip question selection when questionAsked=true
            let questionAsked = false;
            const shouldUseToolCall = classification === "explanation_ai" || classification === "oldchat_ai" || classification === "newchat_ai";
            
            if (shouldUseToolCall && previousQuestion) {
                // Define tool for question detection
                const questionDetectionTool = {
                    type: "function",
                    function: {
                        name: "detect_question",
                        description: "Detects if the user is asking a question or requesting an explanation. Returns true if a question is asked, false otherwise.",
                        parameters: {
                            type: "object",
                            properties: {
                                questionAsked: {
                                    type: "boolean",
                                    description: "True if the user is asking a question (contains question words like what, why, how, explain, tell me, etc.), false if it's just a statement or command"
                                }
                            },
                            required: ["questionAsked"]
                        }
                    }
                };
                
                try {
                    // Quick early check for question detection
                    const earlyDetectionMessages = [
                        {
                            role: "system",
                            content: "Analyze if the user is asking a question. Return only JSON with questionAsked boolean."
                        },
                        {
                            role: "user",
                            content: message
                        }
                    ];
                    
                    const earlyDetectionResponse = await openaiSelector.chat.completions.create({
                        model: "gpt-4.1",
                        messages: earlyDetectionMessages,
                        tools: [questionDetectionTool],
                        tool_choice: {
                            type: "function",
                            function: { name: "detect_question" }
                        },
                        temperature: 0,
                        max_tokens: 100
                    });
                    
                    const earlyMessage = earlyDetectionResponse.choices[0].message;
                    if (earlyMessage.tool_calls && earlyMessage.tool_calls.length > 0) {
                        const toolCall = earlyMessage.tool_calls[0];
                        if (toolCall.function.name === "detect_question") {
                            const toolArguments = JSON.parse(toolCall.function.arguments);
                            questionAsked = toolArguments.questionAsked || false;
                            // Log the associated question only when user is asking about it
                            if (questionAsked && previousQuestion && previousQuestion.question) {
                                console.log(`QUESTION_LOG: ${previousQuestion.question}`);
                            }
                        }
                    }
                } catch (earlyDetectionError) {
                    console.error("Error in early question detection:", earlyDetectionError);
                    // Continue with default (questionAsked = false)
                }
            }

            // Initialize answeredQuestionIds at a broader scope so both selection and saving logic can access it
            const answeredQuestionIds = [];
            
            // CRITICAL FIX: Save the previous question's answer BEFORE selecting the next question
            // This ensures the DB is up-to-date and prevents question repetition
            // Only run for oldchat_ai (actual answers), NOT for newchat_ai (greetings/initialization)
            if (questionModeEnabled && classification === "oldchat_ai") {
                if (previousQuestion && !(shouldUseToolCall && questionAsked === true)) {
                    // User is answering (not asking about) the previous question
                    // Mark it as answered immediately with a placeholder score
                    // (The actual score will be updated after LLM evaluation)
                    try {
                        // Use a placeholder score - will be updated after LLM response
                        const placeholderScore = 0;
                        const maxScore = previousQuestion.question_marks || 1;
                        
                        await markQuestionAsAnswered(
                            userId,
                            chapterId,
                            previousQuestion.questionId,
                            placeholderScore,
                            maxScore,
                            previousQuestion.question || "",
                            message
                        );
                        
                        console.log(`✅ Pre-saved answer for ${previousQuestion.questionId} before selection`);
                    } catch (preMarkError) {
                        console.error(`❌ ERROR pre-saving answer:`, preMarkError);
                    }
                }
            }
            
            // Handle questions differently based on context
            if (chapter.questionPrompt && chapter.questionPrompt.length > 0) {
                
                // Special case for assessment or explanation mode
                // Skip question selection if user is asking about the current question
                if (questionModeEnabled && (classification === "oldchat_ai" || classification === "newchat_ai")) {
                    // If user is asking a question and we have a previous question, skip selection
                    if (shouldUseToolCall && questionAsked === true && previousQuestion) {
                        console.log(`🔄 Question Asked = true: Skipping question selection, reusing previous question`);
                        currentQuestion = previousQuestion;
                        currentScore = previousQuestion.question_marks || 1;
                        console.log(`🔄 Reusing previous question ID: ${previousQuestion.questionId}`);
                    } else {
                        // Normal flow - proceed with question selection
                    
                    // For assessment mode, we want to select a specific question based on subtopic progression
                    // Check if the user has answered any questions yet for this chapter
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

                    // Track when ALL questions for this chapter have been answered
                    let allQuestionsAnswered = false;
                    
                    // Function to select question based on progression rules
                    function selectQuestionByProgression() {
                        const currentDifficulty = progressionTracker.currentDifficulty;
                        
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
                            return null;
                        }
                        
                        // Get subtopics that haven't been completed at current difficulty
                        const completedSubtopics = progressionTracker.subtopicsCompleted[currentDifficulty];
                        const remainingSubtopics = allSubtopics.filter(subtopic => 
                            !completedSubtopics.includes(subtopic)
                        );
                        
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
                                return selectQuestionByProgression(); // Recursive call with new difficulty
                            } else if (currentDifficulty === "Medium") {
                                progressionTracker.currentDifficulty = "Hard";
                                // Reset the lastSubtopic when changing difficulty
                                progressionTracker.lastSubtopic = "";
                                return selectQuestionByProgression(); // Recursive call with new difficulty
                            } else {
                                // All difficulties completed; check if any unanswered questions remain at all
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
                                } else {
                                    // No unanswered questions remain for this chapter
                                    allQuestionsAnswered = true;
                                }
                            }
                        }
                        
                        return selectedQuestion;
                    }
                    
                    // Select question using progression logic
                    let questionPrompt = selectQuestionByProgression();
                    
                    // Fallback: if no question selected by progression, select any unanswered question.
                    // If there are truly no unanswered questions, switch to closureChat_ai instead of repeating questions.
                    if (!questionPrompt) {
                        const unansweredQuestions = chapter.questionPrompt.filter(q => 
                            !answeredQuestionIds.includes(q.questionId)
                        );
                        
                        if (unansweredQuestions.length > 0) {
                            const randomIndex = Math.floor(Math.random() * unansweredQuestions.length);
                            questionPrompt = unansweredQuestions[randomIndex];
                        } else {
                            // All questions are answered for this chapter
                            allQuestionsAnswered = true;
                        }
                    }
                    
                    // If we still have a question to ask, set it as currentQuestion
                    if (questionPrompt) {
                        currentQuestion = questionPrompt;
                        currentScore = questionPrompt.question_marks || 1;
                        
                        // Save progression tracker back to chat metadata
                        chat.metadata.progressionTracker = progressionTracker;
                        
                    } else if (allQuestionsAnswered) {
                        // No more questions left; change agent to closureChat_ai so user gets summary/closure
                        classification = "closureChat_ai";
                        // Clear currentQuestion/currentScore so frontend doesn't think another question is pending
                        currentQuestion = null;
                        currentScore = null;
                    }
                    } // End of else block for normal question selection
                    
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
                
                // (extensive debug logging removed)
                
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
                
            } else if (classification === "closureChat_ai") {
                console.log(`🎯 [CLOSURE] Starting closureChat_ai flow`);
                
                // Log previous question details
                if (previousQuestion) {
                    console.log(`🎯 [CLOSURE] Previous question (last answered):`, {
                        questionId: previousQuestion.questionId,
                        question: previousQuestion.question?.substring(0, 80) + '...',
                        tentativeAnswer: previousQuestion.tentativeAnswer?.substring(0, 50) || 'N/A',
                        marks: previousQuestion.question_marks || 1
                    });
                    console.log(`🎯 [CLOSURE] User's answer: "${message?.substring(0, 100)}${message?.length > 100 ? '...' : ''}"`);
                } else {
                    console.log(`🎯 [CLOSURE] ⚠️ No previous question found`);
                }
                
                // For closureChat_ai, we use a simplified prompt that ONLY asks for scoring
                // The stats summary will be appended by the backend AFTER the score is saved
                // This ensures accurate stats that include the last answer's score
                const closureScorePrompt = `You are a friendly educational assistant. The user just answered their LAST question in a quiz.

Context:
- Subject: ${bookSubject || "general subject"}
- Grade: ${bookGrade || "appropriate grade"}
- Chapter: ${chapterTitle || "this chapter"}

LAST QUESTION DETAILS:
- Question: ${previousQuestion ? previousQuestion.question : "No previous question"}
- User's Answer: ${message || "No answer provided"}
- Expected/Correct Answer: ${previousQuestion ? (previousQuestion.tentativeAnswer || "Not provided") : "Not provided"}
- Maximum Marks: ${previousQuestion ? previousQuestion.question_marks || 1 : 1}

YOUR JOB: Evaluate and score the user's answer. DO NOT include any quiz summary or statistics - that will be added separately.

SCORING RULES:
- Award FULL marks (${previousQuestion ? previousQuestion.question_marks || 1 : 1}) if the answer is correct or substantially correct
- Award PARTIAL marks (e.g., 0.5) if the answer is partially correct
- Award 0 marks if the answer is wrong, irrelevant, or "I don't know"

RESPONSE FORMAT - Return ONLY this JSON array:
[
  {
    "bot_answer": "**Score for Last Question:** X/${previousQuestion ? previousQuestion.question_marks || 1 : 1}\\n\\n**Explanation:** [Brief explanation of why the answer received this score - what was correct/incorrect]\\n\\n**Great job completing the quiz!** 🎉"
  },
  {
    "score": "X"
  },
  {
    "question_marks": "${previousQuestion ? previousQuestion.question_marks || 1 : 1}"
  }
]

CRITICAL:
1. Replace X with the actual score (0 to ${previousQuestion ? previousQuestion.question_marks || 1 : 1})
2. The "score" field MUST be a STRING containing a number
3. DO NOT include any quiz summary, statistics, or performance data
4. Return ONLY the JSON array, nothing else`;
                
                systemPrompt = closureScorePrompt;
                
                console.log(`🎯 [CLOSURE] System prompt prepared (score-only), length: ${systemPrompt.length} chars`);
                
            } else if (classification === "explanation_ai") {
                // Get the explanation_ai prompt template
                const explanationPrompt = await Prompt.getPromptByType("explanation_ai");
                
                // Initialize chapter content variable
                let chapterContent = chapter.prompt || "No specific content available for this chapter.";
                
                // Check if chapter has a vector store ID
                if (chapter.vectorStoreId) {
                    console.log(`Chapter has vector store ID: ${chapter.vectorStoreId}`);
                    
                    try {
                        // Search the vector store for relevant content based on the user's question
                        const vectorContent = await searchVectorStoreForContent(chapter.vectorStoreId, message);
                        
                        if (vectorContent) {
                            console.log("Found relevant content in vector store");
                            chapterContent = vectorContent;
                        } else {
                            console.log("No relevant content found in vector store, using full chapter content");
                        }
                    } catch (vectorError) {
                        console.error("Error searching vector store:", vectorError);
                        console.log("Using full chapter content due to vector store error");
                    }
                } else {
                    console.log("Chapter doesn't have a vector store ID, creating one");
                    
                    try {
                        // Create a vector store for the chapter
                        await chapter.createVectorStore();
                        await chapter.save();
                        console.log(`Created vector store for chapter: ${chapter.vectorStoreId}`);
                        
                        // No need to search yet since we just created it and the content is the same
                    } catch (createError) {
                        console.error("Error creating vector store:", createError);
                    }
                }
                
                // Replace placeholders with actual values
                systemPrompt = explanationPrompt
                    .replace(/\{\{SUBJECT\}\}/g, bookSubject || "general subject")
                    .replace(/\{\{GRADE\}\}/g, bookGrade || "appropriate grade")
                    .replace(/\{\{CHAPTER_TITLE\}\}/g, chapterTitle || "this chapter")
                    .replace(/\{\{CHAPTER_CONTENT\}\}/g, chapterContent);
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
            
            // Define tool for question detection
            const questionDetectionTool = {
                type: "function",
                function: {
                    name: "detect_question",
                    description: "Detects if the user is asking a question or requesting an explanation. Returns true if a question is asked, false otherwise.",
                    parameters: {
                        type: "object",
                        properties: {
                            questionAsked: {
                                type: "boolean",
                                description: "True if the user is asking a question (contains question words like what, why, how, explain, tell me, etc.), false if it's just a statement or command"
                            }
                        },
                        required: ["questionAsked"]
                    }
                }
            };

            // Note: shouldUseToolCall is already declared earlier in the function (line 462)
            // Make the OpenAI request with retry logic
            const makeOpenAIRequest = async (retryCount = 0, maxRetries = 2) => {
                try {
                    // Attempt the request
                    const requestOptions = {
                        model: "gpt-4.1", // For DeepSeek API we use this model
                        messages: messagesForOpenAI,
                        temperature: 0.25,
                        max_tokens: 1000
                    };
                    
                    // Add tool calling for explanation_ai and oldchat_ai
                    if (shouldUseToolCall) {
                        requestOptions.tools = [questionDetectionTool];
                        requestOptions.tool_choice = {
                            type: "function",
                            function: { name: "detect_question" }
                        }; // Force the tool to be called for question detection
                    }
                    
                    const response = await openaiSelector.chat.completions.create(requestOptions);
            
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
            let openaiResponse = await makeOpenAIRequest();

            if (!openaiResponse || !openaiResponse.choices || !openaiResponse.choices[0]) {
                return res.status(500).json({ error: "Invalid response from OpenAI" });
        }

            // Handle tool calls if they exist
            // Note: questionAsked is already declared earlier (line 461) for early detection
            const openaiMessage = openaiResponse.choices[0].message;
            
            if (shouldUseToolCall && openaiMessage.tool_calls && openaiMessage.tool_calls.length > 0) {
                // Extract questionAsked value from tool call
                const toolCall = openaiMessage.tool_calls[0];
                if (toolCall.function.name === "detect_question") {
                    try {
                        const toolArguments = JSON.parse(toolCall.function.arguments);
                        questionAsked = toolArguments.questionAsked || false;
                        // Note: question text logging already handled in early detection block
                    } catch (parseError) {
                        console.error("Error parsing tool call arguments:", parseError);
                    }
                }
                
                // Add tool response to messages and get final bot response
                messagesForOpenAI.push({
                    role: "assistant",
                    content: openaiMessage.content || null,
                    tool_calls: openaiMessage.tool_calls
                });
                
                // Add tool response
                messagesForOpenAI.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify({ questionAsked: questionAsked })
                });
                
                // Make second request to get the actual bot response
                const requestOptions = {
                    model: "gpt-4.1",
                    messages: messagesForOpenAI,
                    temperature: 0.25,
                    max_tokens: 1000
                };
                
                openaiResponse = await openaiSelector.chat.completions.create(requestOptions);
                
                if (!openaiResponse || !openaiResponse.choices || !openaiResponse.choices[0]) {
                    return res.status(500).json({ error: "Invalid response from OpenAI" });
                }
            } else if (shouldUseToolCall) {
                // Tool call was not made, but we wanted to use it - set default value
                console.log(`🔍 Question Detection: Tool was not called, defaulting questionAsked to false`);
                questionAsked = false;
            }

            // Note: Question reuse when questionAsked=true is now handled earlier 
            // (before question selection) to optimize the flow and avoid unnecessary question selection

            // Extract the bot message
            const botMessage = openaiResponse.choices[0].message.content;

            // Parse array response format for oldchat_ai and closureChat_ai
            let finalBotMessage = botMessage;
            let extractedScore = null;
            let extractedMaxScore = null;
            
            if ((classification === "oldchat_ai" || classification === "closureChat_ai") && previousQuestion) {
                if (classification === "closureChat_ai") {
                    console.log(`🎯 [CLOSURE] Starting score extraction from LLM response`);
                    console.log(`🎯 [CLOSURE] Raw bot message length: ${botMessage?.length || 0} chars`);
                    console.log(`🎯 [CLOSURE] Raw bot message preview: "${botMessage?.substring(0, 150)}..."`);
                }
                
                try {
                    // Check if the response contains array format with brackets
                    if (botMessage.trim().startsWith('[') && botMessage.trim().endsWith(']')) {
                        if (classification === "closureChat_ai") {
                            console.log(`🎯 [CLOSURE] ✅ Response is in array format (starts with [ and ends with ])`);
                        }
                        
                        // Try to parse the response as an array
                        const responseArray = JSON.parse(botMessage);
                        
                        if (classification === "closureChat_ai") {
                            console.log(`🎯 [CLOSURE] ✅ JSON parsed successfully, array length: ${responseArray.length}`);
                        }
                        
                        if (Array.isArray(responseArray) && responseArray.length >= 3) {
                            // Check if it's the new object-based format
                            if (typeof responseArray[0] === 'object' && responseArray[0].bot_answer &&
                                typeof responseArray[1] === 'object' && responseArray[1].score &&
                                typeof responseArray[2] === 'object' && responseArray[2].question_marks) {
                                
                                if (classification === "closureChat_ai") {
                                    console.log(`🎯 [CLOSURE] ✅ Detected object-based array format`);
                                    console.log(`🎯 [CLOSURE] Array structure:`, {
                                        element0: typeof responseArray[0],
                                        element1: typeof responseArray[1],
                                        element2: typeof responseArray[2],
                                        hasBot_answer: !!responseArray[0].bot_answer,
                                        hasScore: !!responseArray[1].score,
                                        hasQuestion_marks: !!responseArray[2].question_marks
                                    });
                                }
                                
                                // New object-based format: [{"bot_answer": "..."}, {"score": "0"}, {"question_marks": "1"}]
                                finalBotMessage = responseArray[0].bot_answer; // Bot answer content
                                extractedScore = parseFloat(responseArray[1].score); // Score for previous question
                                extractedMaxScore = parseFloat(responseArray[2].question_marks); // Max score for previous question
                                
                                console.log(`✅ Parsed object-based array response successfully:`);
                                console.log(`📝 Message: ${finalBotMessage.substring(0, 100)}...`);
                                console.log(`📊 Score: ${extractedScore}/${extractedMaxScore}`);
                                console.log(`🔍 ZERO SCORE DEBUG [Object Array Parse]: extractedScore=${extractedScore}, type=${typeof extractedScore}, isZero=${extractedScore === 0}`);
                                
                                if (classification === "closureChat_ai") {
                                    console.log(`🎯 [CLOSURE] ✅ Score extraction successful:`, {
                                        extractedScore,
                                        extractedMaxScore,
                                        messageLength: finalBotMessage.length
                                    });
                                }
                                
                            } else if (typeof responseArray[0] === 'string' || typeof responseArray[0] === 'number') {
                                if (classification === "closureChat_ai") {
                                    console.log(`🎯 [CLOSURE] ✅ Detected simple array format`);
                                }
                                
                                // Old simple array format: ["message", 0, 2]
                                finalBotMessage = responseArray[0]; // Message content
                                extractedScore = parseFloat(responseArray[1]); // Score for previous question
                                extractedMaxScore = parseFloat(responseArray[2]); // Max score for previous question
                                
                                console.log(`✅ Parsed simple JSON array response successfully:`);
                                console.log(`📝 Message: ${finalBotMessage.substring(0, 100)}...`);
                                console.log(`📊 Score: ${extractedScore}/${extractedMaxScore}`);
                                console.log(`🔍 ZERO SCORE DEBUG [Simple Array Parse]: extractedScore=${extractedScore}, type=${typeof extractedScore}, isZero=${extractedScore === 0}`);
                                
                                if (classification === "closureChat_ai") {
                                    console.log(`🎯 [CLOSURE] ✅ Score extraction successful:`, {
                                        extractedScore,
                                        extractedMaxScore,
                                        messageLength: finalBotMessage.length
                                    });
                                }
                            } else {
                                console.log(`⚠️ Unknown JSON array format, falling back to original message`);
                                if (classification === "closureChat_ai") {
                                    console.log(`🎯 [CLOSURE] ❌ Array format not recognized:`, {
                                        element0Type: typeof responseArray[0],
                                        element1Type: typeof responseArray[1],
                                        element2Type: typeof responseArray[2]
                                    });
                                }
                                finalBotMessage = botMessage;
                            }
                        } else {
                            console.log(`⚠️ JSON array format invalid (length < 3), falling back to original message`);
                            if (classification === "closureChat_ai") {
                                console.log(`🎯 [CLOSURE] ❌ Array length invalid:`, {
                                    isArray: Array.isArray(responseArray),
                                    length: responseArray?.length || 0
                                });
                            }
                            finalBotMessage = botMessage;
                        }
                    } else if (botMessage.includes(',') && botMessage.trim().startsWith('[')) {
                        if (classification === "closureChat_ai") {
                            console.log(`🎯 [CLOSURE] ⚠️ Response starts with [ but doesn't end with ], trying non-JSON array format`);
                        }
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
            
            // If in question mode and classification is oldchat_ai OR closureChat_ai, UPDATE the score that was pre-saved
            // BUT skip if questionAsked is true (user is asking about the question)
            if (classification === "oldchat_ai" || classification === "closureChat_ai") {
                if (classification === "closureChat_ai") {
                    console.log(`🎯 [CLOSURE] Starting score update process`);
                }
                
                // Check if user is asking a question - if so, skip score update
                if (shouldUseToolCall && questionAsked === true) {
                    // User is asking about the question, no score to update
                    if (classification === "closureChat_ai") {
                        console.log(`🎯 [CLOSURE] ⚠️ Skipping score update - user is asking a question`);
                    }
                } else {
                    // Check if we have a valid previous question to update the score for
                    if (previousQuestion) {
                        if (classification === "closureChat_ai") {
                            console.log(`🎯 [CLOSURE] Previous question found, preparing score update`);
                            console.log(`🎯 [CLOSURE] Extracted from LLM:`, {
                                extractedScore,
                                extractedMaxScore,
                                bothNotNull: extractedScore !== null && extractedMaxScore !== null
                            });
                        }
                        
                        // Use extracted scores from array or fallback to 0
                        let marksAwarded = 0;
                        let maxScore = previousQuestion.question_marks || 1;
                        
                        if (extractedScore !== null && extractedMaxScore !== null) {
                            marksAwarded = extractedScore;
                            maxScore = extractedMaxScore;
                            if (classification === "closureChat_ai") {
                                console.log(`🎯 [CLOSURE] Using extracted scores: ${marksAwarded}/${maxScore}`);
                            }
                        } else {
                            // No valid scores in array response, using default
                            if (classification === "closureChat_ai") {
                                console.log(`🎯 [CLOSURE] ⚠️ No extracted scores, using defaults: ${marksAwarded}/${maxScore}`);
                            }
                        }
                        
                        // Verify the extracted score is valid
                        if (isNaN(marksAwarded) || marksAwarded < 0) {
                            if (classification === "closureChat_ai") {
                                console.log(`🎯 [CLOSURE] ⚠️ Invalid marksAwarded (${marksAwarded}), setting to 0`);
                            }
                            marksAwarded = 0;
                        }
                        
                        // Ensure maxScore is positive
                        if (isNaN(maxScore) || maxScore <= 0) {
                            const oldMax = maxScore;
                            maxScore = previousQuestion.question_marks || 1;
                            if (classification === "closureChat_ai") {
                                console.log(`🎯 [CLOSURE] ⚠️ Invalid maxScore (${oldMax}), using question marks: ${maxScore}`);
                            }
                        }
                        
                        // Final score validation - make sure score doesn't exceed max
                        if (marksAwarded > maxScore) {
                            if (classification === "closureChat_ai") {
                                console.log(`🎯 [CLOSURE] ⚠️ marksAwarded (${marksAwarded}) > maxScore (${maxScore}), capping to max`);
                            }
                            marksAwarded = maxScore;
                        }
                        
                        if (classification === "closureChat_ai") {
                            console.log(`🎯 [CLOSURE] Final validated scores: ${marksAwarded}/${maxScore}`);
                        }
                        
                        try {
                            if (classification === "closureChat_ai") {
                                console.log(`🎯 [CLOSURE] Calling markQuestionAsAnswered for ${previousQuestion.questionId}`);
                            }
                            
                            // UPDATE the answer with the actual score (was pre-saved with placeholder)
                            // markQuestionAsAnswered is idempotent - it will update if exists
                            await markQuestionAsAnswered(
                                userId, 
                                chapterId, 
                                previousQuestion.questionId, 
                                marksAwarded, 
                                maxScore,
                                previousQuestion.question || "", // Use previous question text
                                message // Current message is the answer to the previous question
                            );
                            
                            console.log(`✅ Updated score for ${previousQuestion.questionId}: ${marksAwarded}/${maxScore}`);
                            
                            if (classification === "closureChat_ai") {
                                console.log(`🎯 [CLOSURE] ✅ Score update successful!`);
                                
                                // NOW fetch fresh stats AFTER the score is saved
                                console.log(`🎯 [CLOSURE] Fetching fresh stats after score update...`);
                                try {
                                    const freshStats = await QnALists.getChapterStatsForClosure(userId, chapterId);
                                    console.log(`🎯 [CLOSURE] Fresh stats after score update:`, {
                                        totalQuestions: freshStats.totalQuestions,
                                        answeredQuestions: freshStats.answeredQuestions,
                                        totalMarks: freshStats.totalMarks,
                                        earnedMarks: freshStats.earnedMarks,
                                        percentage: freshStats.percentage,
                                        correctAnswers: freshStats.correctAnswers,
                                        partialAnswers: freshStats.partialAnswers,
                                        incorrectAnswers: freshStats.incorrectAnswers
                                    });
                                    
                                    // Build the stats summary to append to the message
                                    const statsSummary = `\n\n---\n\n**📊 Final Quiz Summary for ${chapterTitle}**\n\n` +
                                        `- **Total Score:** ${freshStats.earnedMarks}/${freshStats.totalMarks} (${Math.round(freshStats.percentage)}%)\n` +
                                        `- **Questions Answered:** ${freshStats.answeredQuestions}/${freshStats.totalQuestions}\n` +
                                        `- **Correct:** ${freshStats.correctAnswers} | **Partial:** ${freshStats.partialAnswers} | **Incorrect:** ${freshStats.incorrectAnswers}\n` +
                                        `- **Time Spent:** ${freshStats.timeSpentMinutes} minutes\n\n` +
                                        `*This completes your quiz for this chapter. Great effort! 📚*`;
                                    
                                    // Append the stats summary to the final message
                                    finalBotMessage = finalBotMessage + statsSummary;
                                    console.log(`🎯 [CLOSURE] ✅ Stats summary appended to message`);
                                    
                                } catch (statsError) {
                                    console.error(`🎯 [CLOSURE] ❌ Error fetching fresh stats:`, statsError);
                                    // Continue without stats if there's an error
                                }
                            }
                            
                    } catch (markError) {
                        console.error(`❌ ERROR updating score:`, markError);
                        console.error(`❌ Error details - Question ID: ${previousQuestion.questionId}, Score: ${marksAwarded}/${maxScore}`);
                        if (classification === "closureChat_ai") {
                            console.log(`🎯 [CLOSURE] ❌ Score update failed:`, markError.message);
                        }
                        }
                    } else {
                        console.log(`⚠️ No previous question found to update score for`);
                        if (classification === "closureChat_ai") {
                            console.log(`🎯 [CLOSURE] ⚠️ No previous question available for score update`);
                        }
                    }
                }
            } else {
            }
            
            // Store current question as the previous question for next time, for both oldchat_ai and newchat_ai
            // BUT only rotate if questionAsked is false (user is not asking about the question)
            if (questionModeEnabled && (classification === "oldchat_ai" || classification === "newchat_ai")) {
                // Only rotate question if user is not asking a question about it
                if (shouldUseToolCall && questionAsked === true) {
                    // Don't rotate - keep the same question in previousQuestionsMap
                    console.log(`🔄 Question Asked = true: Keeping same question (no rotation)`);
                    // previousQuestion stays the same, no update to previousQuestionsMap
                } else if (currentQuestion) {
                    // Normal rotation - set new currentQuestion as previousQuestion for next time
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
                try {
                    const originalMessage = finalBotMessage;
                    // Pass questionAsked and currentQuestion to beautifyBotResponse
                    finalBotMessage = await beautifyBotResponse(finalBotMessage, shouldUseToolCall ? questionAsked : false, currentQuestion);
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
            
            // Prepare the response object
            const responseObject = {
                message: finalBotMessage,
                // When in closureChat_ai mode, do not send a question back to the frontend
                questionId: classification === "closureChat_ai"
                    ? null
                    : (currentQuestion ? currentQuestion.questionId : null),
                fullQuestion: classification === "closureChat_ai"
                    ? null
                    : currentQuestion,
                agentType: classification,
                previousQuestionId: previousQuestion ? previousQuestion.questionId : null,
                questionAsked: shouldUseToolCall ? questionAsked : null, // Include questionAsked when tool call was used
                score: {
                    marksAwarded: (previousQuestion && (classification === "oldchat_ai" || classification === "closureChat_ai") && typeof marksAwarded !== 'undefined') ? marksAwarded : null,
                    maxMarks: (previousQuestion && (classification === "oldchat_ai" || classification === "closureChat_ai") && typeof maxScore !== 'undefined') ? maxScore : null,
                    previousQuestion: previousQuestion ? previousQuestion.question : null
                }
            };
            
            if (classification === "closureChat_ai") {
                console.log(`🎯 [CLOSURE] Response object prepared:`, {
                    messageLength: responseObject.message?.length || 0,
                    messagePreview: responseObject.message?.substring(0, 100) + '...',
                    questionId: responseObject.questionId,
                    fullQuestion: responseObject.fullQuestion,
                    agentType: responseObject.agentType,
                    previousQuestionId: responseObject.previousQuestionId,
                    score: responseObject.score
                });
                console.log(`🎯 [CLOSURE] ✅ Closure flow complete - sending response to frontend`);
            }
            
            // Return the response
            return res.json(responseObject);
        } catch (chapterError) {
            console.error("Error fetching chapter:", chapterError);
            if (chapterError.name === 'CastError') {
                console.error(`Invalid chapterId format: ${chapterId}`);
                return res.status(400).json({ error: "Invalid chapter ID format" });
            }
            // Provide more helpful error message and log more details
            console.error("Detailed chapter fetch error:", {
                error: chapterError,
                stack: chapterError.stack,
                chapterId: chapterId
            });
            
            // Check if it's a connection error
            const isConnectionError = 
                chapterError.message.includes("connect") || 
                chapterError.message.includes("ECONNREFUSED") ||
                chapterError.name === "MongooseServerSelectionError";
                
            if (isConnectionError) {
                return res.status(500).json({ 
                    error: "Error fetching chapter details", 
                    details: "Database connection error. Please check your MongoDB connection.",
                    code: "DB_CONNECTION_ERROR"
                });
            }
            
            return res.status(500).json({ 
                error: "Error fetching chapter details", 
                details: chapterError.message || "Unknown error occurred while fetching chapter data"
            });
        }
    } catch (error) {
        // Enhanced error logging for better debugging
        console.error("Error processing chat message:", {
            error: error.message,
            stack: error.stack,
            name: error.name,
            requestDetails: { 
                userId: userId || 'undefined', 
                chapterId: chapterId || 'undefined',
                messageLength: message ? message.length : 0
            }
        });
        
        // Check for specific error types to provide better user feedback
        if (error.name === "MongooseServerSelectionError" || 
            error.message.includes("connect") || 
            error.message.includes("ECONNREFUSED")) {
            return res.status(503).json({ 
                error: "Database connection error", 
                details: "Unable to connect to the database. Please try again later.",
                code: "DB_CONNECTION_ERROR"
            });
        }
        
        if (error.name === "OpenAIError" || 
            error.message.includes("OpenAI") || 
            error.message.includes("API key")) {
            return res.status(503).json({ 
                error: "AI service unavailable", 
                details: "The AI service is currently unavailable. Please try again later.",
                code: "AI_SERVICE_ERROR"
            });
        }
        
        // Handle MongoDB ObjectId casting errors
        if (error.name === "CastError" && error.message.includes("ObjectId")) {
            return res.status(400).json({ 
                error: "Invalid ID format", 
                details: "The provided ID is not in the correct format. Please check your chapter ID.",
                code: "INVALID_ID_FORMAT",
                field: error.path || "unknown"
            });
        }
        
        // Default error response
        return res.status(500).json({ 
            error: "Error processing message", 
            details: error.message || "Unknown error",
            code: "GENERAL_ERROR"
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
        // IMPORTANT: Using transcriptions (not translations) to maintain original language
        console.log('Starting audio transcription with Whisper model...');
        const transcriptionPromise = openaiTranscription.audio.transcriptions.create({
            file: fs.createReadStream(filePathToTranscribe),
            model: "whisper-1",
            response_format: "verbose_json", // Get detailed response with language detection
            temperature: 0.0, // Use deterministic transcription
            prompt: "Transcribe the audio exactly as spoken without translating to another language." // Instruction to not translate
        });

        // Use Promise.race to implement the timeout
        const transcription = await Promise.race([transcriptionPromise, timeoutPromise]);
        
        // Clean up temporary files
        fs.unlinkSync(audioFilePath);
        if (filePathToTranscribe !== audioFilePath && fs.existsSync(filePathToTranscribe)) {
            fs.unlinkSync(filePathToTranscribe);
        }
        
        // Handle verbose_json response format
        const transcribedText = transcription.text || "";
        const detectedLanguage = transcription.language || "unknown";
        
        console.log(`Transcription completed. Detected language: ${detectedLanguage}`);
        console.log(`Transcribed text: "${transcribedText.substring(0, 100)}..."`);
        
        // Check for empty transcription
        if (!transcribedText || transcribedText.trim() === "") {
            return res.status(400).json({ error: "Couldn't transcribe audio. The file might be empty or corrupted." });
        }
        
        // Note: Transcribed text will be saved to chat history when sent to /send endpoint
        // This prevents duplicate saving of the same message

        // Return the transcribed text and redirect to text processing
        return res.status(200).json({
            transcription: transcribedText,
            detectedLanguage: detectedLanguage,
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
        
        // Find chat metadata (used only for internal computation, no logging)
        await Chat.findOne({ userId, chapterId });
        
        // Get stats from QnALists
        const stats = await QnALists.getChapterStats(userId, chapterId);
        
        // Only return stats if there are answered questions
        if (stats.answeredQuestions === 0) {
            return res.json({ hasStats: false });
        }
        
        // Return the stats with a flag indicating there are stats
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
            }
            
            // Delete all QnA records for this user and chapter
            try {
                await QnALists.deleteMany({ studentId: userId, chapterId: chapterId });
            } catch (qnaError) {
                console.error("Error deleting QnA records:", qnaError);
            }
            
            res.json({ 
                success: true, 
                message: `Progress reset for ${resetQuestions.length} questions`,
                progressionReset: true
            });
        } else {
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
        
        // Validate marks first (needed for both Chat and QnALists)
        const validMaxMarks = (!isNaN(maxMarks) && maxMarks > 0) ? parseFloat(maxMarks) : 1;
        const validMarksAwarded = (!isNaN(marksAwarded)) ? Math.max(0, parseFloat(marksAwarded)) : 0;
        
        // Check if this is the first time answering this question
        const isFirstTime = !chat.metadata.answeredQuestions.includes(questionId);
        
        // Add question to the answered list if not already there
        if (isFirstTime) {
            // Add new answered question
            chat.metadata.answeredQuestions.push(questionId);
            
            // Update marks only for first-time answers
            chat.metadata.totalMarks = parseFloat(chat.metadata.totalMarks || 0) + validMaxMarks;
            chat.metadata.earnedMarks = parseFloat(chat.metadata.earnedMarks || 0) + validMarksAwarded;
        } else {
            console.log(`🏆 Question ${questionId} already in answered list, skipping Chat metadata update`);
        }
        
        // ALWAYS record in QnALists (it's idempotent and ensures DB consistency)
        try {
            // Get the chapter to get the bookId and subject
            const chapter = await Chapter.findById(chapterId);
            const chapterBookId = chapter ? chapter.bookId : null;
            
            if (!chapterBookId) {
                console.error(`🏆 Cannot find bookId for chapter ${chapterId}`);
            }
            
            // Get book details to check subject (for language determination)
            let bookSubject = "general subject";
            if (chapterBookId) {
                const book = await Book.findById(chapterBookId);
                if (book) {
                    bookSubject = book.subject || "general subject";
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
            
            await QnALists.recordAnswer(qnaData);
        } catch (qnaError) {
            console.error("🏆 Error recording answer in QnALists:", qnaError);
        }
        
        await chat.save();
        
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

// Helper function to validate MongoDB ObjectId format
function isValidObjectId(id) {
    return typeof id === 'string' && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id);
}

// Add a health check endpoint to verify chat API is working
router.get("/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Chat API is operational",
        timestamp: new Date().toISOString()
    });
});

// Add the missing export statement
/**
 * Helper function to make HTTPS requests with proper error handling
 * @param {string} url - The URL to make the request to
 * @param {Object} options - Request options
 * @returns {Promise<Response>} - The fetch response
 */
async function makeHttpsRequest(url, options = {}) {
    try {
        const response = await fetch(url, options);
        return response;
    } catch (error) {
        console.error(`HTTPS request error: ${error.message}`);
        throw error;
    }
}

/**
 * Search vector store for relevant content based on a user question
 * @param {string} vectorStoreId - The ID of the vector store to search
 * @param {string} userQuestion - The question to search for
 * @returns {Promise<string>} - Relevant content from the vector store
 */
async function searchVectorStoreForContent(vectorStoreId, userQuestion) {
    try {
        // Check if vectorStoreId is valid
        if (!vectorStoreId) {
            console.error('Error: vectorStoreId is undefined or null');
            return null;
        }
        
        console.log(`Searching vector store ${vectorStoreId} for question: "${userQuestion.substring(0, 100)}..."`);
        
        // Configure search parameters
        const maxResults = 5;
        const scoreThreshold = 0.3;
        const rewriteQuery = true;
        
        // Use direct REST API call for more reliable results
        const searchResponse = await makeHttpsRequest(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: userQuestion,
                max_num_results: maxResults,
                rewrite_query: rewriteQuery,
                ranking_options: {
                    score_threshold: scoreThreshold
                }
            })
        });
        
        if (!searchResponse.ok) {
            throw new Error(`HTTP error ${searchResponse.status}: ${await searchResponse.text()}`);
        }
        
        const results = await searchResponse.json();
        
        // Check if we have any results
        if (!results.data || results.data.length === 0) {
            console.log(`No results found in vector store for query`);
            return null;
        }
        
        console.log(`Found ${results.data.length} results in vector store`);
        
        // Extract text content from all results
        const textSources = results.data
            .map(result => 
                result.content
                    .map(content => content.text)
                    .join('\n')
            )
            .join('\n\n');
        
        // Limit content to prevent token overflow
        const maxChars = 5000;
        const limitedContent = textSources.length > maxChars 
            ? textSources.substring(0, maxChars) + "...[truncated]"
            : textSources;
        
        console.log(`Extracted ${limitedContent.length} characters of content from vector store`);
        return limitedContent;
        
    } catch (error) {
        console.error(`Error searching vector store: ${error.message}`);
        return null;
    }
}

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
