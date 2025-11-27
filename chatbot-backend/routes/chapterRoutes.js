// Updated chapterRoutes.js - May 2025
/*
WORKFLOW FOR SAVING CHAPTERS WITH VECTOR STORE ID:

1. Process text and create vector store:
   POST /api/chapters/process-text-batch
   Body: { rawText: "...", subject: "...", chapterTitle: "..." }
   Response: { success: true, vectorStoreId: "vs_abc123...", ... }

2. Save the vectorStoreId from step 1 response in a variable

3. Create chapter with the vectorStoreId:
   Option A - Use dedicated endpoint:
   POST /api/chapters/create-from-processed-text
   Body: { 
     bookId: "book123", 
     title: "Chapter Title", 
     rawText: "...", 
     vectorStoreId: "vs_abc123...", 
     questionArray: [...] 
   }
   
   Option B - Use regular chapter creation:
   POST /api/chapters/
   Body: { 
     bookId: "book123", 
     title: "Chapter Title", 
     prompt: "...", 
     vectorStoreId: "vs_abc123..." 
   }

The vectorStoreId will be saved to the chapter's vectorStoreId field in MongoDB.
*/
const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const ChatAsk = require("../models/ChatAsk");
const Chapter = require("../models/Chapter");
const OpenAI = require("openai");
const jwt = require("jsonwebtoken"); // Make sure to import jwt
const authenticateUser = require("../middleware/authMiddleware");
const authenticateAdmin = require("../middleware/adminAuthMiddleware");
const Book = require("../models/Book");
const Prompt = require("../models/Prompt");
const fs = require('fs');
const path = require('path');


// Don't import node-fetch - let OpenAI SDK use native fetch or handle it internally

// Initialize OpenAI client with fetch polyfill
let openai;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY
        // Let OpenAI SDK handle fetch internally
    });
    ////console.log("OpenAI client initialized successfully in chapterRoutes.js");
} else {
        //console.warn("OPENAI_API_KEY not found in environment variables. OpenAI features in chapterRoutes will be disabled.");
        // Create a mock OpenAI client to prevent errors
        openai = {
            chat: {
                completions: {
                    create: async () => ({ 
                        choices: [{ message: { content: "OpenAI API is not available. Please configure your API key." } }] 
                    })
                }
            },
            embeddings: {
                create: async () => ({ data: [{ embedding: Array(1536).fill(0) }] })
            }
        };
    }
} catch (error) {
    //console.error("Error initializing OpenAI client in chapterRoutes:", error);
    // Create a mock OpenAI client to prevent errors
    openai = {
        chat: {
            completions: {
                create: async () => ({ 
                    choices: [{ message: { content: "OpenAI API is not available. Please configure your API key." } }] 
                })
            }
        },
        embeddings: {
            create: async () => ({ data: [{ embedding: Array(1536).fill(0) }] })
        }
    };
}

// In routes/chapters.js
router.post("/", authenticateAdmin, async (req, res) => {
    try {
      const { bookId, title, prompt, vectorStoreId } = req.body;
      
      //console.log(`Creating new chapter: ${title}`);
      //console.log(`DEBUG: Full request body:`, JSON.stringify(req.body, null, 2));
      //console.log(`DEBUG: vectorStoreId from body: "${vectorStoreId}"`);
      console.log(`DEBUG: vectorStoreId type1: ${typeof vectorStoreId}`);
      
      const chapterData = { bookId, title, prompt };
      
      // If vectorStoreId is provided, use it instead of creating a new one
      if (vectorStoreId && vectorStoreId.trim() !== '') {
        chapterData.vectorStoreId = vectorStoreId.trim();
        //console.log(`Added vectorStoreId to chapter data: ${chapterData.vectorStoreId}`);
      } else {
        //console.log(`No vectorStoreId provided or empty`);
      }
      
      const newChapter = new Chapter(chapterData);
      const savedChapter = await newChapter.save();
      
      //console.log(`Successfully created chapter: ${savedChapter.chapterId}`);
      //console.log(`Final chapter vectorStoreId: ${savedChapter.vectorStoreId}`);
      
      res.status(201).json(savedChapter);
    } catch (error) {
      //console.error("Error adding chapter:", error);
      res.status(500).json({ error: "Failed to add chapter" });
    }
  });

// Update chapter with questions and optional vectorStoreId
router.put("/:chapterId", authenticateAdmin, async (req, res) => {
    try {
      const { chapterId } = req.params;
      const { title, prompt, questionPrompt, vectorStoreId } = req.body;
      
      const chapter = await Chapter.findById(chapterId);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      
      // Update fields if provided
      if (title) chapter.title = title;
      if (prompt) chapter.prompt = prompt;
      if (questionPrompt) chapter.questionPrompt = questionPrompt;
      
      // If vectorStoreId is provided, use it instead of creating a new one
      if (vectorStoreId && !chapter.vectorStoreId) {
        chapter.vectorStoreId = vectorStoreId;
        //console.log(`Using existing vector store ID for chapter ${chapterId}: ${vectorStoreId}`);
      }
      
      const savedChapter = await chapter.save();
      res.json(savedChapter);
    } catch (error) {
      //console.error("Error updating chapter:", error);
      res.status(500).json({ error: "Failed to update chapter" });
    }
  });

// Create chapter from processed text with vector store
router.post("/create-from-processed-text", authenticateAdmin, async (req, res) => {
    try {
      const { bookId, title, rawText, vectorStoreId, questionArray } = req.body;
      
      if (!bookId || !title || !rawText) {
        return res.status(400).json({ 
          error: "Missing required fields", 
          required: ["bookId", "title", "rawText"] 
        });
      }
      
      //console.log(`Creating chapter from processed text: ${title}`);
      //console.log(`DEBUG: Full request body:`, JSON.stringify(req.body, null, 2));
      //console.log(`DEBUG: vectorStoreId from body: "${vectorStoreId}"`);
      console.log(`DEBUG: vectorStoreId type2: ${typeof vectorStoreId}`);
      //console.log(`Has questions: ${questionArray ? questionArray.length : 0}`);
      
      // Ensure vectorStoreId is properly handled
      if (!vectorStoreId) {
        //console.warn('No vectorStoreId provided - chapter will be created without vector store');
      } else {
        //console.log(`Using vector store ID: ${vectorStoreId}`);
      }
      
      // Create chapter data object
      const chapterData = {
        bookId,
        title,
        prompt: rawText, // Store original raw text as prompt
        questionPrompt: questionArray || []
      };
      
      // Only add vectorStoreId if it's provided and not null/empty
      if (vectorStoreId && vectorStoreId.trim() !== '') {
        chapterData.vectorStoreId = vectorStoreId.trim();
        //console.log(`Added vectorStoreId to chapter data: ${chapterData.vectorStoreId}`);
      }
      
      // Create and save the chapter
      const newChapter = new Chapter(chapterData);
      const savedChapter = await newChapter.save();
      
      //console.log(`Successfully created chapter: ${savedChapter.chapterId}`);
      //console.log(`Chapter vectorStoreId: ${savedChapter.vectorStoreId}`);
      
      res.status(201).json({
        success: true,
        chapter: savedChapter,
        message: `Chapter "${title}" created successfully with vector store`
      });
      
    } catch (error) {
      //console.error("Error creating chapter from processed text:", error);
      res.status(500).json({ 
        error: "Failed to create chapter from processed text",
        details: error.message 
      });
    }
  });

