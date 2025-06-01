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

if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: Missing OpenAI API Key in environment variables.");
    process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

// Shared batch text processing function
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
    const embeddings = await textToEmbeddings(rawText);
    const textParts = splitTextIntoSentenceParts(rawText, 20);
    console.log(`Split text into ${textParts.length} parts`);
    
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
                      // Check if the question should be kept
                      const validationResult = await validateQuestionWithOpenAI(questionObj.question);
                      console.log(`Question validation result: ${validationResult}`);
                      
                      // Process the question to get answer, difficulty, and marks
                      console.log(`Getting analysis for question: "${questionObj.question.substring(0, 50)}..."`);
                      
                      let questionAnalysis;
                      try {
                        const response = await answerQuestion(questionObj.question, embeddings);
                        console.log(`Raw answer response: ${response.answer}`);
                        
                        try {
                          questionAnalysis = JSON.parse(response.answer);
                          console.log(`Successfully parsed questionAnalysis: ${JSON.stringify(questionAnalysis)}`);
                        } catch (parseError) {
                          console.error(`Error parsing response.answer: ${parseError.message}`);
                          console.error(`Raw response.answer content: "${response.answer}"`);
                          
                          // Try to clean the answer for parsing
                          const cleanedAnswer = response.answer.trim()
                            .replace(/^```json/, '').replace(/```$/, '') // Remove code blocks
                            .replace(/^```/, '').replace(/```$/, '')      // Remove other code blocks
                            .trim();
                            
                          console.log(`Attempting to parse cleaned answer: "${cleanedAnswer}"`);
                          
                          try {
                            questionAnalysis = JSON.parse(cleanedAnswer);
                            console.log(`Successfully parsed cleaned answer into questionAnalysis`);
                          } catch (secondParseError) {
                            console.error(`Failed to parse cleaned answer: ${secondParseError.message}`);
                            // Set a default value
                            questionAnalysis = ["Unable to parse answer", "Medium", 1];
                            console.log(`Using default questionAnalysis: ${JSON.stringify(questionAnalysis)}`);
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
                          tentativeAnswer: questionObj.question_type === "short answer" || questionObj.question_type === "Descriptive" ? questionAnalysis[0] : "Not Required",
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
                        tentativeAnswer: questionObj.question_type === "short answer" || questionObj.question_type === "Descriptive" ? questionAnalysis[0] : "Not Required",
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
 * Converts raw text into chunked embeddings for knowledge base
 * @param {string} text - Raw text to process
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} Array of embedding objects
 */
async function textToEmbeddings(text, options = {}) {
  const {
    chunkSize = 1000,
    overlap = 100,
    model = 'text-embedding-3-small',
    batchSize = 10,
    openaiClient = openai
  } = options;

  console.log(`Starting textToEmbeddings with text length: ${text.length}, chunkSize: ${chunkSize}, overlap: ${overlap}`);
  
  if (!text || text.length === 0) {
    console.error("Error: Empty text provided to textToEmbeddings");
    return [];
  }

  try {
    const chunks = chunkText(text, chunkSize, overlap);
    console.log(`Created ${chunks.length} text chunks for embedding`);
    
    const embeddings = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
      
      try {
        const response = await openaiClient.embeddings.create({
          model: model,
          input: batch,
        });
        
        console.log(`Successfully received embeddings for batch ${Math.floor(i / batchSize) + 1}`);
        
        batch.forEach((chunk, batchIndex) => {
          embeddings.push({
            text: chunk,
            embedding: response.data[batchIndex].embedding,
            index: i + batchIndex,
            chunkSize: chunk.length
          });
        });
        
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`Failed to create embeddings for batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw new Error(`Failed to create embeddings for batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      }
    }
    
    console.log(`Successfully generated ${embeddings.length} embeddings`);
    return embeddings;
  } catch (error) {
    console.error("Error in textToEmbeddings:", error);
    throw error;
  }
}

/**
 * Splits text into chunks with intelligent sentence boundaries
 * @param {string} text - Text to chunk
 * @param {number} maxSize - Maximum chunk size
 * @param {number} overlap - Overlap between chunks
 * @returns {Array<string>} Array of text chunks
 */
function chunkText(text, maxSize, overlap) {
  console.log(`Starting chunkText with text length: ${text.length}, maxSize: ${maxSize}, overlap: ${overlap}`);
  
  if (!text || text.length === 0) {
    console.warn("Warning: Empty text provided to chunkText");
    return [];
  }
  
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxSize;
    
    if (end < text.length) {
      const searchStart = Math.max(end - 200, start);
      const segment = text.substring(searchStart, end);
      const lastSentenceEnd = Math.max(
        segment.lastIndexOf('. '),
        segment.lastIndexOf('? '),
        segment.lastIndexOf('! ')
      );
      
      if (lastSentenceEnd > -1) {
        end = searchStart + lastSentenceEnd + 1;
        console.log(`Found sentence boundary at position ${end}`);
      } else {
        console.log(`No sentence boundary found, using max chunk size at position ${end}`);
      }
    }
    
    const chunk = text.substring(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
      console.log(`Added chunk ${chunks.length} with length ${chunk.length}`);
    } else {
      console.warn(`Empty chunk detected at position ${start}-${end}, skipping`);
    }
    
    start = end - overlap;
    if (start >= end) start = end;
  }
  
  console.log(`chunkText finished, created ${chunks.length} chunks`);
  return chunks;
}

