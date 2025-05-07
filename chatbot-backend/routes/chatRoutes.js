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
const ffmpeg = require('fluent-ffmpeg');

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
                    .replace("{{QUESTION_MARKS}}", currentQuestion ? currentQuestion.question_marks || 1 : 1)
                    .replace("{{PREVIOUS_QUESTION_MARKS}}", previousQuestion ? previousQuestion.question_marks || 1 : 1);
                
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
            
            // Always save the full message history for all agent types
        chat.messages.push({ role: "assistant", content: botMessage });
        
            // Update the lastActive timestamp
            chat.lastActive = Date.now();
            
        await chat.save();
            
            // If in question mode and classification is oldchat_ai, process scores and update questions
            if (questionModeEnabled && (classification === "oldchat_ai")) {
                // Check if we have a valid previous question to record the answer for
                if (previousQuestion) {
                    // Extract score from assistant message
                    let marksAwarded = 0;
                    const maxScore = previousQuestion.question_marks || 1;
                    
                    // Look for score patterns like "Score: 3/5" or "You earned 4 out of 5 points" or "Score: 3 / 3" with spaces
                    const scorePattern = /(?:score|earned|awarded|get|receive|grade)(?:\s*:)?\s*(\d+\.?\d*)(?:\s*\/\s*|\s+\/\s+|\s+out\s+of\s+)(\d+\.?\d*)/i;
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
                        
                        console.log(`Recorded answer for previous question: ${previousQuestion.questionId}`);
                } catch (markError) {
                    console.error("Error marking question as answered:", markError);
                    }
                }
            }
            
            // Store current question as the previous question for next time, for both oldchat_ai and newchat_ai
            if (questionModeEnabled && (classification === "oldchat_ai" || classification === "newchat_ai")) {
                if (currentQuestion) {
                    previousQuestionsMap.set(userChapterKey, currentQuestion);
                    console.log(`Set current question as previous for next time: ${currentQuestion.questionId}`);
                }
            }
            
            // Log the marksAwarded value before sending the response
            console.log(`Final score to be returned: marksAwarded=${marksAwarded}, classification=${classification}`);
            
            // Return the response
            return res.json({
                message: botMessage,
                questionId: currentQuestion ? currentQuestion.questionId : null,
                fullQuestion: currentQuestion,
                agentType: classification,
                previousQuestionId: previousQuestion ? previousQuestion.questionId : null,
                score: {
                    marksAwarded: (previousQuestion && classification === "oldchat_ai") ? marksAwarded : null,
                    maxMarks: (previousQuestion && classification === "oldchat_ai") ? (previousQuestion.question_marks || 1) : null,
                    previousQuestion: previousQuestion ? previousQuestion.question : null
                }
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
        
        // Add timeout for the OpenAI transcription request
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Transcription request timed out')), 45000);
        });

        // Transcribe the audio using OpenAI's API
        const transcriptionPromise = openaiTranscription.audio.transcriptions.create({
            file: fs.createReadStream(audioFilePath),
            model: "whisper-1"
        });

        // Use Promise.race to implement the timeout
        const transcription = await Promise.race([transcriptionPromise, timeoutPromise]);
        
        // Clean up temporary file
        fs.unlinkSync(audioFilePath);
        
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
        
        console.log(`Fetching chapter stats for chapter ${chapterId} and user ${userId}`);
        
        // Get stats from QnALists
        const stats = await QnALists.getChapterStats(userId, chapterId);
        
        // Only return stats if there are answered questions
        if (stats.answeredQuestions === 0) {
            console.log(`No answered questions for chapter ${chapterId} and user ${userId}`);
            return res.json({ hasStats: false });
        }
        
        // Return the stats with a flag indicating there are stats
        console.log(`Returning stats for chapter ${chapterId}: ${stats.earnedMarks}/${stats.totalMarks}`);
        return res.json({
            hasStats: true,
            earnedMarks: stats.earnedMarks,
            totalMarks: stats.totalMarks,
            percentage: stats.percentage,
            answeredQuestions: stats.answeredQuestions,
            totalQuestions: stats.totalQuestions
        });
        
    } catch (error) {
        console.error("Error fetching chapter stats:", error);
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
                    bookId: chapterBookId,
                    chapterId: chapterId,
                    questionId: questionId,
                    questionMarks: maxMarks,
                    score: marksAwarded,
                    answerText: answerText || "",
                    questionText: questionText || "",
                    agentType: "oldchat_ai" // Always oldchat_ai for answered questions
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
