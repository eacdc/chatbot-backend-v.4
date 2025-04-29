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
const Score = require("../models/Score");

// Initialize default configs if needed
(async () => {
  try {
    await Config.initDefaults();
    console.log("Config defaults initialized");
  } catch (error) {
    console.error("Error initializing config defaults:", error);
  }
})();

// Function to get questionMode config
async function isQuestionModeEnabled() {
  try {
    const config = await Config.findOne({ key: 'questionMode' });
    return config ? config.value : false; // Default to false if not found
  } catch (error) {
    console.error("Error fetching questionMode config:", error);
    return false; // Default to false on error
  }
}

if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: Missing OpenAI API Key in environment variables.");
    process.exit(1);
}

// Create an OpenAI client using DeepSeek for chat completions
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_D, baseURL: 'https://api.deepseek.com' });

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
        
        console.log(`Send message request - userId: ${userId}, chapterId: ${chapterId || 'none'}, message: ${message.substring(0, 30)}...`);

        if (!userId || !message) {
            return res.status(400).json({ error: "User ID and message are required" });
        }

        // Get the questionMode config
        const questionModeEnabled = await isQuestionModeEnabled();
        console.log(`Question mode ${questionModeEnabled ? 'enabled' : 'disabled'}`);

        // Handle both general chats and chapter-specific chats
        let chat;
        let systemPrompt = "You are a helpful AI assistant that discusses books and literature.";
        let currentQuestion = null;
        let currentScore = null;
        let previousMessages = [];
        let chatStatus = "Start"; // Default status
        
        if (chapterId) {
            console.log(`Looking for existing chat with userId: ${userId}, chapterId: ${chapterId}`);
            chat = await Chat.findOne({ userId, chapterId });
            console.log(`Existing chat found: ${chat ? 'Yes' : 'No'}`);
            
            // Get previous messages for context
            if (chat && chat.messages && chat.messages.length > 0) {
                // Get last 6 messages or all if less than 6
                previousMessages = chat.messages.slice(-6);
                console.log(`Retrieved ${previousMessages.length} previous messages for context`);
                
                // Check if chat has status metadata
                if (chat.metadata && chat.metadata.status) {
                    chatStatus = chat.metadata.status;
                    console.log(`Using existing chat status: ${chatStatus}`);
                } else {
                    // If we have previous messages, this is not the start of the chat
                    if (previousMessages.length >= 2) { // At least one exchange
                        chatStatus = "In Progress";
                    }
                }
            }
            
            if (!chat) {
                console.log(`Creating new chat for userId: ${userId}, chapterId: ${chapterId}`);
                chat = new Chat({ 
                    userId, 
                    chapterId, 
                    messages: [],
                    metadata: { status: chatStatus }
                });
            } else if (!chat.metadata) {
                // Ensure metadata exists
                chat.metadata = { status: chatStatus };
            }
            
            // Fetch chapter details
            try {
                const chapter = await Chapter.findById(chapterId);
                
                if (chapter) {
                    // Get associated book information for grade level and subject
                    let bookGrade = null;
                    let bookSubject = null;
                    let bookId = null;
                    let chapterTitle = chapter.title || "General Chapter";
                    
                    try {
                        const book = await Book.findById(chapter.bookId);
                        if (book) {
                            bookId = book._id;
                            bookSubject = book.subject || "General";
                            if (book.grade) {
                                bookGrade = book.grade;
                                console.log(`Found book grade: ${bookGrade}`);
                            }
                        }
                    } catch (bookErr) {
                        console.error("Error fetching book information:", bookErr);
                    }

                    // Now, before continuing with the chat, use OpenAI's function calling to determine user intent
                    // Define functions that can be called
                    const functions = [
                        {
                            name: "update_chat_status",
                            description: "Update the status of the current chat based on user intent",
                            parameters: {
                                type: "object",
                                properties: {
                                    status: {
                                        type: "string",
                                        enum: ["Start", "In Progress", "Stop"],
                                        description: "The new status of the chat"
                                    },
                                    reason: {
                                        type: "string",
                                        description: "The reason for changing the status"
                                    }
                                },
                                required: ["status"]
                            }
                        }
                    ];

                    // Create a message to analyze user intent
                    const intentAnalysisMessages = [
                        {
                            role: "system",
                            content: `You are a chat intent analyzer. Determine if the user intends to:
1. Start answering questions (set status to "Start")
2. Continue answering questions (set status to "In Progress")
3. Stop/pause answering questions (set status to "Stop")

Current chat status: ${chatStatus}

Rules:
- If the user explicitly asks to stop, pause, or end the quiz/assessment, set status to "Stop"
- If the user explicitly asks to start, begin, or continue the quiz/assessment, set status to "Start"
- If the user is simply answering a question without meta-conversation, set status to "In Progress"
- If the current status is "Stop" and the user sends a new message without explicitly asking to restart, keep the status as "Stop"
- Only change status if there's a clear intent from the user`
                        },
                        { role: "user", content: message }
                    ];

                    console.log("Analyzing user intent to determine chat status...");
                    
                    // First, analyze the user's intent
                    const intentAnalysis = await openai.chat.completions.create({
                        model: "deepseek-chat",
                        messages: intentAnalysisMessages,
                        functions: functions,
                        function_call: "auto",
                        temperature: 0.1,
                    });

                    // Check if a function was called
                    let statusChanged = false;
                    if (intentAnalysis.choices[0].message.function_call) {
                        const functionCall = intentAnalysis.choices[0].message.function_call;
                        
                        if (functionCall.name === "update_chat_status") {
                            try {
                                const functionArgs = JSON.parse(functionCall.arguments);
                                const newStatus = functionArgs.status;
                                const reason = functionArgs.reason || "User intent detected";
                                
                                // Only update if status actually changes
                                if (newStatus !== chatStatus) {
                                    console.log(`Changing chat status from ${chatStatus} to ${newStatus}. Reason: ${reason}`);
                                    chatStatus = newStatus;
                                    chat.metadata.status = chatStatus;
                                    statusChanged = true;
                                } else {
                                    console.log(`Chat status remains ${chatStatus}`);
                                }
                            } catch (jsonError) {
                                console.error("Error parsing function arguments:", jsonError);
                            }
                        }
                    } else {
                        console.log(`No function call detected, maintaining status: ${chatStatus}`);
                    }

                    // Question mode behavior
                    let isQuestionMode = false;
                    let questionPrompt = null;
                    
                    // Check if we should proceed based on chat status
                    if (chatStatus === "Stop") {
                        console.log("Chat is currently stopped. Will respond accordingly.");
                        // Create a response indicating the chat is paused
                        const aiMessage = {
                            role: 'assistant',
                            content: "The quiz is currently paused. Let me know when you'd like to continue."
                        };
                        
                        // Save the exchange
                        chat.messages.push({ role: 'user', content: message });
                        chat.messages.push(aiMessage);
                        await chat.save();
                        
                        return res.json({ message: aiMessage.content });
                    }
                    
                    // Only proceed with question mode if chat is "Start" or "In Progress"
                    try {
                        const config = await Config.findOne();
                        isQuestionMode = config ? config.questionMode : false;
                        console.log(`Question mode is ${isQuestionMode ? 'enabled' : 'disabled'}`);
                    } catch (configError) {
                        console.error("Error checking question mode config:", configError);
                    }
                    
                    if (isQuestionMode && chapter && chapter.questionPrompt && chapter.questionPrompt.length > 0) {
                        console.log("Using question mode behavior");
                        
                        // If this is the start of the chat or we just changed to "Start" status, use the first question
                        if (chatStatus === "Start" || (statusChanged && chatStatus === "Start")) {
                            // Reset to the first question when explicitly starting
                            questionPrompt = chapter.questionPrompt[0];
                            console.log("Starting with first question");
                        } else {
                            // Find the next question or cycle back to the beginning
                            if (previousMessages && previousMessages.length > 0) {
                                // Check if the last assistant message was a question from our list
                                let lastQuestion = -1;
                                for (let i = previousMessages.length - 1; i >= 0; i--) {
                                    if (previousMessages[i].role === 'assistant') {
                                        // Find which question this was
                                        for (let q = 0; q < chapter.questionPrompt.length; q++) {
                                            if (previousMessages[i].content.includes(chapter.questionPrompt[q])) {
                                                lastQuestion = q;
                                                break;
                                            }
                                        }
                                        if (lastQuestion >= 0) break;
                                    }
                                }
                                
                                if (lastQuestion >= 0) {
                                    // Move to the next question or cycle back
                                    const nextQuestion = (lastQuestion + 1) % chapter.questionPrompt.length;
                                    questionPrompt = chapter.questionPrompt[nextQuestion];
                                    console.log(`Moving from question ${lastQuestion} to ${nextQuestion}`);
                                } else {
                                    // Couldn't identify the last question, start with the first one
                                    questionPrompt = chapter.questionPrompt[0];
                                    console.log("Could not identify last question, starting with first question");
                                }
                            } else {
                                // No previous messages, start with the first question
                                questionPrompt = chapter.questionPrompt[0];
                                console.log("No previous messages, starting with first question");
                            }
                        }
                        
                        // Update chat status to "In Progress" if user is answering questions
                        if (chatStatus === "Start") {
                            chatStatus = "In Progress";
                            chat.metadata.status = chatStatus;
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching chapter:", err);
                // Continue with default prompt if chapter fetch fails
            }
        } else {
            // General chat
            chat = await Chat.findOne({ userId, chapterId: null });
            
            // Get previous messages for context
            if (chat && chat.messages && chat.messages.length > 0) {
                // Get last 6 messages or all if less than 6
                previousMessages = chat.messages.slice(-6);
                console.log(`Retrieved ${previousMessages.length} previous messages for context`);
            }
            
            if (!chat) {
                chat = new Chat({ userId, chapterId: null, messages: [] });
            }
        }

        // Add formatting instructions to system prompt
        systemPrompt += `
        
        IMPORTANT FORMATTING INSTRUCTIONS:
        1. Do NOT use LaTeX formatting for mathematical expressions. Use plain text for all math.
        2. Do NOT use special syntax like \\text, \\frac, or other LaTeX commands.
        3. Do NOT put units in parentheses. Instead of writing (10 m/s), write 10 m/s.
        4. Format mathematical operations and expressions simply:
           - Instead of writing "( 10 , \\text{m/s} - 5 , \\text{m/s} = 5 , \\text{m/s} )", write "10 m/s - 5 m/s = 5 m/s"
           - Instead of writing "( \\frac{5 , \\text{m/s}}{2 , \\text{s}} = 2.5 , \\text{m/s}^2 )", write "5 m/s ÷ 2 s = 2.5 m/s²" or "5 m/s / 2 s = 2.5 m/s²"
        5. Use standard characters for exponents where possible (e.g., m/s², km², etc.).
        6. Keep all mathematical expressions simple and readable, using plain text formatting only.`;
        
        if (!Array.isArray(chat.messages)) {
            console.log("Messages is not an array, initializing empty array");
            chat.messages = [];
        }

        // Construct messages for OpenAI
        let messagesForOpenAI = [
            { role: "system", content: systemPrompt },
        ];
        
        // Add previous messages for context if available
        if (previousMessages.length > 0) {
            messagesForOpenAI = messagesForOpenAI.concat(previousMessages);
        }

        // Add the new user message
        messagesForOpenAI.push({ role: "user", content: message });
        
        console.log("Sending to OpenAI...");

        // Add a timeout for the OpenAI request
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('OpenAI request timed out')), 600000); // 10 minutes timeout
        });
        
        // Function to make OpenAI request with retry logic
        const makeOpenAIRequest = async (retryCount = 0, maxRetries = 2) => {
          try {
            console.log(`Chat message attempt ${retryCount + 1}/${maxRetries + 1}`);
            
            // Send request to OpenAI
            const response = await openai.chat.completions.create({
              model: "deepseek-chat",
              messages: messagesForOpenAI,
              temperature: 0.15,
            });
            
            if (!response || !response.choices || response.choices.length === 0) {
              throw new Error("Invalid response from OpenAI");
            }
            
            return response;
          } catch (error) {
            // If we've reached max retries, throw the error
            if (retryCount >= maxRetries) {
              throw error;
            }
            
            console.log(`Retry ${retryCount + 1}/${maxRetries} due to error: ${error.message}`);
            
            // Wait before retrying (exponential backoff: 2s, 4s)
            await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retryCount)));
            
            // Try again with incremented retry count
            return makeOpenAIRequest(retryCount + 1, maxRetries);
          }
        };
        
        // Race the promises
        const openAIPromise = makeOpenAIRequest();
        const response = await Promise.race([openAIPromise, timeoutPromise]);

        if (!response || !response.choices || response.choices.length === 0) {
            throw new Error("Invalid response from OpenAI");
        }

        const botMessage = response.choices[0].message.content;

        // Add messages and save...
        chat.messages.push({ role: "user", content: message });
        chat.messages.push({ role: "assistant", content: botMessage });
        chat.metadata = { ...chat.metadata, status: chatStatus };
        
        console.log(`Saving chat with ${chat.messages.length} messages and status: ${chatStatus}`);
        await chat.save();
        console.log("Chat saved successfully");

        // If this was a question being answered and question mode is enabled, mark it as answered
        if (questionModeEnabled && currentQuestion && chapterId && chatStatus === "In Progress") {
            try {
                const chapter = await Chapter.findById(chapterId);
                if (chapter && chapter.questionPrompt) {
                    // Find the question and mark it as answered
                    const questionIndex = chapter.questionPrompt.findIndex(q => q.Q === currentQuestion.Q);
                    if (questionIndex !== -1) {
                        // Extract marks awarded from AI response
                        let marksAwarded = 0;
                        const maxMarks = currentQuestion.question_marks || 1;
                        
                        // Look for MARKS: pattern in the response
                        const marksMatch = botMessage.match(/MARKS:\s*(\d+)\/(\d+)/i);
                        if (marksMatch && marksMatch.length >= 3) {
                            marksAwarded = parseInt(marksMatch[1], 10);
                            console.log(`AI awarded ${marksAwarded} out of ${maxMarks} marks`);
                        } else {
                            // If no MARKS pattern found, assume full marks for now
                            // In production, you might want to handle this differently
                            marksAwarded = maxMarks;
                            console.log(`No marks pattern found, assuming ${marksAwarded} marks`);
                        }
                        
                        // Update chapter with marks gained
                        chapter.questionPrompt[questionIndex].question_answered = true;
                        chapter.questionPrompt[questionIndex].marks_gained = marksAwarded;
                        await chapter.save();
                        console.log(`Marked question ${currentQuestion.Q} as answered with ${marksAwarded} marks`);
                        
                        // Update score record if we have one
                        if (currentScore) {
                            try {
                                await Score.updateQuestionScore(currentScore._id, currentQuestion.Q, marksAwarded);
                                console.log(`Updated score record ${currentScore._id} with ${marksAwarded} marks for question ${currentQuestion.Q}`);
                            } catch (scoreErr) {
                                console.error("Error updating score:", scoreErr);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Error updating question status:", err);
                // Continue without failing the request
            }
        }

        // Send the response to the user with current status
        res.json({ 
            response: botMessage,
            chatStatus: chatStatus
        });

    } catch (error) {
        console.error("Error in chatbot API:", error);
        
        // Add specific error messages based on the error type
        if (error.message === 'OpenAI request timed out') {
          return res.status(504).json({ 
            error: "Chat processing timed out. Please try again with a shorter message." 
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
          error: "Error getting response", 
          message: error.message || "Unknown error" 
        });
    }
});

// Transcribe audio and get AI response
router.post("/transcribe", authenticateUser, upload.single("audio"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No audio file uploaded" });
        }

        console.log("Transcribing audio file:", req.file.filename);
        const audioFilePath = path.join(__dirname, "../uploads", req.file.filename);

        // Add timeout for the OpenAI transcription request
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('OpenAI transcription timed out')), 300000); // 5 minutes timeout
        });
        
        // Function to make OpenAI transcription request with retry logic
        const makeTranscriptionRequest = async (retryCount = 0, maxRetries = 2) => {
            try {
                console.log(`Transcription attempt ${retryCount + 1}/${maxRetries + 1}`);
                
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
                
                console.log(`Retry ${retryCount + 1}/${maxRetries} due to error: ${error.message}`);
                
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
                console.log("Audio file removed successfully:", req.file.filename);
            }
        });
        
        // Check for empty transcription
        if (!transcription.text || transcription.text.trim() === "") {
            return res.status(400).json({ error: "Couldn't transcribe audio. The file might be empty or corrupted." });
        }
        
        console.log("Transcription successful:", transcription.text.substring(0, 50) + "...");
        
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
        
        console.log(`Getting chapter chat history for userId: ${userId}, chapterId: ${chapterId}`);
        
        const chat = await Chat.findOne({ userId, chapterId });
        
        if (!chat || !Array.isArray(chat.messages)) {
            console.log("No chat found or messages is not an array");
            return res.json([]);
        }
        
        console.log(`Found chat with ${chat.messages.length} messages`);
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
        
        console.log(`Getting general chat history for userId: ${userId}`);
        
        const chat = await Chat.findOne({ userId, chapterId: null });
        
        if (!chat || !Array.isArray(chat.messages)) {
            console.log("No general chat found or messages is not an array");
            return res.json([]);
        }
        
        console.log(`Found general chat with ${chat.messages.length} messages`);
        res.json(chat.messages);
        
    } catch (error) {
        console.error("Error fetching general chat history:", error);
        res.status(500).json({ error: "Failed to fetch general chat history" });
    }
});