// Send Message & Get AI Response
router.post("/send", async (req, res) => {
    try {
        const { userId, message, chapterId } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ error: "User ID and message are required" });
        }

        // Handle both general chats and chapter-specific chats
        let chat;
        let systemPrompt = "You are a helpful AI assistant that discusses books and literature.";
        
        if (chapterId) {
            // Chapter-specific chat
            chat = await Chat.findOne({ userId, chapterId });
            
            // Fetch chapter details
            try {
                const chapter = await Chapter.findById(chapterId);
                if (chapter && chapter.prompt) {
                    systemPrompt = chapter.prompt;
                }
            } catch (err) {
                //console.error("Error fetching chapter:", err);
                // Continue with default prompt if chapter fetch fails
            }
            
            if (!chat) {
                chat = new Chat({ userId, chapterId, messages: [] });
            }
        } else {
            // General chat (no chapter context)
            chat = await Chat.findOne({ userId, chapterId: null });
            
            if (!chat) {
                chat = new Chat({ userId, chapterId: null, messages: [] });
            }
        }

        if (!Array.isArray(chat.messages)) {
            chat.messages = [];
        }

        // Construct messages for OpenAI
        let messagesForOpenAI = [
            { role: "system", content: systemPrompt },
            ...chat.messages.slice(-10) // Last 10 messages for context
        ];

        // Add the new user message
        messagesForOpenAI.push({ role: "user", content: message });

        //console.log("Sending to OpenAI:", messagesForOpenAI);

        // Get AI response
        const response = await openai.chat.completions.create({
            model: "gpt-4.1",
            temperature: 0.0,
            messages: messagesForOpenAI,
        });

        if (!response || !response.choices || response.choices.length === 0) {
            throw new Error("Invalid response from OpenAI");
        }

        const botMessage = response.choices[0].message.content;

        // Save both user and assistant messages
        chat.messages.push({ role: "user", content: message });
        chat.messages.push({ role: "assistant", content: botMessage });

        await chat.save();

        res.json({ response: botMessage });

    } catch (error) {
        //console.error("Error in chatbot API:", error);
        res.status(500).json({ message: "Error getting response from OpenAI", error: error.message });
    }
});

// Chat Ask - Answer user questions from a chapter using its vector store ID
router.post("/chat_ask", async (req, res) => {
    try {
        const { userId, message, chapterId } = req.body;

        if (!userId || !message || !chapterId) {
            return res.status(400).json({ error: "User ID, message, and chapter ID are required" });
        }

        // Find the chapter and populate the book to get grade and subject
        const chapter = await Chapter.findById(chapterId).populate('bookId');
        if (!chapter) {
            return res.status(404).json({ error: "Chapter not found" });
        }

        if (!chapter.vectorStoreId) {
            return res.status(400).json({ 
                error: "Chapter does not have a vector store. Please ensure the chapter has been processed with a vector store ID." 
            });
        }

        // Find or create chat ask conversation
        let chatAsk = await ChatAsk.findOne({ userId, chapterId });
        
        if (!chatAsk) {
            chatAsk = new ChatAsk({ 
                userId, 
                chapterId, 
                messages: [],
                metadata: {
                    totalQuestions: 0,
                    lastActive: new Date()
                }
            });
        }

        if (!Array.isArray(chatAsk.messages)) {
            chatAsk.messages = [];
        }

        // Prepare context from chapter and book
        const context = {
            chapterTitle: chapter.title,
            grade: chapter.bookId?.grade || "general",
            subject: chapter.bookId?.subject || "the subject"
        };

        // Search vector store for answer - pass context as 4th parameter
        const searchResult = await searchVectorStoreForAnswer(
            chapter.vectorStoreId, 
            message, 
            {}, // options (empty object for default)
            context // context as 4th parameter
        );
        
        // Extract answer from search result (no need to parse JSON array for chat)
        let answerText = searchResult.answer;

        // Save both user and assistant messages
        chatAsk.messages.push({ 
            role: "user", 
            content: message,
            timestamp: new Date()
        });
        chatAsk.messages.push({ 
            role: "assistant", 
            content: answerText,
            timestamp: new Date()
        });

        // Update metadata
        chatAsk.metadata.totalQuestions = chatAsk.messages.filter(m => m.role === "user").length;
        chatAsk.metadata.lastActive = new Date();

        await chatAsk.save();

        res.json({ 
            response: answerText,
            sources: searchResult.sources || [],
            totalResults: searchResult.totalResults || 0
        });

    } catch (error) {
        //console.error("Error in chat_ask API:", error);
        res.status(500).json({ 
            message: "Error getting response from vector store", 
            error: error.message 
        });
    }
});

// Fetch General Chat History for Logged-in User
router.get("/history/:userId", async (req, res) => {
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
        //console.error("Error fetching chat history:", error);
        res.status(500).json({ error: "Failed to fetch chat history" });
    }
});

// Fetch Chapter-specific Chat History - FIXED VERSION
router.get("/chapter-history/:chapterId", async (req, res) => {
    try {
        const { chapterId } = req.params;
        
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: "Authorization token required" });
        }
        
        const token = authHeader.split(' ')[1];
        
        // Extract userId from token - IMPORTANT: Use the correct JWT_SECRET
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.userId || decoded.id || decoded._id;
        } catch (err) {
            //console.error("Error decoding token:", err);
            return res.status(401).json({ error: "Invalid token" });
        }
        
        //console.log(`Looking for chat with userId: ${userId}, chapterId: ${chapterId}`);
        
        const chat = await Chat.findOne({ userId, chapterId });
        
        if (!chat || !Array.isArray(chat.messages)) {
            //console.log("No chat found or messages is not an array");
            return res.json([]);
        }
        
        //console.log(`Found chat with ${chat.messages.length} messages`);
        res.json(chat.messages);
        
    } catch (error) {
        //console.error("Error fetching chapter chat history:", error);
        res.status(500).json({ error: "Failed to fetch chapter chat history" });
  }
});

// Fetch Chat Ask History for a specific chapter
router.get("/chat_ask-history/:chapterId", async (req, res) => {
    try {
        const { chapterId } = req.params;
        
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: "Authorization token required" });
        }
        
        const token = authHeader.split(' ')[1];
        
        // Extract userId from token
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.userId || decoded.id || decoded._id;
        } catch (err) {
            //console.error("Error decoding token:", err);
            return res.status(401).json({ error: "Invalid token" });
        }
        
        //console.log(`Looking for chat_ask with userId: ${userId}, chapterId: ${chapterId}`);
        
        const chatAsk = await ChatAsk.findOne({ userId, chapterId });
        
        if (!chatAsk || !Array.isArray(chatAsk.messages)) {
            //console.log("No chat_ask found or messages is not an array");
            return res.json([]);
        }
        
        //console.log(`Found chat_ask with ${chatAsk.messages.length} messages`);
        res.json(chatAsk.messages);
        
    } catch (error) {
        //console.error("Error fetching chat_ask history:", error);
        res.status(500).json({ error: "Failed to fetch chat_ask history" });
    }
});

// Process raw text through OpenAI with text splitting (batched processing)
router.post("/process-text-batch", authenticateAdmin, async (req, res) => {
  return await processBatchText(req, res);
});

// Example: How to store vectorStoreId and use it
// 1. Call processBatchText and store the vectorStoreId
// const response = await processBatchText(req, res);
// const storedVectorStoreId = response.vectorStoreId; // Store this!
//
// 2. Use the stored vectorStoreId when creating chapter
// const chapterData = {
//   bookId: "your_book_id",
//   title: "Chapter Title", 
//   prompt: rawText,
//   vectorStoreId: storedVectorStoreId // Use the stored ID here
// };