/**
 * Calculates cosine similarity between two embedding vectors
 * @param {Array<number>} a - First embedding vector
 * @param {Array<number>} b - Second embedding vector
 * @returns {number} Similarity score between 0 and 1
 */
function cosineSimilarity(a, b) {
  if (!a || !b || !Array.isArray(a) || !Array.isArray(b)) {
    console.error(`Error in cosineSimilarity: Invalid input vectors. a length: ${a?.length}, b length: ${b?.length}`);
    return 0;
  }
  
  if (a.length !== b.length) {
    console.error(`Error in cosineSimilarity: Vector dimensions do not match. a length: ${a.length}, b length: ${b.length}`);
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) {
    console.warn("Warning in cosineSimilarity: One or both vectors have zero magnitude");
    return 0;
  }
  
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  console.log(`Calculated similarity: ${similarity.toFixed(4)}`);
  return similarity;
}

/**
 * Finds most relevant knowledge chunks for a given question
 * @param {string} question - Question to search for
 * @param {Array} knowledgeEmbeddings - Knowledge base embeddings
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Ranked array of relevant chunks
 */
async function findRelevantKnowledge(question, knowledgeEmbeddings, options = {}) {
  console.log(`Starting findRelevantKnowledge for question: "${question.substring(0, 50)}..."`);
  
  if (!question || !knowledgeEmbeddings) {
    console.error(`Error in findRelevantKnowledge: Invalid inputs. Question empty: ${!question}, Knowledge embeddings empty: ${!knowledgeEmbeddings || !Array.isArray(knowledgeEmbeddings) || knowledgeEmbeddings.length === 0}`);
    return [];
  }
  
  const {
    topK = 3,
    model = 'text-embedding-3-small',
    openaiClient = openai
  } = options;

  console.log(`Finding relevant knowledge with parameters: topK=${topK}, model=${model}`);
  console.log(`Knowledge base size: ${knowledgeEmbeddings.length} embeddings`);

  try {
    // Get embedding for the question
    console.log("Generating embedding for question...");
    const questionResponse = await openaiClient.embeddings.create({
      model: model,
      input: [question],
    });
    
    if (!questionResponse || !questionResponse.data || questionResponse.data.length === 0) {
      console.error("Error: Empty response from OpenAI embeddings API");
      return [];
    }
    
    console.log("Successfully generated question embedding");
    const questionEmbedding = questionResponse.data[0].embedding;
    
    if (!questionEmbedding || !Array.isArray(questionEmbedding)) {
      console.error(`Error: Invalid question embedding returned. Type: ${typeof questionEmbedding}`);
      return [];
    }
    
    // Calculate similarities and rank
    console.log("Calculating similarities between question and knowledge base...");
    const similarities = knowledgeEmbeddings.map((item, index) => {
      if (!item || !item.embedding || !Array.isArray(item.embedding)) {
        console.error(`Error: Invalid embedding at index ${index}`);
        return { ...item, similarity: 0 };
      }
      
      const similarity = cosineSimilarity(questionEmbedding, item.embedding);
      return {
        ...item,
        similarity
      };
    });
    
    // Sort by similarity (highest first) and return top K
    const sortedResults = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
    
    console.log(`Found ${sortedResults.length} relevant knowledge chunks`);
    sortedResults.forEach((result, idx) => {
      console.log(`Top result ${idx + 1}: similarity=${result.similarity.toFixed(4)}, text="${result.text.substring(0, 50)}..."`);
    });
    
    return sortedResults;
  } catch (error) {
    console.error("Error in findRelevantKnowledge:", error);
    throw error;
  }
}