// Reset all question status for a chapter (to allow re-answering questions)
router.post("/reset-questions/:chapterId", authenticateUser, async (req, res) => {
    try {
        // Check if question mode is enabled
        const questionModeEnabled = await isQuestionModeEnabled();
        if (!questionModeEnabled) {
            return res.status(400).json({ 
                error: "Question mode is disabled. Enable it in system configuration to use this feature."
            });
        }

        const { chapterId } = req.params;
        const { randomize } = req.body; // Optional flag to randomize question order
        
        console.log(`Resetting all questions for chapterId: ${chapterId}`);
        
        const chapter = await Chapter.findById(chapterId);
        
        if (!chapter || !chapter.questionPrompt || chapter.questionPrompt.length === 0) {
            return res.status(404).json({ error: "Chapter not found or has no questions" });
        }
        
        // Reset all questions to unanswered
        chapter.questionPrompt.forEach(q => {
            q.question_answered = false;
            // Reset marks_gained if it exists
            if (q.marks_gained !== undefined) {
                q.marks_gained = 0;
            }
        });
        
        await chapter.save();
        
        // Clear existing chat history for this chapter for this user
        const userId = req.user.userId;
        await Chat.findOneAndDelete({ userId, chapterId });
        
        // Get all questions in the chapter
        let questions = chapter.questionPrompt;
        
        // If randomize flag is true, shuffle the order of questions and return them
        if (randomize) {
            questions = [...questions]; // Create a copy to avoid modifying the original
            
            // Fisher-Yates shuffle algorithm
            for (let i = questions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [questions[i], questions[j]] = [questions[j], questions[i]];
            }
            
            console.log("Questions have been randomized");
        }
        
        res.json({ 
            success: true, 
            message: `Reset ${chapter.questionPrompt.length} questions successfully`,
            questions: questions,
            randomized: !!randomize
        });
        
    } catch (error) {
        console.error("Error resetting chapter questions:", error);
        res.status(500).json({ error: "Failed to reset chapter questions" });
    }
});

