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
        
        console.log(`Send message request - userId: ${userId}, chapterId: ${chapterId}, message: ${message.substring(0, 30)}...`);

        if (!userId || !message || !chapterId) {
            return res.status(400).json({ error: "User ID, chapter ID, and message are required" });
        }

        // Get the questionMode config
        const questionModeEnabled = await isQuestionModeEnabled();
        console.log(`Question mode ${questionModeEnabled ? 'enabled' : 'disabled'}`);

        // Handle chapter-specific chats
        let chat;
        let systemPrompt = "You are a helpful AI assistant that discusses books and literature.";
        let currentQuestion = null;
        let currentScore = null;
        let previousMessages = [];
        let bookGrade = null;
        let bookSubject = null;
        let bookId = null;
        let chapterTitle = "General Chapter";
        
        console.log(`Looking for existing chat with userId: ${userId}, chapterId: ${chapterId}`);
        chat = await Chat.findOne({ userId, chapterId });
        console.log(`Existing chat found: ${chat ? 'Yes' : 'No'}`);
        
        // Get previous messages for context
        if (chat && chat.messages && chat.messages.length > 0) {
            // Get last 6 messages or all if less than 6
            previousMessages = chat.messages.slice(-6);
            console.log(`Retrieved ${previousMessages.length} previous messages for context`);
        }
        
        if (!chat) {
            console.log(`Creating new chat for userId: ${userId}, chapterId: ${chapterId}`);
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
                    if (book.grade) {
                        bookGrade = book.grade;
                        console.log(`Found book grade: ${bookGrade}`);
                    }
                }
            } catch (bookErr) {
                console.error("Error fetching book information:", bookErr);
            }

            // Get the last 3 messages from the chat history for context
            const lastThreeMessages = previousMessages.slice(-6).filter(msg => msg.role === 'user' || msg.role === 'assistant').slice(-6);
            console.log(`Including ${lastThreeMessages.length} previous messages for context in classification`);
            
            // Create messages array for the classifier with chat history
            const intentAnalysisMessages = [
                {
                    role: "system",
                    content: `You are an AI that classifies user messages based on their intent.

If the user starts a new conversation, asks to end the assessment or question answering, or requests clarification, explanation, or understanding about any answer, respond with: "explain_ai".

If the user is asking to start the assessment or question answering or only answering a question as part of an ongoing assessment, respond with: "assessment_ai".
Return only the agent name: "explain_ai" or "assessment_ai". Do not include any additional text or explanation.`
                }
            ];
            
            // Add chat history
            lastThreeMessages.forEach(msg => {
                intentAnalysisMessages.push({ role: msg.role, content: msg.content });
            });
            
            // Add the current user message
            intentAnalysisMessages.push({ role: "user", content: message });

            // Log that we're calling the classifier
            console.log(`Calling AI selector to determine appropriate agent for handling the message`);
            
            // Call OpenAI to get the agent classification - using GPT-3.5 with temperature 0 for consistent outputs
            let classification = "explain_ai"; // Default classification
            try {
                const intentAnalysis = await openaiSelector.chat.completions.create({
                    model: "gpt-3.5-turbo",  // Using GPT-3.5 for agent selection (widely available)
                    messages: intentAnalysisMessages,
                    temperature: 0,  // Using temperature 0 for consistent, deterministic outputs
                });

                // Extract the classification
                classification = intentAnalysis.choices[0].message.content.trim();
                
                // Log the selected agent
                console.log(`AI Selector Result: Will use "${classification}" agent to handle this message`);
            } catch (selectorError) {
                console.error("Error with agent selection:", selectorError);
                // Using the default classification set above
                console.log(`Error in agent selection, defaulting to "${classification}"`);
            }

            // Question mode behavior
            let questionPrompt = null;
            
            if (questionModeEnabled && chapter && chapter.questionPrompt && chapter.questionPrompt.length > 0) {
                console.log("Using question mode behavior");
                
                // Only select a question if classification is assessment_ai
                if (classification === "assessment_ai") {
                    console.log("Assessment AI selected, getting next randomized unanswered question");
                    
                    // Find all unanswered questions
                    const unansweredQuestions = chapter.questionPrompt.filter(q => !q.question_answered);
                    
                    if (unansweredQuestions.length > 0) {
                        // Select a random unanswered question
                        const randomIndex = Math.floor(Math.random() * unansweredQuestions.length);
                        questionPrompt = unansweredQuestions[randomIndex];
                        console.log(`Selected random unanswered question (${unansweredQuestions.length} remaining): "${questionPrompt.question ? questionPrompt.question.substring(0, 30) + '...' : 'No question text'}"`);
                    } else {
                        // If all questions answered, cycle through questions again
                        const randomIndex = Math.floor(Math.random() * chapter.questionPrompt.length);
                        questionPrompt = chapter.questionPrompt[randomIndex];
                        console.log(`All questions answered, selected random question from all ${chapter.questionPrompt.length} questions: "${questionPrompt.question ? questionPrompt.question.substring(0, 30) + '...' : 'No question text'}"`);
                    }
                } else {
                    // For explain_ai, use the first question as reference
                    questionPrompt = chapter.questionPrompt[0];
                    console.log("Using explain_ai, using first question as reference");
                }
            }

            // Construct system prompt based on context and classification
            if (questionModeEnabled && questionPrompt) {
                // Using the improved question mode prompt template
                const grade = bookGrade || "appropriate grade";
                const subject = bookSubject || "general";
                const totalMarks = questionPrompt.question_marks || 5;
                const question = questionPrompt.question;
                
                // Select prompt based on classification type
                if (classification && classification === "assessment_ai") {
                    // Use the strict teacher prompt for assessment_ai
                    systemPrompt = `You are a strict but friendly teacher evaluating a Grade ${grade} student's understanding of ${subject}, Chapter: ${chapterTitle} through a one-on-one knowledge check.

✅ Behavior & Flow:
1. Ask the question naturally:
Present the Question as if you're speaking to the student in a conversational, teacher-like tone.

Add a short leading sentence to transition into the question, e.g.:

"Let's move on to the next one."

"Alright, here comes your next question."

"Think carefully and answer this:"

Then follow with:

${question} (${totalMarks} marks)
🚫 Do not paraphrase or reword the question itself.
✅ Make the lead-in sound like a real teacher speaking.
🙊 Don't offer hints unless asked.

2. When the student answers:
Evaluate based on:

Accuracy

Relevance

Completeness

Respond in this format:

Score: x/${totalMarks}
Explanation: [Clear, short explanation based on the student's answer]
Scoring rules:

Fully correct = full marks, short reinforcement

Partially correct = partial marks, explain what was missing

Incorrect = 0 marks, kindly give correct answer

Keep tone firm but supportive. Use simple real-life examples or emojis where helpful, e.g. 🌿, 👶, 💡.

3. Automatically continue:
After scoring, immediately ask the next question (using updated Question variable).

Use a natural lead-in like:

"Next one."

"Here's another for you."

"Try this one now:"

Then present the question just like before.

🚫 Do not ask if the user wants to continue.
✅ Continue automatically unless the student says "stop."

4. Tone and Language:
Speak like a real teacher: clear, confident, structured.

Be encouraging but firm — you're guiding the student toward better understanding.

Always respond in the same language the user is using.

Explanations should be short, direct, and clear — no fluff.`;

                    console.log("Using ASSESSMENT_AI with strict teacher evaluation prompt");
                } else {
                    // Original prompt format for explain_ai and other classifications
                    systemPrompt = `You are a strict yet friendly teacher helping students with their doubts based on for chapter name ${chapterTitle}, subject ${subject}, grade ${grade}. When a user starts the conversation, greet them politely but firmly and ask if they'd like to do a quick knowledge check on that chapter. Once they agree or decline, answer their questions clearly and thoroughly, keeping responses focused on the relevant curriculum. Your main motive should be to direct the conversation towards a knowledge check/Question answering.

Be warm but authoritative — like a teacher who expects discipline but genuinely wants the student to succeed.

If the user asks off-topic questions, gently but firmly steer them back.

Tailor your answers to the user's grade level.

Never skip an explanation unless the student seems confident.

Initial Greeting Example:
"Hello! Ready to dive into ${chapterTitle}? Would you like to start with a quick knowledge check?"

After that, begin answering the user's questions, don't ask if user have any doubt or not, user will ask him/herself, you just try to direct the conversation towards a knowledge check.

Question for reference: ${question} (${totalMarks} marks)`;

                    console.log("Using EXPLAIN_AI with teacher guidance prompt");
                }
                
                // Add formatting instructions to whichever prompt was chosen
                systemPrompt += `

IMPORTANT FORMATTING INSTRUCTIONS:
1. Do NOT use LaTeX formatting for mathematical expressions. Use plain text for all math.
2. Do NOT use special syntax like \\text, \\frac, or other LaTeX commands.
3. Do NOT put units in parentheses. Instead of writing (10 m/s), write 10 m/s.
4. Format mathematical operations and expressions simply.
5. Use standard characters for exponents where possible (e.g., m/s², km², etc.).
6. Keep all mathematical expressions simple and readable, using plain text formatting only.`;

                // Log the complete system prompt with the question - ensure classification is defined
                const promptType = classification ? classification.toUpperCase() : "DEFAULT";
                console.log(`=============== ${promptType} SYSTEM PROMPT ===============`);
                console.log(systemPrompt);
                console.log("=============================================================");
                
                // Store the current question for scoring purposes
                currentQuestion = questionPrompt;
            } else {
                // Default prompt when no question is available
                const grade = bookGrade || "appropriate grade";
                const subject = bookSubject || "general";
                
                // Use a simplified explain_ai prompt without specific question references
                systemPrompt = `You are a strict yet friendly teacher helping students with their doubts based on for chapter name ${chapterTitle}, subject ${subject}, grade ${grade}. When a user starts the conversation, greet them politely but firmly and ask if they'd like to do a quick knowledge check on that chapter. Once they agree or decline, answer their questions clearly and thoroughly, keeping responses focused on the relevant curriculum. Your main motive should be to direct the conversation towards a knowledge check/Question answering.

Be warm but authoritative — like a teacher who expects discipline but genuinely wants the student to succeed.

If the user asks off-topic questions, gently but firmly steer them back.

Tailor your answers to the user's grade level.

Never skip an explanation unless the student seems confident.

Initial Greeting Example:
"Hello! Ready to dive into ${chapterTitle}? Would you like to start with a quick knowledge check?"

After that, begin answering the user's questions, don't ask if user have any doubt or not, user will ask him/herself, you just try to direct the conversation towards a knowledge check.`;

                // Add formatting instructions
                systemPrompt += `

IMPORTANT FORMATTING INSTRUCTIONS:
1. Do NOT use LaTeX formatting for mathematical expressions. Use plain text for all math.
2. Do NOT use special syntax like \\text, \\frac, or other LaTeX commands.
3. Do NOT put units in parentheses. Instead of writing (10 m/s), write 10 m/s.
4. Format mathematical operations and expressions simply.
5. Use standard characters for exponents where possible (e.g., m/s², km², etc.).
6. Keep all mathematical expressions simple and readable, using plain text formatting only.`;
                
                // Log the default prompt
                console.log("=============== DEFAULT CHAPTER PROMPT ===============");
                console.log(systemPrompt);
                console.log("====================================================");
            }
            
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
            console.log(`${classification} agent generated a response (${botMessage.length} chars)`);

            // Add messages and save...
            chat.messages.push({ role: "user", content: message });
            chat.messages.push({ role: "assistant", content: botMessage });
            
            console.log(`Saving chat with ${chat.messages.length} messages`);
            await chat.save();
            console.log("Chat saved successfully");

            // If this was a question being answered and question mode is enabled, mark it as answered
            if (questionModeEnabled && currentQuestion && classification === "assessment_ai") {
                try {
                    if (chapter && chapter.questionPrompt) {
                        // Find the question and mark it as answered
                        const questionIndex = chapter.questionPrompt.findIndex(q => q.Q === currentQuestion.Q);
                        if (questionIndex !== -1) {
                            // Extract marks awarded from AI response
                            let marksAwarded = 0;
                            const maxMarks = currentQuestion.question_marks || 1;
                            
                            // Look for Score: pattern in the response
                            const marksMatch = botMessage.match(/Score:\s*(\d+)\/(\d+)/i);
                            if (marksMatch && marksMatch.length >= 3) {
                                marksAwarded = parseInt(marksMatch[1], 10);
                                console.log(`AI awarded ${marksAwarded} out of ${maxMarks} marks`);
                            } else {
                                // If no Score pattern found, assume full marks for now
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

            // Send the response to the user
            res.json({ 
                response: botMessage
            });
            
        } catch (chapterError) {
            console.error("Error processing chapter:", chapterError);
            res.status(500).json({ error: "Error processing chapter", message: chapterError.message });
        }

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
