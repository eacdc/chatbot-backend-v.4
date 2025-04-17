const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const Chapter = require("../models/Chapter");
const OpenAI = require("openai");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const authenticateUser = require("../middleware/authMiddleware");

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

// Send Message & Get AI Response
router.post("/send", authenticateUser, async (req, res) => {
    try {
        const { userId, message, chapterId } = req.body;
        
        console.log(`Send message request - userId: ${userId}, chapterId: ${chapterId || 'none'}, message: ${message.substring(0, 30)}...`);

        if (!userId || !message) {
            return res.status(400).json({ error: "User ID and message are required" });
        }

        // Handle both general chats and chapter-specific chats
        let chat;
        let systemPrompt = "You are a helpful AI assistant that discusses books and literature.";
        
        if (chapterId) {
            console.log(`Looking for existing chat with userId: ${userId}, chapterId: ${chapterId}`);
            chat = await Chat.findOne({ userId, chapterId });
            console.log(`Existing chat found: ${chat ? 'Yes' : 'No'}`);
            
            // Fetch chapter details
            try {
                const chapter = await Chapter.findById(chapterId);
                if (chapter && chapter.prompt) {
                    systemPrompt = chapter.prompt;
                }
            } catch (err) {
                console.error("Error fetching chapter:", err);
                // Continue with default prompt if chapter fetch fails
            }
            
            if (!chat) {
                console.log(`Creating new chat for userId: ${userId}, chapterId: ${chapterId}`);
                chat = new Chat({ userId, chapterId, messages: [] });
            }
        } else {
            // General chat
            chat = await Chat.findOne({ userId, chapterId: null });
            
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
            ...chat.messages.slice(-10) // Last 10 messages for context
        ];

        // Add the new user message
        messagesForOpenAI.push({ role: "user", content: message });
        
        console.log("Sending to OpenAI:", messagesForOpenAI);

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
        
        console.log(`Saving chat with ${chat.messages.length} messages`);
        await chat.save();
        console.log("Chat saved successfully");

        res.json({ response: botMessage });

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
        const openAIPromise = makeTranscriptionRequest();
        const transcription = await Promise.race([openAIPromise, timeoutPromise]);

        // Clean up the audio file
        fs.unlink(audioFilePath, (err) => {
            if (err) console.error("Error deleting audio file:", err);
            else console.log("Audio file deleted successfully");
        });

        res.json({ text: transcription.text });
    } catch (error) {
        console.error("Error transcribing audio:", error);
        
        // Clean up the audio file if it exists
        if (req.file) {
            const audioFilePath = path.join(__dirname, "../uploads", req.file.filename);
            fs.unlink(audioFilePath, (err) => {
                if (err) console.error("Error deleting audio file:", err);
            });
        }
        
        // Add specific error messages based on the error type
        if (error.message === 'OpenAI transcription timed out') {
            return res.status(504).json({ 
                error: "Audio transcription timed out. Please try with a shorter audio clip." 
            });
        }
        
        // Check for OpenAI API errors
        if (error.response?.status) {
            console.error("OpenAI API error:", error.response.status, error.response.data);
            return res.status(502).json({ 
                error: "Error from transcription service. Please try again later." 
            });
        }
        
        res.status(500).json({ 
            error: "Error transcribing audio", 
            message: error.message || "Unknown error" 
        });
    }
});

// Get chat history for a specific user
router.get("/history/:userId", authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const chat = await Chat.findOne({ userId, chapterId: null });

        if (!chat || !Array.isArray(chat.messages)) {
            return res.json([]);
        }

        res.json(chat.messages);

    } catch (error) {
        console.error("Error fetching chat history:", error);
        res.status(500).json({ error: "Failed to fetch chat history" });
    }
});

// Get chat history for a specific chapter
router.get("/chapter-history/:chapterId", authenticateUser, async (req, res) => {
    try {
        const { chapterId } = req.params;
        
        // Get the userId from the request headers
        const userId = req.headers['user-id'];
        
        if (!userId) {
            return res.status(400).json({ error: "User ID is required in headers" });
        }
        
        console.log(`Looking for chat with userId: ${userId}, chapterId: ${chapterId}`);
        
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

module.exports = router;
