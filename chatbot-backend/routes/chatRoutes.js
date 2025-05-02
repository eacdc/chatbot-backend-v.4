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

// Function to get questionMode config - always enabled now
async function isQuestionModeEnabled() {
  // Always return true - question mode is always enabled
  console.log("Question mode is always enabled by default");
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
        
        console.log(`\n\n========== NEW MESSAGE REQUEST ==========`);
        console.log(`User: ${userId}, Chapter: ${chapterId}, Message: "${message.substring(0, 30)}..."`);

        if (!userId || !message || !chapterId) {
            console.log(`ERROR: Missing required parameters`);
            return res.status(400).json({ error: "User ID, chapter ID, and message are required" });
        }

        // Get the questionMode config
        const questionModeEnabled = await isQuestionModeEnabled();
        console.log(`STEP 1: Question mode ${questionModeEnabled ? 'ENABLED' : 'DISABLED'}`);

        // Handle chapter-specific chats
        let chat;
        let currentQuestion = null;
        let currentScore = null;
        let previousMessages = [];
        let bookGrade = null;
        let bookSubject = null;
        let bookId = null;
        let chapterTitle = "General Chapter";
        
        console.log(`STEP 2: Looking for existing chat - userId: ${userId}, chapterId: ${chapterId}`);
            chat = await Chat.findOne({ userId, chapterId });
        console.log(`- Chat found: ${chat ? 'Yes' : 'No'}`);
        
        // Get previous messages for context
        if (chat && chat.messages && chat.messages.length > 0) {
            // Get last 6 messages or all if less than 6
            previousMessages = chat.messages.slice(-6);
            console.log(`- Previous messages: ${previousMessages.length}`);
            
            // Log last message if available
            if (previousMessages.length > 0) {
                const lastMsg = previousMessages[previousMessages.length - 1];
                console.log(`- Last message: ${lastMsg.role} - "${lastMsg.content.substring(0, 30)}..."`);
            }
        }
        
        if (!chat) {
            console.log(`- Creating new chat`);
            chat = new Chat({ 
                userId, 
                chapterId, 
                messages: [],
                metadata: {}
            });
        }
            
            // Fetch chapter details
        try {
            console.log(`STEP 3: Fetching chapter details for ${chapterId}`);
            const chapter = await Chapter.findById(chapterId);
            
            if (!chapter) {
                console.log(`ERROR: Chapter not found`);
                return res.status(404).json({ error: "Chapter not found" });
            }
            
            // Get associated book information for grade level and subject
            chapterTitle = chapter.title || "General Chapter";
            console.log(`- Chapter title: ${chapterTitle}`);
            
            try {
                console.log(`- Fetching book information`);
                const book = await Book.findById(chapter.bookId);
                if (book) {
                    bookId = book._id;
                    bookSubject = book.subject || "General";
                    bookGrade = book.grade;
                    console.log(`- Book info: Subject=${bookSubject}, Grade=${bookGrade}`);
                } else {
                    console.log(`- No book found`);
                }
            } catch (bookErr) {
                console.error("- Error fetching book information:", bookErr);
            }

            // Add diagnostic logging for question detection
            console.log(`CHAPTER DIAGNOSTICS:`);
            console.log(`- Chapter ID: ${chapter._id}`);
            console.log(`- Chapter Title: ${chapter.title}`);
            console.log(`- Has prompt: ${!!chapter.prompt}`);
            if (chapter.prompt) {
                console.log(`- Prompt length: ${chapter.prompt.length} chars`);
                console.log(`- Prompt starts with: "${chapter.prompt.substring(0, 30)}..."`);
                console.log(`- Prompt contains "Q": ${chapter.prompt.includes('"Q"')}`);
                console.log(`- Prompt contains "question": ${chapter.prompt.includes('"question"')}`);
                console.log(`- Prompt starts with [: ${chapter.prompt.trim().startsWith('[')}`);
                console.log(`- Prompt ends with ]: ${chapter.prompt.trim().endsWith(']')}`);
            }
            console.log(`- Has questionPrompt array: ${!!chapter.questionPrompt}`);
            if (chapter.questionPrompt) {
                console.log(`- questionPrompt is Array: ${Array.isArray(chapter.questionPrompt)}`);
                console.log(`- questionPrompt length: ${Array.isArray(chapter.questionPrompt) ? chapter.questionPrompt.length : 'Not an array'}`);
                if (Array.isArray(chapter.questionPrompt) && chapter.questionPrompt.length > 0) {
                    console.log(`- First question Q: ${chapter.questionPrompt[0].Q}`);
                    console.log(`- First question text: "${chapter.questionPrompt[0].question.substring(0, 30)}..."`);
                }
            }

            // Get the last 3 messages from the chat history for context
            console.log(`STEP 4: Preparing for agent classification`);
            const lastThreeMessages = previousMessages.slice(-6).filter(msg => msg.role === 'user' || msg.role === 'assistant').slice(-6);
            console.log(`- Messages for context: ${lastThreeMessages.length}`);
            
            // Create messages array for the classifier with chat history
            const intentAnalysisMessages = [
                {
                    role: "system",
                    content: `You are an AI that classifies user messages based on their intent.

If any of the following conditions are met, respond with "assessment_ai":
1. The user indicates they're ready to start answering questions (words like "ready", "let's start", "begin", "understood", "got it", "ok", "yes")
2. The user is directly answering a question 
3. The user asks for a question or assessment
4. The user indicates they want to be tested or evaluated

Otherwise, respond with "explain_ai" if:
1. The user is asking for explanations or clarifications
2. The user is asking conceptual questions about the subject
3. The user starts a new conversation
4. The user needs help understanding a topic

Return only the agent name: "explain_ai" or "assessment_ai". Do not include any additional text or explanation.`
                }
            ];
            
            // Add chat history
            lastThreeMessages.forEach(msg => {
                intentAnalysisMessages.push({ role: msg.role, content: msg.content });
            });
            
            // Add the current user message
            intentAnalysisMessages.push({ role: "user", content: message });

            // Call OpenAI to get the agent classification - using GPT-3.5 with temperature 0 for consistent outputs
            console.log(`STEP 5: Calling agent classifier`);
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
                console.log(`- RESULT: Selected agent "${classification}" to handle message`);
            } catch (selectorError) {
                console.error("- ERROR in agent selection:", selectorError);
                // Using the default classification set above
                console.log(`- FALLBACK: Using default agent "${classification}"`);
            }

            // Question mode behavior
            let questionPrompt = null;
            
            if (questionModeEnabled && chapter && chapter.questionPrompt && chapter.questionPrompt.length > 0) {
                console.log(`STEP 6: Processing questions (${chapter.questionPrompt.length} available)`);
                console.log(`- Question Mode Diagnostics:`);
                console.log(`- questionModeEnabled: ${questionModeEnabled}`);
                console.log(`- classification: ${classification}`);
                console.log(`- Assessment mode check: ${classification === "assessment_ai"}`);
                
                // Only select a question if classification is assessment_ai
                if (classification === "assessment_ai") {
                    console.log(`- Assessment mode: Selecting question for user ${userId}`);
                    
                    // Create or get current score record for tracking
                    try {
                        currentScore = await Score.findLatestAttempt(userId, chapterId);
                        
                        // If no score record exists, create one
                        if (!currentScore) {
                            console.log(`- No score record found, creating new one for user ${userId}, chapter ${chapterId}`);
                            currentScore = await Score.createAttempt({
                                userId,
                                chapterId,
                                bookId: bookId || chapter.bookId,
                                attemptType: 'first'
                            });
                            console.log(`- Created new score record: ${currentScore._id}`);
                        } else {
                            console.log(`- Found existing score record: ${currentScore._id}`);
                        }
                    } catch (scoreErr) {
                        console.error("- Error creating/retrieving score record:", scoreErr);
                        // Continue without score recording
                        currentScore = null;
                    }
                    
                    // Get the list of questions this user has already answered
                    let userAnsweredQuestions = [];
                    try {
                        const userChat = await Chat.findOne({ userId, chapterId });
                        if (userChat && userChat.metadata && Array.isArray(userChat.metadata.answeredQuestions)) {
                            userAnsweredQuestions = userChat.metadata.answeredQuestions;
                            console.log(`- User has answered ${userAnsweredQuestions.length} questions previously`);
                        }
                    } catch (chatErr) {
                        console.error("Error fetching user chat for question history:", chatErr);
                    }
                    
                    // Find questions the user hasn't answered yet
                    const unansweredQuestions = chapter.questionPrompt.filter(q => !userAnsweredQuestions.includes(q.Q.toString()));
                    console.log(`- Unanswered questions for this user: ${unansweredQuestions.length}`);
                    console.log(`- Total questions: ${chapter.questionPrompt.length}`);
                    
                    if (unansweredQuestions.length > 0) {
                        // Select a random unanswered question
                        const randomIndex = Math.floor(Math.random() * unansweredQuestions.length);
                        questionPrompt = unansweredQuestions[randomIndex];
                        console.log(`- Selected unanswered question #${randomIndex+1}/${unansweredQuestions.length}`);
                        console.log(`- Question ID: Q${questionPrompt.Q}`);
                        console.log(`- Question preview: "${questionPrompt.question ? questionPrompt.question.substring(0, 30) + '...' : 'No question text'}"`);
                        console.log(`- Question marks: ${questionPrompt.question_marks}`);
                    } else {
                        // If all questions answered, cycle through questions again
                        const randomIndex = Math.floor(Math.random() * chapter.questionPrompt.length);
                        questionPrompt = chapter.questionPrompt[randomIndex];
                        console.log(`- All questions answered, selected random question #${randomIndex+1}/${chapter.questionPrompt.length}`);
                        console.log(`- Question ID: Q${questionPrompt.Q}`);
                        console.log(`- Question preview: "${questionPrompt.question ? questionPrompt.question.substring(0, 30) + '...' : 'No question text'}"`);
                        console.log(`- Question marks: ${questionPrompt.question_marks}`);
                        console.log(`- Note: User has already answered all questions`);
                    }
                } else {
                    // For explain_ai, use the first question as reference
                    questionPrompt = chapter.questionPrompt[0];
                    console.log(`- Explanation mode: Using first question as reference`);
                    console.log(`- Question ID: Q${questionPrompt.Q}`);
                    console.log(`- Question preview: "${questionPrompt.question ? questionPrompt.question.substring(0, 30) + '...' : 'No question text'}"`);
                    console.log(`- Question marks: ${questionPrompt.question_marks}`);
                }
            } else {
                console.log(`- Question mode diagnostics:`);
                console.log(`- questionModeEnabled: ${questionModeEnabled}`);
                console.log(`- chapter exists: ${!!chapter}`);
                console.log(`- chapter has questionPrompt: ${!!(chapter && chapter.questionPrompt)}`);
                console.log(`- questionPrompt length: ${chapter && chapter.questionPrompt ? chapter.questionPrompt.length : 0}`);
                console.log(`- No questions available or question mode disabled`);
            }

            // Construct system prompt based on context and classification
            console.log(`STEP 7: Constructing system prompt`);
            let systemPrompt;
            
            if (questionModeEnabled && questionPrompt) {
                // Using the improved question mode prompt template
                const grade = bookGrade || "appropriate grade";
                const subject = bookSubject || "general";
                const totalMarks = questionPrompt.question_marks || 5;
                const question = questionPrompt.question;
                
                // Select prompt based on classification type
                if (classification && classification === "assessment_ai") {
                    console.log(`- Building ASSESSMENT_AI prompt with strict teacher evaluation format`);
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

                    console.log(`- ASSESSMENT_AI prompt built (${systemPrompt.length} chars)`);
                } else {
                    console.log(`- Building EXPLAIN_AI prompt with teacher guidance format`);
                    // Original prompt format for explain_ai and other classifications
                    systemPrompt = `You are a strict yet friendly teacher who helps students by answering their doubts from a specific subject, grade, and chapter.

When the user starts a conversation, greet them warmly and clearly mention the chapter. Then ask if they'd like to begin with a quick knowledge check.

Your primary role is to:

Wait for the user to ask a doubt — do not proactively ask if they have any questions.

Once a doubt is answered, gently redirect the conversation by asking if they'd like to do a quick knowledge check now.

Keep explanations accurate, focused, and suited to the grade level.

Maintain a friendly but structured tone — you're supportive, but expect focus and discipline.

If the user strays off-topic, kindly bring them back to the subject and chapter.

Initial Message Example:
"Hi there! We're Chapter: ${chapterTitle}. Would you like to start with a quick knowledge check?"`;

                    console.log(`- EXPLAIN_AI prompt built (${systemPrompt.length} chars)`);
                }
                
                // Add formatting instructions to whichever prompt was chosen
                console.log(`- Adding formatting instructions`);
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
                console.log(`- Final prompt type: ${promptType}`);
                
                // Store the current question for scoring purposes
                currentQuestion = questionPrompt;
            } else {
                console.log(`- Building default prompt (no questions available)`);
                // Default prompt when no question is available
                const grade = bookGrade || "appropriate grade";
                const subject = bookSubject || "general";
                
                // Use a simplified explain_ai prompt without specific question references
                systemPrompt = `You are a strict yet friendly teacher who helps students by answering their doubts from a specific subject, grade, and chapter.

When the user starts a conversation, greet them warmly and clearly mention the chapter. Then ask if they'd like to begin with a quick knowledge check.

Your primary role is to:

Wait for the user to ask a doubt — do not proactively ask if they have any questions.

Once a doubt is answered, gently redirect the conversation by asking if they'd like to do a quick knowledge check now.

Keep explanations accurate, focused, and suited to the grade level.

Maintain a friendly but structured tone — you're supportive, but expect focus and discipline.

If the user strays off-topic, kindly bring them back to the subject and chapter.

Initial Message Example:
"Hi there! We're Chapter: ${chapterTitle}. Would you like to start with a quick knowledge check?"`;

                // Add formatting instructions
                console.log(`- Adding formatting instructions`);
        systemPrompt += `
        
        IMPORTANT FORMATTING INSTRUCTIONS:
        1. Do NOT use LaTeX formatting for mathematical expressions. Use plain text for all math.
        2. Do NOT use special syntax like \\text, \\frac, or other LaTeX commands.
        3. Do NOT put units in parentheses. Instead of writing (10 m/s), write 10 m/s.
4. Format mathematical operations and expressions simply.
        5. Use standard characters for exponents where possible (e.g., m/s², km², etc.).
        6. Keep all mathematical expressions simple and readable, using plain text formatting only.`;
        
                console.log(`- DEFAULT prompt built (${systemPrompt.length} chars)`);
            }
            
            console.log(`STEP 8: Preparing OpenAI request`);
        if (!Array.isArray(chat.messages)) {
                console.log(`- Messages was not an array, initializing empty array`);
            chat.messages = [];
        }

        // Construct messages for OpenAI
        let messagesForOpenAI = [
            { role: "system", content: systemPrompt },
            ];
            
            // Add previous messages for context if available
            if (previousMessages.length > 0) {
                console.log(`- Adding ${previousMessages.length} previous messages for context`);
                messagesForOpenAI = messagesForOpenAI.concat(previousMessages);
            }

        // Add the new user message
        messagesForOpenAI.push({ role: "user", content: message });
            console.log(`- Final request has ${messagesForOpenAI.length} messages (1 system + ${messagesForOpenAI.length - 2} context + 1 current)`);
        
            console.log(`STEP 9: Sending to OpenAI (DeepSeek API)...`);

        // Add a timeout for the OpenAI request
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('OpenAI request timed out')), 600000); // 10 minutes timeout
        });
        
        // Function to make OpenAI request with retry logic
        const makeOpenAIRequest = async (retryCount = 0, maxRetries = 2) => {
          try {
                console.log(`- Attempt ${retryCount + 1}/${maxRetries + 1} to get response`);
            
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
            
                console.log(`- Retry ${retryCount + 1}/${maxRetries} due to error: ${error.message}`);
            
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
                console.log(`ERROR: Invalid response from OpenAI`);
            throw new Error("Invalid response from OpenAI");
        }

            console.log(`STEP 10: Processing AI response`);
        const botMessage = response.choices[0].message.content;
            console.log(`- ${classification} agent generated response (${botMessage.length} chars)`);
            console.log(`- Response preview: "${botMessage.substring(0, 50)}..."`);

        // Add messages and save...
            console.log(`STEP 11: Saving chat`);
        chat.messages.push({ role: "user", content: message });
        chat.messages.push({ role: "assistant", content: botMessage });
        
            console.log(`- Saving chat with ${chat.messages.length} messages`);
        await chat.save();
            console.log(`- Chat saved successfully`);

            // If this was a question being answered and question mode is enabled, mark it as answered
            if (questionModeEnabled && currentQuestion && classification === "assessment_ai") {
                console.log(`STEP 12: Updating question status (assessment_ai mode)`);
                console.log(`- Question Update Diagnostics:`);
                console.log(`- questionModeEnabled: ${questionModeEnabled}`);
                console.log(`- currentQuestion exists: ${!!currentQuestion}`);
                console.log(`- classification is assessment_ai: ${classification === "assessment_ai"}`);
                if (currentQuestion) {
                    console.log(`- Current question Q: ${currentQuestion.Q}`);
                    console.log(`- Current question marks: ${currentQuestion.question_marks}`);
                }
                
                try {
                    if (chapter && chapter.questionPrompt) {
                        // Find the question and mark it as answered
                        const questionIndex = chapter.questionPrompt.findIndex(q => q.Q === currentQuestion.Q);
                        console.log(`- Question index in array: ${questionIndex}`);
                        if (questionIndex !== -1) {
                            console.log(`- Found question at index ${questionIndex}`);
                            // Extract marks awarded from AI response
                            let marksAwarded = 0;
                            const maxMarks = currentQuestion.question_marks || 1;
                            
                            // Look for Score: pattern in the response
                            const marksMatch = botMessage.match(/Score:\s*(\d+)\/(\d+)/i);
                            if (marksMatch && marksMatch.length >= 3) {
                                marksAwarded = parseInt(marksMatch[1], 10);
                                console.log(`- AI awarded ${marksAwarded} out of ${maxMarks} marks (explicitly)`);
                            } else {
                                // If no Score pattern found, default to 0 marks
                                marksAwarded = 0;
                                console.log(`- No score pattern found, defaulting to ${marksAwarded} marks`);
                            }
                            
                            // Mark question as answered for this specific user
                            await markQuestionAsAnswered(userId, chapterId, currentQuestion.Q.toString(), marksAwarded, maxMarks);
                            console.log(`- Marked question #${currentQuestion.Q} as answered by user ${userId} with ${marksAwarded} marks`);
                            
                            // Update score record if we have one
                            if (currentScore) {
                                try {
                                    await Score.updateQuestionScore(currentScore._id, currentQuestion.Q, marksAwarded);
                                    console.log(`- Updated score record with ${marksAwarded} marks`);
                                } catch (scoreErr) {
                                    console.error("- Error updating score:", scoreErr);
                                }
                            }
                        } else {
                            console.log(`- Question not found in chapter`);
                        }
                    }
                } catch (err) {
                    console.error("- Error updating question status:", err);
                    // Continue without failing the request
                }
            } else {
                console.log(`- Question update skipped - diagnostics:`);
                console.log(`- questionModeEnabled: ${questionModeEnabled}`);
                console.log(`- currentQuestion exists: ${!!currentQuestion}`);
                console.log(`- classification is assessment_ai: ${classification === "assessment_ai"}`);
                console.log(`- Skipping question update (not assessment_ai or no question available)`);
            }

            console.log(`STEP 13: Sending response to user`);
            console.log(`=== END REQUEST (Success) ===\n`);
            // Send the response to the user
            res.json({ 
                response: botMessage
            });
            
        } catch (chapterError) {
            console.error(`ERROR: Processing chapter failed:`, chapterError);
            console.log(`=== END REQUEST (Chapter Error) ===\n`);
            res.status(500).json({ error: "Error processing chapter", message: chapterError.message });
        }

    } catch (error) {
        console.error(`ERROR: General API error:`, error);
        console.log(`=== END REQUEST (General Error) ===\n`);
        
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

// Reset questions for a specific user and chapter
router.post("/reset-questions/:chapterId", authenticateUser, async (req, res) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user.userId;
        
        console.log(`Resetting questions for userId: ${userId}, chapterId: ${chapterId}`);
        
        // Find the chapter to ensure it exists and has questions
        const chapter = await Chapter.findById(chapterId);
        
        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }
        
        if (!chapter.questionPrompt || chapter.questionPrompt.length === 0) {
            return res.status(404).json({ error: "Chapter has no questions to reset" });
        }
        
        // Find and delete the user's chat for this chapter to reset progress
        await Chat.findOneAndDelete({ userId, chapterId });
        console.log(`- Deleted existing chat history for user ${userId} in chapter ${chapterId}`);
        
        // Create a new empty chat for this user/chapter
        const newChat = new Chat({
            userId,
            chapterId,
            messages: [],
            metadata: {
                answeredQuestions: [],
                totalMarks: 0,
                earnedMarks: 0
            }
        });
        
        await newChat.save();
        console.log(`- Created new chat with reset question progress`);
        
        res.json({
            success: true,
            message: "Question progress has been reset for this chapter",
            totalQuestions: chapter.questionPrompt.length
        });
        
    } catch (error) {
        console.error("Error resetting questions:", error);
        res.status(500).json({ error: "Failed to reset questions" });
    }
});

// Store answered question in the chat document
// Add this function to track which questions a user has answered
async function markQuestionAsAnswered(userId, chapterId, questionId, marksAwarded, maxMarks) {
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
            
            console.log(`- Added question ${questionId} to answered questions list for user ${userId}`);
            console.log(`- Updated marks: ${chat.metadata.earnedMarks}/${chat.metadata.totalMarks}`);
        }
        
        await chat.save();
        return chat;
    } catch (error) {
        console.error("Error marking question as answered:", error);
        return null;
    }
}

// Check if a question has been answered by this user
async function hasUserAnsweredQuestion(userId, chapterId, questionId) {
    try {
        const chat = await Chat.findOne({ userId, chapterId });
        
        if (!chat || !chat.metadata || !Array.isArray(chat.metadata.answeredQuestions)) {
            return false;
        }
        
        return chat.metadata.answeredQuestions.includes(questionId);
    } catch (error) {
        console.error("Error checking if question was answered:", error);
        return false;
    }
}

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