// Get all questions for a chapter with their answer status
router.get("/questions/:chapterId", authenticateUser, async (req, res) => {
    try {
        // Check if question mode is enabled
        const questionModeEnabled = await isQuestionModeEnabled();
        if (!questionModeEnabled) {
            return res.status(400).json({ 
                error: "Question mode is disabled. Enable it in system configuration to use this feature."
            });
        }
        
        const { chapterId } = req.params;
        
        console.log(`Getting questions for chapterId: ${chapterId}`);
        
        const chapter = await Chapter.findById(chapterId);
        
        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }
        
        if (!chapter.questionPrompt || chapter.questionPrompt.length === 0) {
            return res.json({ 
                chapterId,
                title: chapter.title,
                hasQuestions: false,
                questions: []
            });
        }
        
        res.json({ 
            chapterId,
            title: chapter.title,
            hasQuestions: true,
            questions: chapter.questionPrompt
        });
        
    } catch (error) {
        console.error("Error fetching chapter questions:", error);
        res.status(500).json({ error: "Failed to fetch chapter questions" });
    }
});

// Get score history for a user
router.get("/scores/:userId", authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Ensure the user can only access their own scores
        if (req.user.userId !== userId) {
            return res.status(403).json({ error: "Unauthorized: You can only access your own scores" });
        }
        
        const scores = await Score.find({ userId })
            .sort({ createdAt: -1 })
            .populate('chapterId', 'title')
            .populate('bookId', 'title grade');
        
        res.json(scores);
    } catch (error) {
        console.error("Error fetching user scores:", error);
        res.status(500).json({ error: "Failed to fetch scores" });
    }
});