// Shared batch text processing function/****************** */
async function processBatchText(req, res) {
  try {
    const { rawText, subject, chapterTitle } = req.body;

    if (!rawText) {
      return res.status(400).json({ error: "Raw text is required" });
    }
    
    // Log processing attempt
    //console.log(`Processing text with batching. Text length: ${rawText.length} characters`);
    //console.log(`Subject: ${subject || 'Not provided'}, Chapter: ${chapterTitle || 'Not provided'}`);
    
    // Split text into smaller parts (min 20 parts with min 1000 words each) at sentence boundaries
    let vectorBase;
    try {
      //console.log('Creating vector store for raw text...');
      vectorBase = await saveTextToVectorStore(rawText);
      //console.log('Vector store creation completed');
    } catch (vectorError) {
      //console.error('Error creating vector store:', vectorError);
      return res.status(500).json({ 
        error: "Failed to create vector store for text", 
        message: vectorError.message 
      });
    }
    
    // Debug logging for vectorBase
    //console.log(`DEBUG: vectorBase after saveTextToVectorStore:`);
    //console.log(`DEBUG: vectorBase type: ${typeof vectorBase}`);
    //console.log(`DEBUG: vectorBase value: ${JSON.stringify(vectorBase)}`);
    //console.log(`DEBUG: vectorBase.vectorStoreId type: ${typeof vectorBase?.vectorStoreId}`);
    //console.log(`DEBUG: vectorBase.vectorStoreId value: ${vectorBase?.vectorStoreId}`);
    
    const textParts = splitTextIntoSentenceParts(rawText, 20);
    //console.log(`Split text into ${textParts.length} parts`);
    
    // Check if vector base was created successfully
    if (!vectorBase || !vectorBase.success || !vectorBase.vectorStoreId) {
      //console.error("Failed to create vector store for text processing");
      //console.error("vectorBase:", JSON.stringify(vectorBase, null, 2));
      return res.status(500).json({ 
        error: "Failed to create vector store for text", 
        message: vectorBase?.error || "Unknown error"
      });
    }
    
    //console.log(`Successfully created vector store with ID: ${vectorBase.vectorStoreId}`);
    //console.log(`DEBUG: vectorBase.vectorStoreId type: ${typeof vectorBase.vectorStoreId}`);
    //console.log(`DEBUG: vectorBase.vectorStoreId value: "${vectorBase.vectorStoreId}"`);
    
    
    // Fetch the system prompt from the database
    let systemPrompt;
    try {
      const promptDoc = await Prompt.findOne({ prompt_type: "batchProcessing", isActive: true });
      if (promptDoc) {
        systemPrompt = promptDoc.prompt;
        //console.log("Successfully loaded Batch Processing prompt from database");
        
        // Replace variables in the prompt if subject and chapter are provided
        if (subject) {
          systemPrompt = systemPrompt.replace(/<Subject>/g, subject);
        }
        
        if (chapterTitle) {
          systemPrompt = systemPrompt.replace(/<Chapter>/g, chapterTitle);
        }
        
        //console.log("Replaced variables in prompt template");
      } else {
        // Fallback to default prompt
        systemPrompt = "";
        //console.warn("Warning: Batch Processing system prompt not found in database, using default");
      }
    } catch (error) {
      //console.error("Error fetching Batch Processing system prompt:", error);
      // Fallback to default prompt
      systemPrompt = "";
    }

    // Process each part with OpenAI and collect responses
    const collatedResponses = {};
    
    for (let i = 0; i < textParts.length; i++) {
      try {
        //console.log(`Processing part ${i+1}/${textParts.length}`);
        
        // Memory monitoring every 10 parts
        if (i % 10 === 0 && global.gc) {
          global.gc();
          const memUsage = process.memoryUsage();
          //console.log(`Memory usage: RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB, Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB, Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        }
        
        // Construct messages for OpenAI
        const messagesForOpenAI = [
          { role: "system", content: systemPrompt },
          { role: "user", content: textParts[i] }
        ];

        // Add a timeout for the OpenAI request
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('OpenAI request timed out')), 1800000); // 30 minutes timeout
        });
        
        // Function to make OpenAI request with retry logic
        const makeOpenAIRequest = async (retryCount = 0, maxRetries = 2) => {
          try {
            //console.log(`OpenAI request for part ${i+1} attempt ${retryCount + 1}/${maxRetries + 1}`);
            
            // Send request to OpenAI
            const response = await openai.chat.completions.create({
              model: "gpt-4.1",
              temperature: 0,
              messages: messagesForOpenAI,
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
            
            //console.log(`Retry ${retryCount + 1}/${maxRetries} due to error: ${error.message}`);
            
            // Wait before retrying (exponential backoff: 2s, 4s)
            await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retryCount)));
            
            // Try again with incremented retry count
            return makeOpenAIRequest(retryCount + 1, maxRetries);
          }
        };
        
        // Race the promises with retry logic
        const openAIPromise = makeOpenAIRequest();
        const response = await Promise.race([openAIPromise, timeoutPromise]);

        if (!response || !response.choices || response.choices.length === 0) {
          //console.error(`Invalid or empty response from OpenAI for part ${i+1}`);
          collatedResponses[`part_${i+1}`] = "Error processing this section";
        } else {
          const processedText = response.choices[0].message.content;
          //console.log(`Part ${i+1} processed successfully. Result length: ${processedText.length}`);
          collatedResponses[`part_${i+1}`] = processedText;
        }
      } catch (error) {
        //console.error(`Error processing part ${i+1}:`, error);
        collatedResponses[`part_${i+1}`] = "Error processing this section";
      }
    }
    
    // Save the combined responses as a system prompt
    try {
      // Combine all responses
      const combinedPrompt = Object.values(collatedResponses).join("\n\n");
      //console.log(`Combined all responses into text of length: ${combinedPrompt.length}`);
      
      // Check if the combined text appears to contain JSON formatted questions
      const hasQField = combinedPrompt.includes('"Q":');
      const hasQuestionField = combinedPrompt.includes('"question":');
      //console.log(`Text contains Q field: ${hasQField}, question field: ${hasQuestionField}`);
      
      if (hasQuestionField) {
        try {
          //console.log("Detected question format in the batch output - attempting to structure as question array");
          
          // Extract JSON objects with question field (modified regex to not require Q field)
          const questionJsonObjects = combinedPrompt.match(/\{[\s\S]*?"question"[\s\S]*?\}/g);
          //console.log(`Regex match result: ${questionJsonObjects ? `Found ${questionJsonObjects.length} matches` : 'No matches found'}`);
          
          if (questionJsonObjects && questionJsonObjects.length > 0) {
            //console.log(`Found ${questionJsonObjects.length} potential question objects in the text`);
            
            // Log a sample of the first match for debugging
            if (questionJsonObjects.length > 0) {
              //console.log(`Sample first match: ${questionJsonObjects[0].substring(0, 200)}...`);
              
              try {
                const sampleParsed = JSON.parse(questionJsonObjects[0]);
                //console.log(`Sample parsed successfully: subtopic=${sampleParsed.subtopic}, question=${sampleParsed.question?.substring(0, 50)}..., question type=${sampleParsed["question type"] || sampleParsed.question_type || "N/A"}`);
              } catch (parseError) {
                //console.error(`Could not parse sample match as JSON: ${parseError.message}`);
                //console.log(`Raw sample found with regex - first few characters: ${questionJsonObjects[0].substring(0, 100)}...`);
              }
            }
            
            // Parse each JSON object
            const structuredQuestions = [];
            let successCount = 0;
            let errorCount = 0;
            let pendingValidations = 0;
            
            // Function to handle response once all questions are processed
            function finishProcessing() {
              if (successCount + errorCount === questionJsonObjects.length && pendingValidations === 0) {
                if (structuredQuestions.length > 0) {
                  //console.log(`Successfully structured ${successCount} questions with ${errorCount} errors`);
                  
                  // If we have successfully parsed questions, return them as a proper array
                  //console.log(`DEBUG: Returning response with vectorStoreId: ${vectorBase.vectorStoreId}`);
                  return res.json({ 
                    success: true, 
                    message: `Text processed and structured into ${structuredQuestions.length} questions`,
                    combinedPrompt: JSON.stringify(structuredQuestions),
                    isQuestionFormat: true,
                    questionArray: structuredQuestions,
                    totalQuestions: structuredQuestions.length,
                    vectorStoreId: vectorBase.vectorStoreId || null, // Include the vector store ID for reuse
                    rawText: rawText, // Include original raw text
                    nextSteps: "To create a chapter with this processed data, send a POST request to /api/chapters/create-from-processed-text with bookId, title, rawText, vectorStoreId, and questionArray."
                  });
                } else {
                  // If no questions were kept after validation, return standard format
                  return res.json({ 
                    success: true, 
                    message: "Text processed successfully but no valid questions found",
                    combinedPrompt: combinedPrompt,
                    processedText: combinedPrompt, // Include for backward compatibility
                    vectorStoreId: vectorBase.vectorStoreId, // Include the vector store ID for reuse
                    rawText: rawText // Include original raw text
                  });
                }
              }
            }
            
            // Process each question json object
            questionJsonObjects.forEach((jsonStr, index) => {
              try {
                // Clean up the JSON string - ensure it's properly formatted
                const cleanedJson = jsonStr.trim().replace(/,\s*$/, '');
                const questionObj = JSON.parse(cleanedJson);
                
                // Check if the question has the required field
                if (questionObj.question) {
                  // Extract question number if present in the question text
                  let questionNumber = index + 1; // Default to index+1
                  const numberMatch = questionObj.question.match(/^\s*(?:Choose|Select|Answer)?\s*(?:the\s+(?:correct\s+)?option\s+to\s+fill\s+in\s+the\s+blanks\.\s*)?(\d+)[\.:\)\s]/i);
                  
                  if (numberMatch && numberMatch[1]) {
                    questionNumber = parseInt(numberMatch[1], 10);
                    //console.log(`Extracted question number ${questionNumber} from question text`);
                  }
                  
                  // Add Q field if missing
                  if (!questionObj.Q) {
                    questionObj.Q = questionNumber;
                    //console.log(`Added Q field with value ${questionNumber} to question at index ${index}`);
                  }
                  
                  // Normalize question type field
                  if (questionObj["question type"] && !questionObj.question_type) {
                    questionObj.question_type = questionObj["question type"];
                    //console.log(`Normalized "question type" to question_type: ${questionObj.question_type}`);
                  }
                  
                  // Track this validation
                  pendingValidations++;
                  
                  // Run the validation asynchronously
                  (async () => {
                    try {
                      // Add delay between vector store requests to avoid rate limiting
                      const requestDelay = Math.random() * 1000 + 500; // Random delay between 500-1500ms
                      await new Promise(resolve => setTimeout(resolve, requestDelay));
                      
                      // Check if the question should be kept
                      const validationResult = await validateQuestionWithOpenAI(questionObj.question);
                      //console.log(`Question validation result: ${validationResult}`);
                      
                      // Process the question to get answer, difficulty, and marks
                      //console.log(`Getting analysis for question: "${questionObj.question.substring(0, 50)}..."`);
                      
                      let questionAnalysis;
                      try {
//                         const question_one = questionObj.question;
//                         const final_question = `You are an assistant that receives a user's question and returns an array with exactly three elements in this order:

// A tentative answer to the question (as a string).

// The difficulty level of the question, strictly one of: "Easy", "Medium", or "Hard".

// Marks assigned to the question (as an integer between 1 to 5), based on your judgment of the question's depth, complexity, and required effort—not by fixed rules.

// Return the result strictly in this array format in answer found in knowledge base else return "No Answer" :

// ["Tentative answer", "Difficulty", Marks]

// below is the question:

// question:
// ${question_one}

// Do not include any explanation, commentary, or formatting outside the array.`
                        
                        // Add additional delay before vector store search
                        const searchDelay = Math.random() * 2000 + 1000; // Random delay between 1-3 seconds
                        await new Promise(resolve => setTimeout(resolve, searchDelay));
                        
                        // Debug logging
                        //console.log(`DEBUG: vectorBase type: ${typeof vectorBase}`);
                        //console.log(`DEBUG: vectorBase value: ${JSON.stringify(vectorBase)}`);
                        //console.log(`DEBUG: vectorBase.vectorStoreId: ${vectorBase.vectorStoreId}`);
                        
                        // Ensure we have a valid string ID
                        let vectorStoreId = vectorBase.vectorStoreId;
                        if (typeof vectorStoreId !== 'string') {
                          //console.error(`ERROR: vectorStoreId is not a string. Type: ${typeof vectorStoreId}, Value: ${JSON.stringify(vectorStoreId)}`);
                          //console.error(`Full vectorBase object: ${JSON.stringify(vectorBase)}`);
                          throw new Error(`Invalid vectorStoreId type: expected string, got ${typeof vectorStoreId}`);
                        }
                        
                        const response = await searchVectorStoreForAnswer(vectorStoreId, questionObj.question, { chapterTitle: chapterTitle, subject: subject, grade: "general" });
                        // const response = await answerQuestion(questionObj.question, embeddings);
                        //console.log(`Raw answer response: ${response.answer}`);
                        
                        // Handle different response formats
                        let answerText = response.answer;
                        
                        // Check if it's already in the expected format
                        if (answerText.startsWith('[') && answerText.endsWith(']')) {
                          try {
                            questionAnalysis = JSON.parse(answerText);
                            //console.log(`Successfully parsed questionAnalysis with ${questionAnalysis.length} questions`);
                          } catch (parseError) {
                            //console.error(`Error parsing JSON response: ${parseError.message}`);
                            // Create fallback response
                            questionAnalysis = ["Unable to parse answer", "Medium", 1];
                          }
                        } else {
                          // Handle plain text responses or error messages
                          //console.log(`Received non-JSON response, creating structured format`);
                          
                          // Extract meaningful information from plain text
                          if (answerText.toLowerCase().includes('no') && answerText.toLowerCase().includes('information')) {
                            questionAnalysis = ["No Answer", "Medium", 1];
                          } else if (answerText.toLowerCase().includes('error')) {
                            questionAnalysis = ["Unable to determine", "Medium", 1];
                          } else {
                            // Try to use the text as answer
                            let cleanAnswer = answerText.replace(/[^\w\s\.\,\!\?]/g, '').substring(0, 100);
                            questionAnalysis = [cleanAnswer || "No Answer", "Medium", 1];
                          }
                        }
                      } catch (analysisError) {
                        //console.error(`Error getting question analysis: ${analysisError.message}`);
                        questionAnalysis = ["Error analyzing question", "Medium", 1];
                      }
                      
                      //console.log(`Final questionAnalysis: [${questionAnalysis.map(item => typeof item === 'string' ? item.substring(0, 30) + '...' : typeof item).join(', ')}]`);
                      
                      if (validationResult === "keep") {
                        // Add default values for missing fields
                        //console.log(`Adding question to structuredQuestions array`);
                        structuredQuestions.push({
                          Q: questionObj.Q,
                          question: questionObj.question,
                          subtopic: questionObj.subtopic || "General",
                          question_type: questionObj.question_type || "multiple choice",
                          tentativeAnswer: questionObj.question_type === "short answer" || questionObj.question_type === "descriptive" ? questionAnalysis[0] : "Not Required",
                          difficultyLevel: questionAnalysis[1],
                          question_marks: questionAnalysis[2] || 1
                        });
                        successCount++;
                      } else {
                        //console.log(`Skipping question at index ${index} based on validation`);
                        errorCount++;
                      }
                    } catch (error) {
                      //console.error(`Error in question processing at index ${index}:`, error);
                      
                      // Default to keeping the question if validation fails
                      //console.log(`Using fallback values for question at index ${index}`);
                      
                      // Create safe questionAnalysis with defaults if it's not defined
                      const safeQuestionAnalysis = Array.isArray(questionAnalysis) ? questionAnalysis : ["No answer available", "Medium", 1];
                      
                      structuredQuestions.push({
                        Q: questionObj.Q,
                        question: questionObj.question,
                        subtopic: questionObj.subtopic || "General",
                        question_type: questionObj.question_type || "multiple choice",
                        tentativeAnswer: questionObj.question_type === "short answer" || questionObj.question_type === "descriptive" ? questionAnalysis[0] : "Not Required",
                        difficultyLevel: safeQuestionAnalysis[1] || "Medium",
                        question_marks: safeQuestionAnalysis[2] || 1
                      });
                      successCount++;
                    } finally {
                      // Mark this validation as complete
                      pendingValidations--;
                      //console.log(`Validation complete. Remaining validations: ${pendingValidations}`);
                      // Check if all processing is complete and send response if needed
                      finishProcessing();
                    }
                  })();
                } else {
                  //console.log(`Question object at index ${index} is missing required fields`);
                  errorCount++;
                  
                  // No validation to do, check if all processing is done
                  finishProcessing();
                }
              } catch (parseError) {
                //console.error(`Error parsing question JSON at index ${index}:`, parseError.message);
                errorCount++;
                
                // Check if all questions have been processed
                finishProcessing();
              }
            });
            
            // If there were no questions to validate, finish immediately
            if (questionJsonObjects.length === 0) {
              return res.json({ 
                success: true, 
                message: "Text processed successfully but no valid questions found",
                combinedPrompt: combinedPrompt,
                processedText: combinedPrompt, // Include for backward compatibility
                vectorStoreId: vectorBase.vectorStoreId, // Include the vector store ID for reuse
                rawText: rawText // Include original raw text
              });
            }
            
            // IMPORTANT: Don't continue here, we'll handle the response in finishProcessing
            // after all async validations are complete
            return;
          }
        } catch (formatError) {
          //console.error("Error attempting to format as questions:", formatError);
          // Continue with normal processing if question formatting fails
        }
      } else {
        // If no questions are detected or if the regex failed to find matches
        //console.log("No question format detected in the batch output or regex failed to find matches");
        //console.log("First 500 characters of output for inspection:");
        //console.log(combinedPrompt.substring(0, 500));
        
        // Standard response format - only reaches here if we didn't return from question processing
        return res.json({ 
          success: true, 
          message: "Text processed successfully",
          combinedPrompt: combinedPrompt,
          processedText: combinedPrompt, // Include for backward compatibility
          vectorStoreId: vectorBase.vectorStoreId, // Include the vector store ID for reuse
          rawText: rawText // Include original raw text
        });
      }
    } catch (error) {
      //console.error("Error processing responses:", error);
      res.status(500).json({ 
        error: "Failed to process responses", 
        message: error.message || "Unknown error",
        partialResponses: collatedResponses
      });
    }
  } catch (error) {
    //console.error("Error in batch processing:", error);
    
    // Add specific error messages based on the error type
    if (error.message === 'OpenAI request timed out') {
      return res.status(504).json({ 
        error: "Processing timed out. The text may be too complex. Please try with smaller text segments." 
      });
    }
    
    // Check for OpenAI API errors
    if (error.response?.status) {
      //console.error("OpenAI API error:", error.response.status, error.response.data);
      return res.status(502).json({ 
        error: "Error from AI service. Please try again later." 
      });
    }
    
    res.status(500).json({ 
      error: "Failed to process text", 
      message: error.message || "Unknown error"
    });
  }
}

