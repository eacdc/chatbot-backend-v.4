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

// Send Message & Get AI Response with Question Prompts
router.post("/send", authenticateUser, async (req, res) => {
    try {
        const { userId, message, chapterId } = req.body;

        if (!userId || !message || !chapterId) {
            return res.status(400).json({ error: "User ID, chapter ID, and message are required" });
        }

        // Get the questionMode config
        const questionModeEnabled = await isQuestionModeEnabled();

        // Handle chapter-specific chats
        let chat;
        let currentQuestion = null;
        let currentScore = null;
        let previousMessages = [];
        let bookGrade = null;
        let bookSubject = null;
        let bookId = null;
        let chapterTitle = "General Chapter";
        
        chat = await Chat.findOne({ userId, chapterId });
        
        // Get previous messages for context
        if (chat && chat.messages && chat.messages.length > 0) {
            if (classification === "explanation_ai") {
                // For explanation agent, use more context - last 6 messages
                previousMessages = chat.messages.slice(-6);
            } else {
                // For other agents, use limited context - last 2 assistant + 1 user message
                const assistantMessages = chat.messages.filter(msg => msg.role === "assistant").slice(-2);
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
            let classification = "explanation_ai"; // Default classification
            try {
                const intentAnalysis = await openaiSelector.chat.completions.create({
                    model: "gpt-4o",
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
                    
                    // For assessment mode, we want to select a specific question
                    // Check if the user has answered any questions yet for this chapter
                    const answeredQuestionIds = [];
                    try {
                        // Get all questions the user has answered for this chapter
                        const answeredQuestions = await QnALists.getAnsweredQuestionsForChapter(userId, chapterId);
                        answeredQuestions.forEach(q => answeredQuestionIds.push(q.questionId));
                    } catch (error) {
                        // If there's an error, assume no questions answered
                    }
                    
                    // Filter for unanswered questions
                    const unansweredQuestions = chapter.questionPrompt.filter(q => !answeredQuestionIds.includes(q.questionId));
                    
                    let questionPrompt;
                    let randomIndex;
                    
                    if (unansweredQuestions.length > 0) {
                        // Randomly select an unanswered question
                        randomIndex = Math.floor(Math.random() * unansweredQuestions.length);
                        questionPrompt = unansweredQuestions[randomIndex];
                        console.log(`Selected question: ID=${questionPrompt.questionId}, Q="${questionPrompt.question ? questionPrompt.question.substring(0, 50) + '...' : 'No question text'}"`);
                    } else {
                        // If all questions are answered, randomly select any question
                        randomIndex = Math.floor(Math.random() * chapter.questionPrompt.length);
                        questionPrompt = chapter.questionPrompt[randomIndex];
                        console.log(`All questions answered. Selected random question: ID=${questionPrompt.questionId}, Q="${questionPrompt.question ? questionPrompt.question.substring(0, 50) + '...' : 'No question text'}"`);
                    }
                    
                    currentQuestion = questionPrompt;
                    currentScore = questionPrompt.question_marks || 1;
                    
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
                    .replace("{{SUBJECT}}", bookSubject || "general subject")
                    .replace("{{GRADE}}", bookGrade || "appropriate grade")
                    .replace("{{CHAPTER_TITLE}}", chapterTitle || "this chapter")
                    .replace("{{QUESTION}}", currentQuestion ? currentQuestion.question : "review questions")
                    .replace("{{QUESTION_ID}}", currentQuestion ? currentQuestion.questionId : "Q1")
                    .replace("{{QUESTION_MARKS}}", currentQuestion ? currentQuestion.question_marks || 1 : 1);
                
            } else if (classification === "newchat_ai") {
                // Get the newchat_ai prompt template
                const newChatPrompt = await Prompt.getPromptByType("newchat_ai");
                
                // Replace placeholders with actual values
                systemPrompt = newChatPrompt
                    .replace("{{SUBJECT}}", bookSubject || "general subject")
                    .replace("{{GRADE}}", bookGrade || "appropriate grade")
                    .replace("{{CHAPTER_TITLE}}", chapterTitle || "this chapter")
                    .replace("{{QUESTION}}", currentQuestion ? currentQuestion.question : "review questions")
                    .replace("{{QUESTION_ID}}", currentQuestion ? currentQuestion.questionId : "Q1")
                    .replace("{{QUESTION_MARKS}}", currentQuestion ? currentQuestion.question_marks || 1 : 1);
                
            } else if (classification === "closureChat_ai") {
                // Get the closurechat_ai prompt template
                const closureChatPrompt = await Prompt.getPromptByType("closurechat_ai");
                
                // Get stats for the user on this chapter
                const statsForClosure = await QnALists.getChapterStatsForClosure(userId, chapterId);
                
                // Replace placeholders with actual values
                systemPrompt = closureChatPrompt
                    .replace("{{SUBJECT}}", bookSubject || "general subject")
                    .replace("{{GRADE}}", bookGrade || "appropriate grade")
                    .replace("{{CHAPTER_TITLE}}", chapterTitle || "this chapter")
                    .replace("{{TOTAL_QUESTIONS}}", statsForClosure.totalQuestions)
                    .replace("{{ANSWERED_QUESTIONS}}", statsForClosure.answeredQuestions)
                    .replace("{{TOTAL_MARKS}}", statsForClosure.totalMarks)
                    .replace("{{EARNED_MARKS}}", statsForClosure.earnedMarks)
                    .replace("{{PERCENTAGE}}", Math.round(statsForClosure.percentage))
                    .replace("{{CORRECT_ANSWERS}}", statsForClosure.correctAnswers)
                    .replace("{{PARTIAL_ANSWERS}}", statsForClosure.partialAnswers)
                    .replace("{{INCORRECT_ANSWERS}}", statsForClosure.incorrectAnswers)
                    .replace("{{TIME_SPENT}}", statsForClosure.timeSpentMinutes);
                
            } else if (classification === "explanation_ai") {
                // Get the explanation_ai prompt template
                const explanationPrompt = await Prompt.getPromptByType("explanation_ai");
                
                // Replace placeholders with actual values
                systemPrompt = explanationPrompt
                    .replace("{{SUBJECT}}", bookSubject || "general subject")
                    .replace("{{GRADE}}", bookGrade || "appropriate grade")
                    .replace("{{CHAPTER_TITLE}}", chapterTitle || "this chapter")
                    .replace("{{CHAPTER_CONTENT}}", chapter.prompt || "No specific content available for this chapter.");
            } else {
                // Default to explanation prompt for unrecognized classifications
                const explanationPrompt = await Prompt.getPromptByType("explanation_ai");
                
                // Replace placeholders with actual values
                systemPrompt = explanationPrompt
                    .replace("{{SUBJECT}}", bookSubject || "general subject")
                    .replace("{{GRADE}}", bookGrade || "appropriate grade")
                    .replace("{{CHAPTER_TITLE}}", chapterTitle || "this chapter")
                    .replace("{{CHAPTER_CONTENT}}", chapter.prompt || "No specific content available for this chapter.");
            }
            
            // Add formatting instructions to the prompt
            systemPrompt += `\n\nPlease format your response using Markdown for clarity. Use **bold** for important points, *italics* for emphasis, and - for bullet points when listing items.`;
            
            // If we have no questions or question mode is disabled, default to an explanation prompt
            if (!chapter.questionPrompt || chapter.questionPrompt.length === 0) {
                // Get the explanation_ai prompt template as a fallback
                const explanationPrompt = await Prompt.getPromptByType("explanation_ai");
                
                // Replace placeholders with actual values
                systemPrompt = explanationPrompt
                    .replace("{{SUBJECT}}", bookSubject || "general subject")
                    .replace("{{GRADE}}", bookGrade || "appropriate grade")
                    .replace("{{CHAPTER_TITLE}}", chapterTitle || "this chapter")
                    .replace("{{CHAPTER_CONTENT}}", chapter.prompt || "No specific content available for this chapter.");
                
                // Add formatting instructions
                systemPrompt += `\n\nPlease format your response using Markdown for clarity. Use **bold** for important points, *italics* for emphasis, and - for bullet points when listing items.`;
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
                    const response = await openaiSelector.chat.completions.create({
                        model: "gpt-4o", // For DeepSeek API we use this model
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
            console.log(`Bot reply ${botMessage}`);
            
            // Save the message to chat history, managing history based on agent type
            chat.messages.push({ role: "user", content: message });
            
            // For explanation_ai agent, keep full history. For all other agents, keep limited history
            if (classification === "explanation_ai") {
                // Save the full message history for explanation agent
                chat.messages.push({ role: "assistant", content: botMessage });
            } else {
                // For all other agents, keep only last 2 assistant messages and 1 user message
                // First, get all assistant messages
                const assistantMessages = chat.messages.filter(msg => msg.role === "assistant");
                // Get the last user message (which we just added)
                const lastUserMessage = chat.messages.filter(msg => msg.role === "user").slice(-1);
                
                // Keep only the last 2 assistant messages (if they exist)
                const lastTwoAssistantMessages = assistantMessages.slice(-2);
                
                // Rebuild the messages array with limited history
                chat.messages = [...lastTwoAssistantMessages, ...lastUserMessage];
                
                // Add the current assistant message
                chat.messages.push({ role: "assistant", content: botMessage });
            }
            
            // Update the lastActive timestamp
            chat.lastActive = Date.now();
            
            await chat.save();
            
            // If in question mode and we have a question, check for updating question status
            if (questionModeEnabled && currentQuestion && (classification === "oldchat_ai")) {
                // Process the bot response to estimate if the user's answer was correct
                // and award some marks based on the response
                
                // Extract score from assistant message when using oldchat_ai agent
                let marksAwarded = 0;
                const maxScore = currentScore || 1;
                
                // Look for score patterns like "Score: 3/5" or "You earned 4 out of 5 points" in the bot message
                const scorePattern = /(?:score|earned|awarded|get|receive|grade)(?:\s*:)?\s*(\d+\.?\d*)(?:\s*\/\s*|\s+out\s+of\s+)(\d+\.?\d*)/i;
                const scoreMatch = botMessage.match(scorePattern);
                
                if (scoreMatch && scoreMatch.length >= 3) {
                    // Extract score from the matched pattern (first group is awarded, second is max)
                    const extractedScore = parseFloat(scoreMatch[1]);
                    marksAwarded = extractedScore;
                    console.log(`Extracted score from message: ${marksAwarded}/${maxScore}`);
                } else {
                    // Fallback to the old method of approximate marking if score not explicitly found
                    const positiveResponse = botMessage.toLowerCase().match(/\b(correct|right|well done|good job|excellent|perfect|spot on|exactly|accurate|yes|indeed)\b/);
                    const partialResponse = botMessage.toLowerCase().match(/\b(partially|almost|close|not quite|incomplete|partly|somewhat|nearly|approaching)\b/);
                    const negativeResponse = botMessage.toLowerCase().match(/\b(incorrect|wrong|not right|mistake|error|no,|afraid not|unfortunately|not correct|not accurate)\b/);
                    
                    if (positiveResponse) {
                        // Award full marks for positive responses
                        marksAwarded = maxScore;
                    } else if (partialResponse) {
                        // Award partial marks for partially correct answers
                        marksAwarded = maxScore / 2;
                    } else if (negativeResponse) {
                        // No marks for negative responses
                        marksAwarded = 0;
                    } else {
                        // If we can't determine, award partial marks
                        marksAwarded = maxScore / 3;
                    }
                    console.log(`Estimated score from message patterns: ${marksAwarded}/${maxScore}`);
                }
                
                try {
                    // Record the answer in the database with question text and user's answer
                    await markQuestionAsAnswered(
                        userId, 
                        chapterId, 
                        currentQuestion.questionId, 
                        marksAwarded, 
                        maxScore,
                        currentQuestion.question || "", // Pass question text
                        message // Pass user's answer (current message)
                    );
                } catch (markError) {
                    console.error("Error marking question as answered:", markError);
                    // Don't fail the request if marking fails, just log the error
                }
            }
            
            // Return the response
            return res.json({
                message: botMessage,
                questionId: currentQuestion ? currentQuestion.questionId : null,
                fullQuestion: currentQuestion,
                agentType: classification
            });
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

        // console.log removed;
        const audioFilePath = path.join(__dirname, "../uploads", req.file.filename);

        // Add timeout for the OpenAI transcription request
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('OpenAI transcription timed out')), 300000); // 5 minutes timeout
        });
        
        // Function to make OpenAI transcription request with retry logic
        const makeTranscriptionRequest = async (retryCount = 0, maxRetries = 2) => {
            try {
                // console.log removed;
                
                // Use the dedicated OpenAI client for transcription
                const transcription = await openaiTranscription.audio.transcriptions.create({
                    file: fs.createReadStream(audioFilePath),
                    model: "whisper-1",
                });
                
                if (!transcription || !transcription.text) {
                    throw new Error("Invalid transcription response from OpenAI");
                }
                
                return transcription;
            } catch (error) {
                // If we've reached max retries, throw the error
                if (retryCount >= maxRetries) {
                    throw error;
                }
                
                // console.log removed;
                
                // Wait before retrying (exponential backoff: 2s, 4s)
                await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retryCount)));
                
                // Try again with incremented retry count
                return makeTranscriptionRequest(retryCount + 1, maxRetries);
            }
        };
        
        // Race the promises
        const transcriptionPromise = makeTranscriptionRequest();
        const transcription = await Promise.race([transcriptionPromise, timeoutPromise]);

        // Clean up file after transcription is complete
        fs.unlink(audioFilePath, (err) => {
            if (err) {
                console.error("Error removing audio file:", err);
            } else {
                // console.log removed;
            }
        });
        
        // Check for empty transcription
        if (!transcription.text || transcription.text.trim() === "") {
            return res.status(400).json({ error: "Couldn't transcribe audio. The file might be empty or corrupted." });
        }
        
        // console.log removed;
        
        // Now handle the message similar to text input but through the /send endpoint
        const { userId, chapterId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        // Instead of duplicating the logic to process the message here,
        // we'll call the /send endpoint with the transcribed text
        // This ensures consistent handling of messages for both text and audio
        
        // Return both the transcribed text and redirect to text processing
        res.json({ 
            transcription: transcription.text,
            redirect: true,
            message: transcription.text,
            userId: userId,
            chapterId: chapterId || null
        });

    } catch (error) {
        console.error("Error in audio transcription:", error);
        
        // Add specific error messages based on the error type
        if (error.message.includes('timed out')) {
            return res.status(504).json({ 
            error: "Processing timed out. The audio may be too long or complex. Please try again with a shorter recording." 
            });
        }
        
        // Check for OpenAI API errors
        if (error.response?.status) {
            console.error("OpenAI API error:", error.response.status, error.response.data);
            return res.status(502).json({ 
            error: "Error from AI service. Please try again later." 
            });
        }
        
        res.status(500).json({ 
          error: "Error processing audio", 
            message: error.message || "Unknown error" 
        });
    }
});

// Get Chat History for a Specific Chapter
router.get("/chapter-history/:chapterId", authenticateUser, async (req, res) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user.userId;
        
        // console.log removed;
        
        const chat = await Chat.findOne({ userId, chapterId });
        
        if (!chat || !Array.isArray(chat.messages)) {
            // console.log removed;
            return res.json([]);
        }
        
        // console.log removed;
        res.json(chat.messages);
        
    } catch (error) {
        console.error("Error fetching chapter chat history:", error);
        res.status(500).json({ error: "Failed to fetch chapter chat history" });
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

// Reset question status for a chapter
router.post("/reset-questions/:chapterId", authenticateUser, async (req, res) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user.userId;
        
        // console.log removed;
        
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
            
            // Also update the user's chat history to reflect reset
            existingChat.messages = [];
            await existingChat.save();
            
            // console.log removed;
            res.json({ success: true, message: `Progress reset for ${resetQuestions.length} questions` });
        } else {
            // No chat history found, nothing to reset
            // console.log removed;
            res.json({ success: true, message: "No progress to reset" });
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
        // Find or create the chat document
        let chat = await Chat.findOne({ userId, chapterId });
        
        if (!chat) {
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
        }
        
        // Initialize metadata if it doesn't exist
        if (!chat.metadata) {
            chat.metadata = {
                answeredQuestions: [],
                totalMarks: 0,
                earnedMarks: 0
            };
        }
        
        if (!Array.isArray(chat.metadata.answeredQuestions)) {
            chat.metadata.answeredQuestions = [];
        }
        
        // Add question to the answered list if not already there
        if (!chat.metadata.answeredQuestions.includes(questionId)) {
            chat.metadata.answeredQuestions.push(questionId);
            
            // Update marks
            chat.metadata.totalMarks = (chat.metadata.totalMarks || 0) + maxMarks;
            chat.metadata.earnedMarks = (chat.metadata.earnedMarks || 0) + marksAwarded;
            
            // Also record in QnALists
            try {
                console.log(`Recording answer for question ${questionId} in QnALists`);
                
                // Get the chapter to get the bookId
                const chapter = await Chapter.findById(chapterId);
                const chapterBookId = chapter ? chapter.bookId : null;
                
                if (!chapterBookId) {
                    console.error(`Cannot find bookId for chapter ${chapterId}`);
                }
                
                await QnALists.recordAnswer({
                    studentId: userId,
                    bookId: chapterBookId, // Use the bookId from the chapter
                    chapterId: chapterId,
                    questionId: questionId,
                    questionMarks: maxMarks,
                    score: marksAwarded,
                    answerText: answerText || "",
                    questionText: questionText || ""
                });
            } catch (qnaError) {
                console.error("Error recording answer in QnALists:", qnaError);
            }
        }
        
        await chat.save();
    } catch (error) {
        console.error("Error marking question as answered:", error);
        throw error;
    }
}

// Add the missing export statement
module.exports = router;