/**
 * Generates an answer to a question using knowledge base context
 * @param {string} question - Question to answer
 * @param {Array} knowledgeEmbeddings - Knowledge base embeddings
 * @param {Object} options - Answer generation options
 * @returns {Promise<Object>} Answer with sources and context
 */
async function answerQuestion(question, knowledgeEmbeddings, options = {}) {
  console.log(`Starting answerQuestion for question: "${question.substring(0, 50)}..."`);
  
  if (!question) {
    console.error("Error in answerQuestion: Empty question provided");
    return { answer: "[]", relevantChunks: [], context: "" };
  }
  
  if (!knowledgeEmbeddings || !Array.isArray(knowledgeEmbeddings) || knowledgeEmbeddings.length === 0) {
    console.error(`Error in answerQuestion: Invalid knowledge embeddings. Type: ${typeof knowledgeEmbeddings}, Is Array: ${Array.isArray(knowledgeEmbeddings)}, Length: ${knowledgeEmbeddings?.length || 0}`);
    return { answer: "[]", relevantChunks: [], context: "" };
  }
  
  const {
    topK = 3,
    model = 'gpt-4',
    openaiClient = openai
  } = options;

  try {
    // Find relevant knowledge chunks
    console.log("Finding relevant knowledge chunks...");
    const relevantChunks = await findRelevantKnowledge(question, knowledgeEmbeddings, { topK, openaiClient });
    
    if (!relevantChunks || relevantChunks.length === 0) {
      console.warn("Warning: No relevant knowledge chunks found");
      return { answer: '["No relevant information found", "Easy", 1]', relevantChunks: [], context: "" };
    }
    
    // Combine relevant text as context
    const context = relevantChunks
      .map(chunk => chunk.text)
      .join('\n\n');
    
    console.log(`Created context with ${context.length} characters from ${relevantChunks.length} chunks`);
    
    // Generate answer using GPT
    console.log("Sending request to OpenAI for question answering...");
    const systemPrompt = `You are an assistant that receives a user's question and returns an array with exactly three elements in this order:

A tentative answer to the question (as a string).

The difficulty level of the question, strictly one of: "Easy", "Medium", or "Hard".

Marks assigned to the question (as an integer between 1 to 5), based on your judgment of the question's depth, complexity, and required effort—not by fixed rules.

Return the result strictly in this array format in answer found in knowledge base else return "No Answer" :

["Tentative answer", "Difficulty", Marks]

Only use below knowledge base for answering, don't create answer on your own:

Knowledge Base:
${context}

Do not include any explanation, commentary, or formatting outside the array.`;

    console.log(`System prompt length: ${systemPrompt.length} characters`);
    
    const response = await openaiClient.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: question
        }
      ],
      temperature: 0.0,
      max_tokens: 500
    });
    
    if (!response || !response.choices || response.choices.length === 0) {
      console.error("Error: Empty or invalid response from OpenAI");
      return { answer: '["Error getting answer", "Easy", 1]', relevantChunks: [], context: "" };
    }
    
    const answer = response.choices[0].message.content;
    console.log(`Received answer from OpenAI: "${answer}"`);
    
    // Validate the answer format
    try {
      const parsedAnswer = JSON.parse(answer);
      console.log(`Successfully parsed answer JSON. Array length: ${parsedAnswer.length}, Elements: [${parsedAnswer.map((el, i) => `${i}: ${typeof el} (${el})`).join(', ')}]`);
      
      // Verify array structure
      if (!Array.isArray(parsedAnswer) || parsedAnswer.length !== 3) {
        console.error(`Error: Expected array of length 3, got ${Array.isArray(parsedAnswer) ? parsedAnswer.length : typeof parsedAnswer}`);
      }
      
      if (typeof parsedAnswer[0] !== 'string') {
        console.error(`Error: First element should be string, got ${typeof parsedAnswer[0]}`);
      }
      
      if (typeof parsedAnswer[1] !== 'string' || !['Easy', 'Medium', 'Hard'].includes(parsedAnswer[1])) {
        console.error(`Error: Second element should be difficulty string, got ${typeof parsedAnswer[1]} with value "${parsedAnswer[1]}"`);
      }
      
      if (typeof parsedAnswer[2] !== 'number' && !/^\d+$/.test(parsedAnswer[2])) {
        console.error(`Error: Third element should be a number, got ${typeof parsedAnswer[2]} with value "${parsedAnswer[2]}"`);
      }
    } catch (parseError) {
      console.error(`Error parsing answer as JSON: ${parseError.message}`);
      console.error(`Raw answer content: "${answer}"`);
      
      // Try to fix common JSON formatting issues
      const cleanedAnswer = answer.trim()
        .replace(/^```json/, '').replace(/```$/, '') // Remove code blocks
        .replace(/^```/, '').replace(/```$/, '')      // Remove other code blocks
        .trim();
        
      console.log(`Cleaned answer for parsing attempt: "${cleanedAnswer}"`);
      
      try {
        const parsedCleanedAnswer = JSON.parse(cleanedAnswer);
        console.log(`Successfully parsed cleaned answer: ${JSON.stringify(parsedCleanedAnswer)}`);
      } catch (secondParseError) {
        console.error(`Still failed to parse cleaned answer: ${secondParseError.message}`);
      }
    }
    
    return {
      answer: answer,
      relevantChunks: relevantChunks.map(chunk => ({
        text: chunk.text,
        similarity: chunk.similarity
      })),
      context: context
    };
  } catch (error) {
    console.error("Error in answerQuestion:", error);
    return { 
      answer: '["Error processing question", "Easy", 1]',
      relevantChunks: [], 
      context: "" 
    };
  }
}

