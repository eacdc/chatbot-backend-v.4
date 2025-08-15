// Updated chapterRoutes.js - May 2025
const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const Chapter = require("../models/Chapter");
const OpenAI = require("openai");
const jwt = require("jsonwebtoken"); // Make sure to import jwt
const authenticateUser = require("../middleware/authMiddleware");
const authenticateAdmin = require("../middleware/adminAuthMiddleware");
const Book = require("../models/Book");
const Prompt = require("../models/Prompt");
const fs = require('fs');
const path = require('path');
const https = require('https');

// Helper function to make HTTPS requests
function makeHttpsRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = https.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        json: () => Promise.resolve(jsonData),
                        text: () => Promise.resolve(data)
                    });
                } catch (error) {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        json: () => Promise.reject(new Error('Invalid JSON')),
                        text: () => Promise.resolve(data)
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// Import node-fetch for OpenAI
const fetch = require('node-fetch');
const FormData = require('form-data');

// Initialize OpenAI client with fetch polyfill
let openai;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY,
        fetch // Use node-fetch as the fetch implementation (pass the function directly)
    });
    console.log("OpenAI client initialized successfully in chapterRoutes.js");
} else {
        console.warn("OPENAI_API_KEY not found in environment variables. OpenAI features in chapterRoutes will be disabled.");
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
    console.error("Error initializing OpenAI client in chapterRoutes:", error);
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
      const { bookId, title, prompt } = req.body;
      const newChapter = new Chapter({ bookId, title, prompt });
      const savedChapter = await newChapter.save();
      res.status(201).json(savedChapter);
    } catch (error) {
      console.error("Error adding chapter:", error);
      res.status(500).json({ error: "Failed to add chapter" });
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
                console.error("Error fetching chapter:", err);
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

        console.log("Sending to OpenAI:", messagesForOpenAI);

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
        console.error("Error in chatbot API:", error);
        res.status(500).json({ message: "Error getting response from OpenAI", error: error.message });
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
        console.error("Error fetching chat history:", error);
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
            console.error("Error decoding token:", err);
            return res.status(401).json({ error: "Invalid token" });
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

// Process raw text through OpenAI with text splitting (batched processing)
router.post("/process-text-batch", authenticateAdmin, async (req, res) => {
  return await processBatchText(req, res);
});

// Shared batch text processing function/****************** */
async function processBatchText(req, res) {
  try {
    const { rawText, subject, chapterTitle } = req.body;

    if (!rawText) {
      return res.status(400).json({ error: "Raw text is required" });
    }
    
    // Log processing attempt
    console.log(`Processing text with batching. Text length: ${rawText.length} characters`);
    console.log(`Subject: ${subject || 'Not provided'}, Chapter: ${chapterTitle || 'Not provided'}`);
    
    // Split text into smaller parts (min 20 parts with min 1000 words each) at sentence boundaries
    const vectorBase = await saveTextToVectorStore(rawText);
    const textParts = splitTextIntoSentenceParts(rawText, 20);
    console.log(`Split text into ${textParts.length} parts`);
    
    // Check if vector base was created successfully
    if (!vectorBase || !vectorBase.success || !vectorBase.vectorStoreId) {
      console.error("Failed to create vector store for text processing");
      return res.status(500).json({ 
        error: "Failed to create vector store for text", 
        message: vectorBase?.error || "Unknown error"
      });
    }
    
    console.log(`Successfully created vector store with ID: ${vectorBase.vectorStoreId}`);
    
    // Fetch the system prompt from the database
    let systemPrompt;
    try {
      const promptDoc = await Prompt.findOne({ prompt_type: "batchProcessing", isActive: true });
      if (promptDoc) {
        systemPrompt = promptDoc.prompt;
        console.log("Successfully loaded Batch Processing prompt from database");
        
        // Replace variables in the prompt if subject and chapter are provided
        if (subject) {
          systemPrompt = systemPrompt.replace(/<Subject>/g, subject);
        }
        
        if (chapterTitle) {
          systemPrompt = systemPrompt.replace(/<Chapter>/g, chapterTitle);
        }
        
        console.log("Replaced variables in prompt template");
      } else {
        // Fallback to default prompt
        systemPrompt = "";
        console.warn("Warning: Batch Processing system prompt not found in database, using default");
      }
    } catch (error) {
      console.error("Error fetching Batch Processing system prompt:", error);
      // Fallback to default prompt
      systemPrompt = "";
    }

    // Process each part with OpenAI and collect responses
    const collatedResponses = {};
    
    for (let i = 0; i < textParts.length; i++) {
      try {
        console.log(`Processing part ${i+1}/${textParts.length}`);
        
        // Memory monitoring every 10 parts
        if (i % 10 === 0 && global.gc) {
          global.gc();
          const memUsage = process.memoryUsage();
          console.log(`Memory usage: RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB, Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB, Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
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
            console.log(`OpenAI request for part ${i+1} attempt ${retryCount + 1}/${maxRetries + 1}`);
            
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
            
            console.log(`Retry ${retryCount + 1}/${maxRetries} due to error: ${error.message}`);
            
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
          console.error(`Invalid or empty response from OpenAI for part ${i+1}`);
          collatedResponses[`part_${i+1}`] = "Error processing this section";
        } else {
          const processedText = response.choices[0].message.content;
          console.log(`Part ${i+1} processed successfully. Result length: ${processedText.length}`);
          collatedResponses[`part_${i+1}`] = processedText;
        }
      } catch (error) {
        console.error(`Error processing part ${i+1}:`, error);
        collatedResponses[`part_${i+1}`] = "Error processing this section";
      }
    }
    
    // Save the combined responses as a system prompt
    try {
      // Combine all responses
      const combinedPrompt = Object.values(collatedResponses).join("\n\n");
      console.log(`Combined all responses into text of length: ${combinedPrompt.length}`);
      
      // Check if the combined text appears to contain JSON formatted questions
      const hasQField = combinedPrompt.includes('"Q":');
      const hasQuestionField = combinedPrompt.includes('"question":');
      console.log(`Text contains Q field: ${hasQField}, question field: ${hasQuestionField}`);
      
      if (hasQuestionField) {
        try {
          console.log("Detected question format in the batch output - attempting to structure as question array");
          
          // Extract JSON objects with question field (modified regex to not require Q field)
          const questionJsonObjects = combinedPrompt.match(/\{[\s\S]*?"question"[\s\S]*?\}/g);
          console.log(`Regex match result: ${questionJsonObjects ? `Found ${questionJsonObjects.length} matches` : 'No matches found'}`);
          
          if (questionJsonObjects && questionJsonObjects.length > 0) {
            console.log(`Found ${questionJsonObjects.length} potential question objects in the text`);
            
            // Log a sample of the first match for debugging
            if (questionJsonObjects.length > 0) {
              console.log(`Sample first match: ${questionJsonObjects[0].substring(0, 200)}...`);
              
              try {
                const sampleParsed = JSON.parse(questionJsonObjects[0]);
                console.log(`Sample parsed successfully: subtopic=${sampleParsed.subtopic}, question=${sampleParsed.question?.substring(0, 50)}..., question type=${sampleParsed["question type"] || sampleParsed.question_type || "N/A"}`);
              } catch (parseError) {
                console.error(`Could not parse sample match as JSON: ${parseError.message}`);
                console.log(`Raw sample for inspection: ${JSON.stringify(questionJsonObjects[0])}`);
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
                  console.log(`Successfully structured ${successCount} questions with ${errorCount} errors`);
                  
                  // If we have successfully parsed questions, return them as a proper array
                  return res.json({ 
                    success: true, 
                    message: `Text processed and structured into ${structuredQuestions.length} questions`,
                    combinedPrompt: JSON.stringify(structuredQuestions),
                    isQuestionFormat: true,
                    questionArray: structuredQuestions,
                    totalQuestions: structuredQuestions.length,
                    nextSteps: "To save these questions to a chapter, send a POST request to /api/chapters/update-chapter-questions/:chapterId with the 'questions' array in the request body."
                  });
                } else {
                  // If no questions were kept after validation, return standard format
                  return res.json({ 
                    success: true, 
                    message: "Text processed successfully but no valid questions found",
                    combinedPrompt: combinedPrompt,
                    processedText: combinedPrompt // Include for backward compatibility
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
                    console.log(`Extracted question number ${questionNumber} from question text`);
                  }
                  
                  // Add Q field if missing
                  if (!questionObj.Q) {
                    questionObj.Q = questionNumber;
                    console.log(`Added Q field with value ${questionNumber} to question at index ${index}`);
                  }
                  
                  // Normalize question type field
                  if (questionObj["question type"] && !questionObj.question_type) {
                    questionObj.question_type = questionObj["question type"];
                    console.log(`Normalized "question type" to question_type: ${questionObj.question_type}`);
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
                      console.log(`Question validation result: ${validationResult}`);
                      
                      // Process the question to get answer, difficulty, and marks
                      console.log(`Getting analysis for question: "${questionObj.question.substring(0, 50)}..."`);
                      
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
                        
                        const response = await searchVectorStoreForAnswer(vectorBase.vectorStoreId, questionObj.question);
                        // const response = await answerQuestion(questionObj.question, embeddings);
                        console.log(`Raw answer response: ${response.answer}`);
                        
                        // Handle different response formats
                        let answerText = response.answer;
                        
                        // Check if it's already in the expected format
                        if (answerText.startsWith('[') && answerText.endsWith(']')) {
                          try {
                            questionAnalysis = JSON.parse(answerText);
                            console.log(`Successfully parsed questionAnalysis: ${JSON.stringify(questionAnalysis)}`);
                          } catch (parseError) {
                            console.error(`Error parsing JSON response: ${parseError.message}`);
                            // Create fallback response
                            questionAnalysis = ["Unable to parse answer", "Medium", 1];
                          }
                        } else {
                          // Handle plain text responses or error messages
                          console.log(`Received non-JSON response, creating structured format`);
                          
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
                        console.error(`Error getting question analysis: ${analysisError.message}`);
                        questionAnalysis = ["Error analyzing question", "Medium", 1];
                      }
                      
                      console.log(`Final questionAnalysis: ${JSON.stringify(questionAnalysis)}`);
                      
                      if (validationResult === "keep") {
                        // Add default values for missing fields
                        console.log(`Adding question to structuredQuestions array`);
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
                        console.log(`Skipping question at index ${index} based on validation`);
                        errorCount++;
                      }
                    } catch (error) {
                      console.error(`Error in question processing at index ${index}:`, error);
                      
                      // Default to keeping the question if validation fails
                      console.log(`Using fallback values for question at index ${index}`);
                      
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
                      console.log(`Validation complete. Remaining validations: ${pendingValidations}`);
                      // Check if all processing is complete and send response if needed
                      finishProcessing();
                    }
                  })();
                } else {
                  console.log(`Question object at index ${index} is missing required fields`);
                  errorCount++;
                  
                  // No validation to do, check if all processing is done
                  finishProcessing();
                }
              } catch (parseError) {
                console.error(`Error parsing question JSON at index ${index}:`, parseError.message);
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
                processedText: combinedPrompt // Include for backward compatibility
              });
            }
            
            // IMPORTANT: Don't continue here, we'll handle the response in finishProcessing
            // after all async validations are complete
            return;
          }
        } catch (formatError) {
          console.error("Error attempting to format as questions:", formatError);
          // Continue with normal processing if question formatting fails
        }
      } else {
        // If no questions are detected or if the regex failed to find matches
        console.log("No question format detected in the batch output or regex failed to find matches");
        console.log("First 500 characters of output for inspection:");
        console.log(combinedPrompt.substring(0, 500));
        
        // Standard response format - only reaches here if we didn't return from question processing
        return res.json({ 
          success: true, 
          message: "Text processed successfully",
          combinedPrompt: combinedPrompt,
          processedText: combinedPrompt // Include for backward compatibility
        });
      }
    } catch (error) {
      console.error("Error processing responses:", error);
      res.status(500).json({ 
        error: "Failed to process responses", 
        message: error.message || "Unknown error",
        partialResponses: collatedResponses
      });
    }
  } catch (error) {
    console.error("Error in batch processing:", error);
    
    // Add specific error messages based on the error type
    if (error.message === 'OpenAI request timed out') {
      return res.status(504).json({ 
        error: "Processing timed out. The text may be too complex. Please try with smaller text segments." 
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
  
  // Estimate number of words in the text
  const wordCount = text.split(/\s+/).length;
  console.log(`Estimated total word count: ${wordCount}`);
  
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
  
  console.log(`Targeting approximately ${sentencesPerPart} sentences per part to achieve minimum parts and word count goals`);
  
  const parts = [];
  let startPos = 0;
  
  // Create parts with the calculated number of sentences per part
  for (let i = sentencesPerPart - 1; i < totalSentences; i += sentencesPerPart) {
    const endPos = i >= sentenceEndings.length ? text.length : sentenceEndings[i];
    const part = text.substring(startPos, endPos).trim();
    
    // Count words in this part
    const partWordCount = part.split(/\s+/).length;
    console.log(`Part ${parts.length + 1} word count: ~${partWordCount}`);
    
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
    const lastPartWordCount = lastPart.split(/\s+/).length;
    console.log(`Last part word count: ~${lastPartWordCount}`);
    parts.push(lastPart);
  }
  
  console.log(`Split text into ${parts.length} parts`);
  
  return parts;
}

async function validateQuestionWithOpenAI(questionText) {
  try {
    if (!questionText || questionText.trim() === '') {
      console.log("Empty question, skipping validation");
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
      model: "gpt-4.1",
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
      console.warn(`Unexpected validation response: ${result}, defaulting to "keep"`);
      return "keep";
    }
  } catch (error) {
    console.error("Error validating question:", error.message);
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
        console.log(`Saving text to vector store. Text length: ${rawText.length} characters, Store name: "${vectorStoreName}"`);
        
        // Create a temporary text file from raw text
        const tempFileName = `temp_knowledge_${Date.now()}.txt`;
        const tempDir = path.join(__dirname, '../uploads');
        
        // Ensure the uploads directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, tempFileName);
        
        console.log(`Creating temporary file at: ${tempFilePath}`);
        
        // Write raw text to temporary file
        fs.writeFileSync(tempFilePath, rawText, 'utf8');
        console.log(`Wrote ${rawText.length} characters to temporary file`);
        
        // Create vector store - now directly in openai, not in beta
        console.log(`Creating vector store with name: "${vectorStoreName}"`);
        const vectorStore = await openai.vectorStores.create({
            name: vectorStoreName,
        });
        
        console.log(`Created vector store: ${vectorStore.id}`);
        console.log(`Vector store object: ${JSON.stringify(vectorStore)}`);
        
        try {
            // Use the new upload_and_poll method which handles both upload and vector store addition
            console.log(`Uploading file directly to vector store using upload_and_poll`);
            const fileStream = fs.createReadStream(tempFilePath);
            
            const vectorStoreFile = await openai.vectorStores.files.uploadAndPoll(
                vectorStore.id,
                {
                    file: fileStream
                }
            );
            
            console.log(`Successfully added file to vector store: ${vectorStoreFile.id}`);
            console.log(`Vector store file object: ${JSON.stringify(vectorStoreFile)}`);
            
            // Poll for status - with detailed logging
            let fileStatus = vectorStoreFile.status || "in_progress";
            console.log(`Initial file status: ${fileStatus}`);
            
            let attempts = 0;
            const maxAttempts = 10;
            
            while (fileStatus !== "completed" && fileStatus !== "failed" && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                
                try {
                    // Log all parameters being passed to the retrieve function
                    console.log(`Polling attempt ${attempts + 1}/${maxAttempts}`);
                    console.log(`Vector store ID being used: "${vectorStore.id}"`);
                    console.log(`Vector store file ID being used: "${vectorStoreFile.id}"`);
                    
                    // Use direct REST API call since SDK may have inconsistent behavior
                    try {
                        // Make a direct API call to get the file status
                        const retrieveResult = await makeHttpsRequest(`https://api.openai.com/v1/vector_stores/${vectorStore.id}/files/${vectorStoreFile.id}`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (!retrieveResult.ok) {
                            throw new Error(`HTTP error ${retrieveResult.status}: ${await retrieveResult.text()}`);
                        }
                        
                        const resultData = await retrieveResult.json();
                        console.log(`Retrieve result: ${JSON.stringify(resultData)}`);
                        fileStatus = resultData.status;
                        console.log(`File processing status: ${fileStatus}`);
                    } catch (retrieveError) {
                        console.error(`Error retrieving file status: ${retrieveError.message}`);
                        // Continue with the loop despite the error
                    }
                } catch (pollError) {
                    console.error(`Error polling file status: ${pollError.message}`);
                    // Continue with the loop despite the error
                }
                
                attempts++;
            }
            
            // Clean up temporary file
            console.log(`Cleaning up temporary file: ${tempFilePath}`);
            fs.unlinkSync(tempFilePath);
            
            const result = {
                success: true,
                vectorStoreId: vectorStore.id,
                fileId: vectorStoreFile.id,
                message: 'Text successfully saved to vector store'
            };
            
            console.log(`Vector store operation complete: ${JSON.stringify(result)}`);
            return result;
        } catch (uploadError) {
            console.error(`Error during file upload: ${uploadError.message}`);
            throw uploadError;
        }
        
    } catch (error) {
        console.error('Error saving text to vector store:', error);
        
        // Clean up temporary file if it exists (use the same path logic)
        const tempDir = path.join(__dirname, '../uploads');
        // Note: We can't get the exact filename here since Date.now() will be different
        // This is a limitation, but the main cleanup happens in the try block
        console.log(`Error occurred during vector store creation`);
        
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
 * @returns {Object} - Object containing the answer and metadata
 */
async function searchVectorStoreForAnswer(vectorStoreId, userQuestion, options = {}) {
    try {
        // Check if vectorStoreId is valid
        if (!vectorStoreId) {
            console.error('Error: vectorStoreId is undefined or null');
            return {
                answer: '["No vector store available", "Medium", 1]',
                sources: [],
                totalResults: 0,
                error: "Missing vectorStoreId parameter"
            };
        }
        
        // First, check if the vector store is ready and has files
        try {
            console.log(`Checking vector store status: ${vectorStoreId}`);
            const vectorStore = await openai.vectorStores.retrieve(vectorStoreId);
            
            if (vectorStore.status !== 'completed') {
                console.log(`Vector store status is ${vectorStore.status}, not ready for search`);
                return {
                    answer: '["Vector store not ready", "Medium", 1]',
                    sources: [],
                    totalResults: 0,
                    error: `Vector store status: ${vectorStore.status}`
                };
            }
            
            if (vectorStore.file_counts.completed === 0) {
                console.log(`Vector store has no completed files`);
                return {
                    answer: '["No files in vector store", "Medium", 1]',
                    sources: [],
                    totalResults: 0,
                    error: "Vector store has no files"
                };
            }
            
            console.log(`Vector store ready with ${vectorStore.file_counts.completed} files`);
        } catch (statusError) {
            console.error(`Error checking vector store status: ${statusError.message}`);
            // Continue with search attempt anyway
        }
        
        console.log(`Searching vector store ${vectorStoreId} for question: "${userQuestion.substring(0, 100)}..."`);
        
        const {
            maxResults = 5, // Reduced from 10 to limit context
            scoreThreshold = 0.3,
            rewriteQuery = true,
            attributeFilter = null
        } = options;
        
        // Log search parameters
        console.log(`Search parameters: maxResults=${maxResults}, scoreThreshold=${scoreThreshold}, rewriteQuery=${rewriteQuery}`);
        
        let results;
        let retryCount = 0;
        const maxRetries = 3;
        let searchSuccessful = false;
        
        // Retry loop for handling 500 errors
        while (retryCount < maxRetries && !searchSuccessful) {
            try {
                console.log(`Vector store search attempt ${retryCount + 1}/${maxRetries}`);
                
                // Add delay between retries to avoid overwhelming the API
                if (retryCount > 0) {
                    const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 10000); // exponential backoff, max 10s
                    console.log(`Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
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
                        ...(scoreThreshold && { 
                            ranking_options: {
                                score_threshold: scoreThreshold 
                            } 
                        }),
                        ...(attributeFilter && { filters: attributeFilter })
                    })
                });
                
                if (!searchResponse.ok) {
                    if (searchResponse.status === 500) {
                        console.log(`Vector store search returned 500 error (attempt ${retryCount + 1}/${maxRetries})`);
                        retryCount++;
                        continue;
                    }
                    throw new Error(`HTTP error ${searchResponse.status}: ${await searchResponse.text()}`);
                }
                
                results = await searchResponse.json();
                console.log(`Search request successful for vector store ID: ${vectorStoreId}`);
                searchSuccessful = true;
                
            } catch (searchError) {
                if (searchError.message.includes('500') || searchError.message.includes('server_error')) {
                    console.log(`Vector store search error (attempt ${retryCount + 1}/${maxRetries}): ${searchError.message}`);
                    retryCount++;
                    continue;
                }
                
                console.error(`OpenAI vector store search error: ${searchError.message}`);
                break; // Non-retryable error
            }
        }
        
        // If all retries failed, provide a fallback response
        if (!searchSuccessful) {
            console.log(`All vector store search attempts failed, providing fallback response`);
            return {
                answer: '["Vector store search temporarily unavailable", "Medium", 1]',
                sources: [],
                totalResults: 0,
                error: "Vector store search failed after retries"
            };
        }
        
        // Check if we have any results
        if (!results.data || results.data.length === 0) {
            console.log(`No results found in vector store for query`);
            return { 
                answer: '["No relevant information found", "Medium", 1]',
                sources: [],
                totalResults: 0
            };
        }
        
        console.log(`Found ${results.data.length} results in vector store`);
        
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
            console.log(`Truncated source text to 5000 characters to avoid token limits`);
        }
        
        console.log(`Extracted ${textSources.length} characters of source text for answer synthesis`);
        
        // Synthesize response using GPT-4 with reduced max_tokens
        console.log(`Generating synthesized answer using GPT-4`);
        const completion = await openai.chat.completions.create({
            model: "gpt-4.1",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant. Provide a concise answer in this exact JSON array format: [\"answer\", \"difficulty\", marks]. The answer should be a string with less than 25 words, difficulty should be Easy/Medium/Hard, and marks should be 1-5."
                },
                {
                    role: "user",
                    content: `Sources:\n${textSources}\n\nQuestion: ${userQuestion}\n\nProvide answer as: ["answer text", "difficulty", marks]`
                }
            ],
            temperature: 0.0,
            max_tokens: 300 // Reduced from 500 to ensure we stay within limits
        });
        
        const answerText = completion.choices[0].message.content;
        
        console.log(`Generated answer (${answerText.length} chars): "${answerText.substring(0, 100)}..."`);
        
        // Return object with answer and metadata
        return {
            answer: answerText,
            sources: results.data.map(r => ({
                score: r.score,
                text: r.content.map(c => c.text).join('\n').substring(0, 500) // Limit source text
            })),
            totalResults: results.data.length
        };
        
    } catch (error) {
        console.error('Error searching vector store:', error);
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

// Example usage functions

module.exports = {
    saveTextToVectorStore,
    searchVectorStoreForAnswer,
    formatSearchResults
};

// Uncomment to run example
// example();

module.exports = router;