// Get chapter scores for a user
router.get("/scores/:userId/:chapterId", authenticateUser, async (req, res) => {
    try {
        const { userId, chapterId } = req.params;
        
        // Ensure the user can only access their own scores
        if (req.user.userId !== userId) {
            return res.status(403).json({ error: "Unauthorized: You can only access your own scores" });
        }
        
        const scores = await Score.find({ userId, chapterId })
            .sort({ createdAt: -1 })
            .populate('chapterId', 'title')
            .populate('bookId', 'title grade');
        
        res.json(scores);
    } catch (error) {
        console.error("Error fetching chapter scores:", error);
        res.status(500).json({ error: "Failed to fetch chapter scores" });
    }
});

// Get current score for a chapter attempt
router.get("/current-score/:userId/:chapterId", authenticateUser, async (req, res) => {
    try {
        const { userId, chapterId } = req.params;
        
        // Ensure the user can only access their own scores
        if (req.user.userId !== userId) {
            return res.status(403).json({ error: "Unauthorized: You can only access your own scores" });
        }
        
        const score = await Score.findLatestAttempt(userId, chapterId);
        
        if (!score) {
            return res.status(404).json({ error: "No score record found for this chapter" });
        }
        
        res.json(score);
    } catch (error) {
        console.error("Error fetching current score:", error);
        res.status(500).json({ error: "Failed to fetch current score" });
    }
});