// Add chapter questions from processed JSON array
router.post("/update-chapter-questions/:chapterId", authenticateAdmin, async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Valid questions array is required" });
    }

    console.log(`Updating chapter ${chapterId} with ${questions.length} questions`);
    
    // Find the chapter
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    // Process the question objects to ensure they have all required fields
    const processedQuestions = questions.map((q, index) => ({
      questionId: q.questionId || `QID-${chapter._id}-${index}-${Date.now()}`,
      Q: q.Q,
      question: q.question,
      question_marks: parseInt(q.question_marks || 1, 10),
      subtopic: q.subtopic || "General",
      "question type": q["question type"] || "multiple-choice",
      tentativeAnswer: q.tentativeAnswer || "",
      difficultyLevel: q.difficultyLevel || "Medium"
    }));

    // Update the chapter's questionPrompt array
    chapter.questionPrompt = processedQuestions;
    
    // Also update the prompt field with the JSON string for compatibility
    chapter.prompt = JSON.stringify(processedQuestions);
    
    // Save the updated chapter
    await chapter.save();
    
    console.log(`Successfully updated chapter ${chapterId} with ${processedQuestions.length} questions`);
    
    res.json({
      success: true,
      message: `Successfully updated chapter with ${processedQuestions.length} questions`,
      questions: processedQuestions
    });
    
  } catch (error) {
    console.error("Error updating chapter questions:", error);
    res.status(500).json({ error: "Failed to update chapter questions", message: error.message });
  }
});

module.exports = { 
  textToEmbeddings, 
  findRelevantKnowledge, 
  answerQuestion 
};
module.exports = router;