// Helper function to split text into smaller parts at sentence boundaries
function splitTextIntoSentenceParts(text, maxParts = 20) {
  // Regular expression to match sentence endings (period, question mark, exclamation mark)
  // followed by a space or end of string
  const sentenceEndRegex = /[.!?](?:\s|$)/g;
  
  // Find all sentence ending positions
  const sentenceEndings = [];
  let match;
  while ((match = sentenceEndRegex.exec(text)) !== null) {
    sentenceEndings.push(match.index + 1); // +1 to include the punctuation mark
  }
  
  // If no sentence endings found or only one sentence, return the whole text as one part
  if (sentenceEndings.length <= 1) {
    return [text];
  }
  
  // Estimate number of words in the text using a safer approach
  // Count spaces as an approximation instead of using split for large texts
  const wordCount = (text.match(/\s+/g) || []).length + 1;
  //console.log(`Estimated total word count: ~${wordCount}`);
  
  // Determine minimum number of parts (ensure at least 20 parts)
  const minParts = Math.max(20, maxParts);
  
  // Calculate minimum part size in words (target 1000 words minimum per part)
  const minWordsPerPart = 1000;
  
  // Calculate approximately how many sentences should be in each part
  // based on both the minimum parts requirement and the word count requirement
  const totalSentences = sentenceEndings.length;
  
  // First calculate based on minimum parts
  let sentencesPerPart = Math.ceil(totalSentences / minParts);
  
  // Now check if this gives us approximately 1000 words per part
  // If not, adjust to ensure parts have at least 1000 words if possible
  const avgWordsPerSentence = wordCount / totalSentences;
  const sentencesNeededFor1000Words = Math.ceil(minWordsPerPart / avgWordsPerSentence);
  
  // Choose the larger value to satisfy both constraints (min parts and min words)
  sentencesPerPart = Math.max(sentencesPerPart, sentencesNeededFor1000Words);
  
  //console.log(`Targeting approximately ${sentencesPerPart} sentences per part to achieve minimum parts and word count goals`);
  
  const parts = [];
  let startPos = 0;
  
  // Create parts with the calculated number of sentences per part
  for (let i = sentencesPerPart - 1; i < totalSentences; i += sentencesPerPart) {
    const endPos = i >= sentenceEndings.length ? text.length : sentenceEndings[i];
    const part = text.substring(startPos, endPos).trim();
    
    // Count words in this part using a safer approach
    const partWordCount = (part.match(/\s+/g) || []).length + 1;
    //console.log(`Part ${parts.length + 1} word count: ~${partWordCount}`);
    
    parts.push(part);
    startPos = endPos;
    
    // Stop if we've reached the maximum number of parts (safety check)
    if (parts.length >= minParts - 1 && startPos < text.length) {
      break;
    }
  }
  
  // Add any remaining text as the last part
  if (startPos < text.length) {
    const lastPart = text.substring(startPos).trim();
    const lastPartWordCount = (lastPart.match(/\s+/g) || []).length + 1;
    //console.log(`Last part word count: ~${lastPartWordCount}`);
    parts.push(lastPart);
  }
  
  //console.log(`Split text into ${parts.length} parts`);
  
  return parts;
}