// Get a random unanswered question from a chapter
router.get("/random-question/:chapterId", authenticateUser, async (req, res) => {
    try {
        // Check if question mode is enabled
        const questionModeEnabled = await isQuestionModeEnabled();
        if (!questionModeEnabled) {
            return res.status(400).json({ 
                error: "Question mode is disabled. Enable it in system configuration to use this feature."
            });
        }
        
        const { chapterId } = req.params;
        const userId = req.user.userId;
        
        console.log(`Getting random question for chapterId: ${chapterId}, userId: ${userId}`);
        
        const chapter = await Chapter.findById(chapterId);
        
        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }
        
        if (!chapter.questionPrompt || chapter.questionPrompt.length === 0) {
            return res.json({ 
                chapterId,
                title: chapter.title,
                hasQuestions: false,
                message: "No questions available in this chapter"
            });
        }
        
        // Find all unanswered questions
        const unansweredQuestions = chapter.questionPrompt.filter(q => !q.question_answered);
        
        if (unansweredQuestions.length === 0) {
            return res.json({
                chapterId,
                title: chapter.title,
                hasQuestions: true,
                allAnswered: true,
                message: "All questions in this chapter have been answered",
                totalQuestions: chapter.questionPrompt.length
            });
        }
        
        // Select a random unanswered question
        const randomIndex = Math.floor(Math.random() * unansweredQuestions.length);
        const randomQuestion = unansweredQuestions[randomIndex];
        
        // Get associated book information
        let bookInfo = {
            grade: null,
            subject: null
        };
        
        try {
            const book = await Book.findById(chapter.bookId);
            if (book) {
                bookInfo.grade = book.grade || null;
                bookInfo.subject = book.subject || null;
            }
        } catch (bookErr) {
            console.error("Error fetching book information:", bookErr);
        }
        
        // Return the question with metadata
        res.json({
            chapterId,
            title: chapter.title,
            hasQuestions: true,
            allAnswered: false,
            question: {
                ...randomQuestion.toObject(),
                // Omit sensitive information if needed
            },
            questionsRemaining: unansweredQuestions.length,
            totalQuestions: chapter.questionPrompt.length,
            bookInfo
        });
        
    } catch (error) {
        console.error("Error fetching random question:", error);
        res.status(500).json({ error: "Failed to fetch random question" });
    }
});

module.exports = router;