async function validateQuestionWithOpenAI(questionText) {
  try {
    if (!questionText || questionText.trim() === '') {
      //console.log("Empty question, skipping validation");
      return "skip";
    }

    // System prompt to check if question is suitable
    const systemPrompt = `You are an AI that evaluates questions for completeness and self-containment.
Your job is to determine if a question can be answered without external references or visual elements.

Analyze the question and respond with ONLY "keep" or "skip" based on these criteria:

Return "skip" if ANY of these conditions are true:
- The question is incomplete or lacks sufficient context
- The question refers to an image, picture, diagram, chart, or table that is not described in the question itself
- The question uses phrases like "according to the diagram", "refer to the image", "as shown in the figure", etc.
- The question contains references to external examples, exhibits, or visual elements
- The question or its options are incomplete
- The question has ellipses (...) indicating missing content
- The question includes "See example/image/figure/chart number X"
- The question cannot be understood without seeing something not in the text

Return "keep" if:
- The question is self-contained
- The question provides all necessary context within its text
- The question can be answered without referring to external elements
- The question is complete and well-formed

Respond ONLY with the word "keep" or "skip" - no explanation or nowadditional text.`;

const systemPrompt_manu = `You are an AI that evaluates questions for completeness and self-containment.
If you find that some parts of the question is missing or it is referencing some portion of the text which is not 
given to you, then you can rephrase the question to make it complete. Keep the tone and context of the questions exactly the same`;

    // Make the API call
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Updated to use correct model name
      messages: [
      { role: "system", content: systemPrompt },
        { role: "user", content: questionText }
      ],
      temperature: 0, // Use 0 for consistent outputs
      max_tokens: 1000,  // Keep response short
    });

    // Extract response
    const result = response.choices[0].message.content.trim().toLowerCase();
    
    // Validate response format
    if (result === "keep" || result === "skip") {
      return result;
    } else {
      //console.warn(`Unexpected validation response: ${result}, defaulting to "keep"`);
      return "keep";
    }
  } catch (error) {
    //console.error("Error validating question:", error.message);
    // Default to keep if there's an error
    return "keep";
  }
}

/**
 * Function 1: Save raw text to vector store as knowledge base
 * @param {string} rawText - The text content to save to vector store
 * @param {string} vectorStoreName - Name for the vector store (optional)
 * @param {Object} attributes - Optional attributes for filtering (optional)
 * @returns {Object} - Object containing vector store ID and file ID
 */
async function saveTextToVectorStore(rawText, vectorStoreName = 'Knowledge Base', attributes = {}) {
    try {
        //console.log(`Saving text to vector store. Text length: ${rawText.length} characters, Store name: "${vectorStoreName}"`);
        
        // Create a temporary text file from raw text
        const tempFileName = `temp_knowledge_${Date.now()}.txt`;
        const tempDir = path.join(__dirname, '../uploads');
        
        // Ensure the uploads directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, tempFileName);
        
        //console.log(`Creating temporary file at: ${tempFilePath}`);
        
        // Write raw text to temporary file
        fs.writeFileSync(tempFilePath, rawText, 'utf8');
        //console.log(`Wrote ${rawText.length} characters to temporary file`);
        
        // Create vector store - now directly in openai, not in beta
        //console.log(`Creating vector store with name: "${vectorStoreName}"`);
        const vectorStore = await openai.vectorStores.create({
            name: vectorStoreName,
        });
        
        //console.log(`Created vector store: ${vectorStore.id}`);
        // Avoid circular references by only logging essential properties
        //console.log(`Vector store name: "${vectorStore.name}", status: ${vectorStore.status}`);
        
        // Debug logging for vector store ID
        //console.log(`DEBUG: vectorStore.id type: ${typeof vectorStore.id}`);
        //console.log(`DEBUG: vectorStore.id value: ${JSON.stringify(vectorStore.id)}`);
        
        try {
            // Use the upload_and_poll method which handles both upload and polling automatically
            //console.log(`Uploading file directly to vector store using upload_and_poll`);
            const fileStream = fs.createReadStream(tempFilePath);
            
            const vectorStoreFile = await openai.vectorStores.files.uploadAndPoll(
                vectorStore.id,
                fileStream
            );
            
            //console.log(`Successfully added file to vector store: ${vectorStoreFile.id}`);
            //console.log(`Vector store file status: ${vectorStoreFile.status}`);
            
            // The uploadAndPoll method already handles polling, so we don't need manual polling
            if (vectorStoreFile.status === "completed") {
                //console.log(`File processing completed successfully`);
            } else if (vectorStoreFile.status === "failed") {
                //console.error(`File processing failed`);
                throw new Error(`Vector store file processing failed with status: ${vectorStoreFile.status}`);
            } else {
                //console.warn(`File processing ended with unexpected status: ${vectorStoreFile.status}`);
            }
            
            // Clean up temporary file
            //console.log(`Cleaning up temporary file: ${tempFilePath}`);
            fs.unlinkSync(tempFilePath);
            
            const result = {
                success: true,
                vectorStoreId: vectorStore.id,
                fileId: vectorStoreFile.id,
                message: 'Text successfully saved to vector store'
            };
            
            //console.log(`Vector store operation complete: success=${result.success}, vectorStoreId=${result.vectorStoreId}, fileId=${result.fileId}`);
            
            // Debug logging for result object
            //console.log(`DEBUG: result.vectorStoreId type1: ${typeof result.vectorStoreId}`);
            //console.log(`DEBUG: result.vectorStoreId value: ${JSON.stringify(result.vectorStoreId)}`);
            
            return result;
        } catch (uploadError) {
            //console.error(`Error during file upload: ${uploadError.message}`);
            
            // Clean up temporary file if it exists
            try {
                if (fs.existsSync(tempFilePath)) {
                    //console.log(`Cleaning up temporary file after error: ${tempFilePath}`);
                    fs.unlinkSync(tempFilePath);
                }
            } catch (cleanupError) {
                //console.error(`Error cleaning up temporary file: ${cleanupError.message}`);
            }
            
            throw uploadError;
        }
        
    } catch (error) {
        //console.error('Error saving text to vector store:', error);
        
        // Clean up temporary file if it exists (use the same path logic)
        const tempDir = path.join(__dirname, '../uploads');
        // Note: We can't get the exact filename here since Date.now() will be different
        // This is a limitation, but the main cleanup happens in the try block
        //console.log(`Error occurred during vector store creation`);
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Function 2: Search vector store and return synthesized answer
 * @param {string} vectorStoreId - The ID of the vector store to search
 * @param {string} userQuestion - The question to search for
 * @param {Object} options - Optional search parameters
 * @param {Object} context - Optional context (chapterTitle, grade, subject) for teacher-like responses
 * @returns {Object} - Object containing the answer and metadata
 */
async function searchVectorStoreForAnswer(vectorStoreId, userQuestion, options = {}, context = {}) {
    try {
        // Debug logging to see what we received
        console.log(`DEBUG: vectorStoreId type3: ${typeof vectorStoreId}`);
        //console.log(`DEBUG: vectorStoreId value: ${JSON.stringify(vectorStoreId)}`);
        
        // Check if vectorStoreId is valid
        if (!vectorStoreId) {
            //console.error('Error: vectorStoreId is undefined or null');
            return {
                answer: '["No vector store available", "Medium", 1]',
                sources: [],
                totalResults: 0,
                error: "Missing vectorStoreId parameter"
            };
        }
        
        // Ensure vectorStoreId is a string
        if (typeof vectorStoreId !== 'string') {
            //console.error(`Error: vectorStoreId is not a string. Type: ${typeof vectorStoreId}, Value: ${JSON.stringify(vectorStoreId)}`);
            return {
                answer: '["Invalid vector store ID format", "Medium", 1]',
                sources: [],
                totalResults: 0,
                error: "vectorStoreId must be a string"
            };
        }
        
        // First, check if the vector store is ready and has files
        try {
            //console.log(`Checking vector store status: ${vectorStoreId}`);
            // Try both methods to see which one works
            let vectorStore;
            try {
                // Method 1: Direct ID parameter (common in many SDKs)
                vectorStore = await openai.vectorStores.retrieve(vectorStoreId);
                //console.log(`DEBUG: retrieve method 1 (direct ID) succeeded`);
            } catch (method1Error) {
                //console.log(`DEBUG: retrieve method 1 failed: ${method1Error.message}`);
                try {
                    // Method 2: Object parameter as shown in documentation
                    vectorStore = await openai.vectorStores.retrieve({
                        vector_store_id: vectorStoreId
                    });
                    //console.log(`DEBUG: retrieve method 2 (object param) succeeded`);
                } catch (method2Error) {
                    //console.log(`DEBUG: retrieve method 2 failed: ${method2Error.message}`);
                    throw method2Error;
                }
            }
            
            if (vectorStore.status !== 'completed') {
                //console.log(`Vector store status is ${vectorStore.status}, not ready for search`);
                return {
                    answer: '["Vector store not ready", "Medium", 1]',
                    sources: [],
                    totalResults: 0,
                    error: `Vector store status: ${vectorStore.status}`
                };
            }
            
            if (vectorStore.file_counts.completed === 0) {
                //console.log(`Vector store has no completed files`);
                return {
                    answer: '["No files in vector store", "Medium", 1]',
                    sources: [],
                    totalResults: 0,
                    error: "Vector store has no files"
                };
            }
            
            //console.log(`Vector store ready with ${vectorStore.file_counts.completed} files`);
        } catch (statusError) {
            //console.error(`Error checking vector store status: ${statusError.message}`);
            // Continue with search attempt anyway
        }
        
        //console.log(`Searching vector store ${vectorStoreId} for question: "${userQuestion.substring(0, 100)}..."`);
        
        const {
            maxResults = 5, // Reduced from 10 to limit context
            scoreThreshold = 0.3,
            rewriteQuery = true,
            attributeFilter = null
        } = options;
        
        // Log search parameters
        //console.log(`Search parameters: maxResults=${maxResults}, scoreThreshold=${scoreThreshold}, rewriteQuery=${rewriteQuery}`);
        
        let results;
        let retryCount = 0;
        const maxRetries = 3;
        let searchSuccessful = false;
        
        // Retry loop for handling errors
        while (retryCount < maxRetries && !searchSuccessful) {
            try {
                //console.log(`Vector store search attempt ${retryCount + 1}/${maxRetries}`);
                
                // Add delay between retries to avoid overwhelming the API
                if (retryCount > 0) {
                    const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 10000); // exponential backoff, max 10s
                    //console.log(`Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                // Use the correct OpenAI SDK method for vector store search
                // According to the OpenAI documentation, the method signature should be:
                // client.vectorStores.search({ vector_store_id: "vs_123", query: "question" })
                
                // Build the search parameters object correctly
                const searchParams = {
                    vector_store_id: vectorStoreId,
                    query: userQuestion
                };

                // Add optional parameters
                if (maxResults && maxResults !== 5) {
                    searchParams.max_num_results = maxResults;
                }

                if (rewriteQuery !== undefined) {
                    searchParams.rewrite_query = rewriteQuery;
                }

                // Add ranking options if score threshold is specified
                if (scoreThreshold) {
                    searchParams.ranking_options = {
                        score_threshold: scoreThreshold
                    };
                }

                // Add attribute filter if specified
                if (attributeFilter) {
                    searchParams.filters = attributeFilter;
                }

                // Debug log the search parameters
                //console.log(`DEBUG: searchParams object: ${JSON.stringify(searchParams)}`);
                //console.log(`DEBUG: About to call openai.vectorStores.search with vectorStoreId: ${vectorStoreId}`);

                // Call the search method with the parameters object
                // Try different approaches to see which one works
                //console.log(`DEBUG: Attempting vector store search...`);
                
                try {
                    // Method 1: Direct parameter passing with minimal params
                    const method1Params = {
                        vector_store_id: vectorStoreId,
                        query: userQuestion
                    };
                    //console.log(`DEBUG: Method 1 params: ${JSON.stringify(method1Params)}`);
                    results = await openai.vectorStores.search(method1Params);
                    //console.log(`DEBUG: Method 1 succeeded`);
                } catch (method1Error) {
                    //console.log(`Method 1 failed: ${method1Error.message}`);
                    
                    // Method 2: Try with different parameter name (some SDKs use 'vectorStoreId' instead of 'vector_store_id')
                    try {
                        const method2Params = {
                            vectorStoreId: vectorStoreId,
                            query: userQuestion
                        };
                        //console.log(`DEBUG: Method 2 params: ${JSON.stringify(method2Params)}`);
                        results = await openai.vectorStores.search(method2Params);
                        //console.log(`DEBUG: Method 2 succeeded`);
                    } catch (method2Error) {
                        //console.log(`Method 2 failed: ${method2Error.message}`);
                        
                        // Method 3: Try passing vectorStoreId as first parameter, query as second
                        try {
                            //console.log(`DEBUG: Method 3 - vectorStoreId: ${vectorStoreId}, query: ${userQuestion}`);
                            results = await openai.vectorStores.search(vectorStoreId, {
                                query: userQuestion
                            });
                            //console.log(`DEBUG: Method 3 succeeded`);
                        } catch (method3Error) {
                            //console.log(`Method 3 failed: ${method3Error.message}`);
                            
                            // Method 4: Using the original searchParams object
                            try {
                                //console.log(`DEBUG: Method 4 params: ${JSON.stringify(searchParams)}`);
                                results = await openai.vectorStores.search(searchParams);
                                //console.log(`DEBUG: Method 4 succeeded`);
                            } catch (method4Error) {
                                //console.log(`Method 4 failed: ${method4Error.message}`);
                                throw method4Error; // Re-throw the last error
                            }
                        }
                    }
                }
                //console.log(`Search request successful for vector store ID: ${vectorStoreId}`);
                searchSuccessful = true;
                
            } catch (searchError) {
                //console.log(`Vector store search error (attempt ${retryCount + 1}/${maxRetries}): ${searchError.message}`);
                retryCount++;
                
                if (retryCount >= maxRetries) {
                    //console.error(`OpenAI vector store search error: ${searchError.message}`);
                    break;
                }
            }
        }
        
        // If all retries failed, provide a fallback response
        if (!searchSuccessful) {
            //console.log(`All vector store search attempts failed, providing fallback response`);
            return {
                answer: '["Vector store search temporarily unavailable", "Medium", 1]',
                sources: [],
                totalResults: 0,
                error: "Vector store search failed after retries"
            };
        }
        
        // Check if we have any results
        if (!results.data || results.data.length === 0) {
            // No results found in vector store - answer from general knowledge
            // Determine difficulty level and grade context
            const grade = context.grade || "general";
            const chapterTitle = context.chapterTitle || "this chapter";
            const subject = context.subject || "the subject";
            
            // Build teacher-like system prompt based on grade level
            let systemPrompt = `You are a helpful, patient, and encouraging teacher who explains concepts clearly and at an appropriate level for ${grade} grade students. `;
            
            // Adjust tone and complexity based on grade
            if (grade.includes("1") || grade.includes("2") || grade.includes("3") || grade.includes("4") || grade.includes("5")) {
                systemPrompt += `Use simple language, short sentences, and friendly explanations. Use examples that students can relate to. Be warm and encouraging. `;
            } else if (grade.includes("6") || grade.includes("7") || grade.includes("8")) {
                systemPrompt += `Use clear, age-appropriate language. Explain concepts step-by-step with relevant examples. Be supportive and engaging. `;
            } else if (grade.includes("9") || grade.includes("10") || grade.includes("11") || grade.includes("12")) {
                systemPrompt += `Use appropriate academic language while remaining accessible. Provide detailed explanations with examples. Be professional yet approachable. `;
            } else {
                systemPrompt += `Use clear and accessible language. Explain concepts thoroughly with examples. Be professional and helpful. `;
            }
            
            // Add language instruction to system prompt
            systemPrompt += `\n\nIMPORTANT LANGUAGE INSTRUCTION: 
The student's question is written in a specific language. You MUST detect the language of the question and respond in the EXACT SAME LANGUAGE. 
If the question is in French, respond in French. If it's in Spanish, respond in Spanish. 
If it's in Hindi, respond in Hindi. If it's in Bengali, respond in Bengali. If it's in Arabic, respond in Arabic.
Match the language of your response to the language of the question. 
All explanations, examples, and text in your response must be in the same language as the question.`;
            
            systemPrompt += `\n\nIMPORTANT: When a question is out of scope from the chapter, you should:
1. First, politely acknowledge that this question is not covered in "${chapterTitle}" (the current chapter)
2. Then, still provide a helpful answer from your general knowledge to satisfy the student's curiosity
3. Maintain a teacher-like, encouraging tone
4. Use appropriate terminology for ${grade} grade level
5. Respond in the same language as the student's question`;
            
            // Generate response from general knowledge
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                temperature: 0.7,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: `The student asked: "${userQuestion}"\n\nThis question is not covered in the chapter "${chapterTitle}" (${subject}). However, the student is curious and wants to know the answer.\n\nPlease:\n1. First acknowledge that this topic is not part of "${chapterTitle}"\n2. Then provide a helpful, teacher-like explanation from your general knowledge\n3. Make sure your answer is appropriate for ${grade} grade level\n4. Respond in the same language as the student's question\n\nStructure your response to be friendly and educational, as if you're a teacher helping a curious student.`
                    }
                ],
                max_tokens: 800
            });
            
            return { 
                answer: completion.choices[0].message.content,
                sources: [],
                totalResults: 0
            };
        }
        
        //console.log(`Found ${results.data.length} results in vector store`);
        
        // Extract text content from all results with length limits
        let textSources = results.data
            .map(result => 
                result.content
                    .map(content => content.text)
                    .join('\n')
            )
            .join('\n\n');
        
        // Limit context to prevent token overflow - keep only first 5000 chars
        if (textSources.length > 5000) {
            textSources = textSources.substring(0, 5000) + "...[truncated]";
            //console.log(`Truncated source text to 5000 characters to avoid token limits`);
        }
        
        //console.log(`Extracted ${textSources.length} characters of source text for answer synthesis`);
        
        // Determine difficulty level and grade context
        const grade = context.grade || "general";
        const chapterTitle = context.chapterTitle || "this chapter";
        const subject = context.subject || "the subject";
        
        // Build teacher-like system prompt based on grade level
        let systemPrompt = `You are a helpful, patient, and encouraging teacher who explains concepts clearly and at an appropriate level for ${grade} grade students. `;
        
        // Adjust tone and complexity based on grade
        if (grade.includes("1") || grade.includes("2") || grade.includes("3") || grade.includes("4") || grade.includes("5")) {
            systemPrompt += `Use simple language, short sentences, and friendly explanations. Use examples that students can relate to. Be warm and encouraging. `;
        } else if (grade.includes("6") || grade.includes("7") || grade.includes("8")) {
            systemPrompt += `Use clear, age-appropriate language. Explain concepts step-by-step with relevant examples. Be supportive and engaging. `;
        } else if (grade.includes("9") || grade.includes("10") || grade.includes("11") || grade.includes("12")) {
            systemPrompt += `Use appropriate academic language while remaining accessible. Provide detailed explanations with examples. Be professional yet approachable. `;
        } else {
            systemPrompt += `Use clear and accessible language. Explain concepts thoroughly with examples. Be professional and helpful. `;
        }
        
        // Add language instruction to system prompt
        systemPrompt += `\n\nIMPORTANT LANGUAGE INSTRUCTION: 
The student's question is written in a specific language. You MUST detect the language of the question and respond in the EXACT SAME LANGUAGE. 
If the question is in French, respond in French. If it's in Spanish, respond in Spanish. 
If it's in Hindi, respond in Hindi. If it's in Bengali, respond in Bengali. If it's in Arabic, respond in Arabic.
Match the language of your response to the language of the question. 
All explanations, examples, and text in your response must be in the same language as the question.`;
        
        systemPrompt += `\n\nWhen answering questions about "${chapterTitle}" in ${subject}:\n`;
        systemPrompt += `- Provide clear, well-structured explanations\n`;
        systemPrompt += `- Use appropriate terminology for ${grade} grade level\n`;
        systemPrompt += `- Break down complex concepts into understandable parts\n`;
        systemPrompt += `- Include relevant examples when helpful\n`;
        systemPrompt += `- Format your answer in a friendly, conversational tone\n`;
        systemPrompt += `- If the question cannot be answered from the provided sources, politely say so\n`;
        systemPrompt += `- Keep your answer comprehensive but not overwhelming\n`;
        systemPrompt += `- RESPOND IN THE SAME LANGUAGE AS THE STUDENT'S QUESTION - all text, explanations, and examples must match the question's language\n\n`;
        systemPrompt += `Answer the student's question directly and helpfully in the same language they used, as if you're having a one-on-one conversation with them.`;

        // Synthesize response using GPT-4 with teacher-like prompt
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0.7, // Slightly higher for more natural, conversational responses
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: `Based on the following information from "${chapterTitle}", please answer the student's question.\n\nIMPORTANT: Respond in the same language that the student used in their question.\n\nSources:\n${textSources}\n\nStudent's Question: ${userQuestion}\n\nPlease provide a helpful, teacher-like explanation that matches the ${grade} grade level, using the same language as the student's question.`
                }
            ],
            max_tokens: 800 // Increased for more detailed teacher-like responses
        });
        
        const answerText = completion.choices[0].message.content;
        
        // Return object with answer and metadata
        return {
            answer: answerText,
            sources: results.data.map(r => ({
                score: r.score,
                text: r.content.map(c => c.text).join('\n').substring(0, 500)
            })),
            totalResults: results.data.length
        };
        
    } catch (error) {
        //console.error('Error searching vector store:', error);
        return {
            answer: '["Error occurred during search", "Medium", 1]',
            sources: [],
            totalResults: 0,
            error: error.message
        };
    }
}

// Helper function to format search results (optional utility)
function formatSearchResults(results) {
    return results.data.map((result, index) => {
        return `Source ${index + 1} (Score: ${result.score.toFixed(2)}):\n${
            result.content.map(c => c.text).join('\n')
        }\n`;
    }).join('\n');
}

module.exports = router;