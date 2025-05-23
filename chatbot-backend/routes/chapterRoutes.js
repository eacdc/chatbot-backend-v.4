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
      const { bookId, title, prompt, rawText, questionPrompt } = req.body;

      // Create a new chapter object with the required fields
      const newChapter = new Chapter({ 
        bookId, 
        title, 
        prompt 
      });

      // Add optional fields if provided
      if (rawText) {
        newChapter.rawText = rawText;
      }

      // Add questionPrompt array if provided
      if (questionPrompt && Array.isArray(questionPrompt)) {
        newChapter.questionPrompt = questionPrompt;
      }

      // Save the chapter
      const savedChapter = await newChapter.save();
      res.status(201).json(savedChapter);
    } catch (error) {
      console.error("Error adding chapter:", error);
      res.status(500).json({ error: "Failed to add chapter", message: error.message });
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

// Enhanced batch processing with embeddings and question analysis
router.post("/enhanced-batch-process", authenticateAdmin, async (req, res) => {
  try {
    const { rawText, bookId, title } = req.body;

    if (!rawText || !bookId || !title) {
      return res.status(400).json({ error: "Raw text, bookId, and title are required" });
    }

    // First process the text normally to get structured content
    const processedResult = await processBatchTextInternal(rawText);
    
    if (!processedResult.success) {
      return res.status(500).json({ 
        error: "Failed to process text", 
        message: processedResult.error || "Unknown error"
      });
    }

    // Generate embeddings for the raw text (for knowledge base)
    let rawTextEmbedding;
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: rawText,
        encoding_format: "float"
      });
      
      rawTextEmbedding = embeddingResponse.data[0].embedding;
      console.log("Successfully generated embeddings for the raw text knowledge base");
    } catch (error) {
      console.error("Error generating raw text embeddings:", error);
      // Continue even if embedding generation fails
    }

    // Extract and process questions
    let enhancedQuestions = [];
    let questionsToProcess = [];

    // Try to extract questions from the processed text
    if (processedResult.isQuestionFormat && processedResult.questionArray) {
      questionsToProcess = processedResult.questionArray;
    } else {
      // Try to extract questions using regex if not already in question format
      const questionMatches = processedResult.combinedPrompt.match(/\{[\s\S]*?"subtopic"[\s\S]*?"question"[\s\S]*?\}/g);
      
      if (questionMatches && questionMatches.length > 0) {
        console.log(`Found ${questionMatches.length} potential question objects`);
        
        for (const match of questionMatches) {
          try {
            const cleanedJson = match.trim().replace(/,\s*$/, '');
            const questionObj = JSON.parse(cleanedJson);
            
            if (questionObj.subtopic && questionObj.question) {
              questionsToProcess.push(questionObj);
            }
          } catch (error) {
            console.error("Error parsing question JSON:", error);
          }
        }
      }
    }

    console.log(`Processing ${questionsToProcess.length} questions for enhanced analysis`);

    // Process each question to add metadata using raw text as knowledge base
    for (let i = 0; i < questionsToProcess.length; i++) {
      const question = questionsToProcess[i];
      
      try {
        console.log(`Analyzing question ${i+1}/${questionsToProcess.length}`);
        
        // Use the raw text as context for question analysis
        const analysisResponse = await openai.chat.completions.create({
          model: "gpt-4-turbo",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: `You are an educational content analyzer. Given a question and the original text content, determine:
              1. The difficulty level (Easy, Medium, Hard)
              2. Appropriate marks for this question (1-10)
              3. A tentative answer based on the content
              
              Use ONLY the provided content to determine the answer. If the answer cannot be derived from the content, say "Cannot determine from provided content."
              Format your response as JSON with properties: difficultyLevel, question_marks, tentativeAnswer`
            },
            {
              role: "user",
              content: `CONTENT:\n${rawText}\n\nQUESTION: ${question.question}`
            }
          ]
        });
        
        const analysisContent = analysisResponse.choices[0].message.content;
        let analysisData;
        
        try {
          // Extract JSON data from the response
          const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysisData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("No JSON found in response");
          }
        } catch (parseError) {
          console.error("Error parsing analysis response:", parseError);
          // Create default analysis data
          analysisData = {
            difficultyLevel: "Medium",
            question_marks: 3,
            tentativeAnswer: "Analysis failed - please review manually."
          };
        }
        
        // Add the analysis data to the question
        enhancedQuestions.push({
          ...question,
          difficultyLevel: analysisData.difficultyLevel || "Medium",
          question_marks: parseInt(analysisData.question_marks || 3, 10),
          tentativeAnswer: analysisData.tentativeAnswer || "",
          questionId: `QID-${Date.now()}-${i}`
        });
        
      } catch (error) {
        console.error(`Error analyzing question ${i+1}:`, error);
        // Add the question with default values
        enhancedQuestions.push({
          ...question,
          difficultyLevel: "Medium",
          question_marks: 3,
          tentativeAnswer: "Analysis failed - please review manually.",
          questionId: `QID-${Date.now()}-${i}`
        });
      }
    }

    // Create the new chapter with both raw text and processed text
    const newChapter = new Chapter({
      bookId,
      title,
      prompt: processedResult.combinedPrompt,
      rawText,
      questionPrompt: enhancedQuestions,
      rawTextEmbedding
    });

    // Save the chapter
    const savedChapter = await newChapter.save();
    
    res.status(201).json({
      success: true,
      message: "Chapter processed and saved successfully",
      chapter: savedChapter,
      enhancedQuestions
    });
    
  } catch (error) {
    console.error("Error in enhanced batch processing:", error);
    res.status(500).json({ 
      error: "Failed to process and save chapter", 
      message: error.message 
    });
  }
});

// Analyze a new question using the chapter's raw text knowledge base
router.post("/analyze-question/:chapterId", async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }
    
    // Find the chapter
    const chapter = await Chapter.findOne({ chapterId });
    
    if (!chapter) {
      return res.status(404).json({ error: "Chapter not found" });
    }
    
    // Ensure the chapter has raw text
    if (!chapter.rawText) {
      return res.status(400).json({ error: "Chapter doesn't have raw text for analysis" });
    }
    
    // Use the raw text as context for question analysis
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You are an educational content analyzer. Given a question and the original text content, determine:
          1. The difficulty level (Easy, Medium, Hard)
          2. Appropriate marks for this question (1-10)
          3. A tentative answer based on the content
          
          Use ONLY the provided content to determine the answer. If the answer cannot be derived from the content, say "Cannot determine from provided content."
          Format your response as JSON with properties: difficultyLevel, question_marks, tentativeAnswer`
        },
        {
          role: "user",
          content: `CONTENT:\n${chapter.rawText}\n\nQUESTION: ${question}`
        }
      ]
    });
    
    const analysisContent = analysisResponse.choices[0].message.content;
    let analysisData;
    
    try {
      // Extract JSON data from the response
      const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Error parsing analysis response:", parseError);
      return res.status(500).json({ 
        error: "Failed to parse analysis response", 
        message: parseError.message 
      });
    }
    
    // Create a new question object with the analysis data
    const analyzedQuestion = {
      question,
      difficultyLevel: analysisData.difficultyLevel || "Medium",
      question_marks: parseInt(analysisData.question_marks || 3, 10),
      tentativeAnswer: analysisData.tentativeAnswer || "",
      questionId: `QID-${chapter._id}-${Date.now()}`
    };
    
    res.json({
      success: true,
      analyzedQuestion
    });
    
  } catch (error) {
    console.error("Error analyzing question:", error);
    res.status(500).json({ 
      error: "Failed to analyze question", 
      message: error.message 
    });
  }
});

// Internal version of processBatchText that returns data instead of sending response
async function processBatchTextInternal(rawText) {
  try {
    console.log(`Processing text with batching. Text length: ${rawText.length} characters`);
    
    // Split text into smaller parts at sentence boundaries
    const textParts = splitTextIntoSentenceParts(rawText, 20);
    console.log(`Split text into ${textParts.length} parts`);
    
    // Fetch the system prompt from the database
    let systemPrompt;
    try {
      const promptDoc = await Prompt.findOne({ prompt_type: "batchProcessing", isActive: true });
      if (promptDoc) {
        systemPrompt = promptDoc.prompt;
        console.log("Successfully loaded Batch Processing prompt from database");
      } else {
        systemPrompt = "";
        console.warn("Warning: Batch Processing system prompt not found in database, using default");
      }
    } catch (error) {
      console.error("Error fetching Batch Processing system prompt:", error);
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
            
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retryCount)));
            
            // Try again with incremented retry count
            return makeOpenAIRequest(retryCount + 1, maxRetries);
          }
        };
        
        const response = await makeOpenAIRequest();

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
    
    // Combine all responses
    const combinedPrompt = Object.values(collatedResponses).join("\n\n");
    
    // Check if the combined text appears to contain JSON formatted questions
    if (combinedPrompt.includes('"Q":') && combinedPrompt.includes('"question":')) {
      try {
        console.log("Detected question format in the batch output");
        
        // Extract JSON objects from the text
        const questionJsonObjects = combinedPrompt.match(/\{[\s\S]*?"Q"[\s\S]*?"question"[\s\S]*?\}/g);
        
        if (questionJsonObjects && questionJsonObjects.length > 0) {
          console.log(`Found ${questionJsonObjects.length} potential question objects in the text`);
          
          // Parse each JSON object
          const structuredQuestions = [];
          
          for (const jsonStr of questionJsonObjects) {
            try {
              // Clean up the JSON string
              const cleanedJson = jsonStr.trim().replace(/,\s*$/, '');
              const questionObj = JSON.parse(cleanedJson);
              
              // Validate the required fields
              if (questionObj.Q !== undefined && questionObj.question) {
                // Add default values for missing fields
                structuredQuestions.push({
                  Q: questionObj.Q,
                  question: questionObj.question,
                  question_marks: questionObj.question_marks || 1,
                  subtopic: questionObj.subtopic || "General",
                  tentativeAnswer: questionObj.tentativeAnswer || "",
                  difficultyLevel: questionObj.difficultyLevel || "Medium"
                });
              }
            } catch (parseError) {
              console.error(`Error parsing question JSON:`, parseError.message);
            }
          }
          
          if (structuredQuestions.length > 0) {
            console.log(`Successfully structured ${structuredQuestions.length} questions`);
            
            return {
              success: true,
              message: `Text processed and structured into ${structuredQuestions.length} questions`,
              combinedPrompt: JSON.stringify(structuredQuestions),
              isQuestionFormat: true,
              questionArray: structuredQuestions,
              totalQuestions: structuredQuestions.length
            };
          }
        }
      } catch (formatError) {
        console.error("Error attempting to format as questions:", formatError);
      }
    }
    
    // Standard response format - only reaches here if question formatting fails
    return {
      success: true,
      message: "Text processed successfully",
      combinedPrompt: combinedPrompt,
      isQuestionFormat: false
    };
    
  } catch (error) {
    console.error("Error in batch processing:", error);
    return {
      success: false,
      error: error.message || "Unknown error"
    };
  }
}

// Process raw text through OpenAI with text splitting (batched processing)
router.post("/process-text-batch", authenticateAdmin, async (req, res) => {
  return await processBatchText(req, res);
});

// Shared batch text processing function
async function processBatchText(req, res) {
  try {
    const { rawText } = req.body;

    if (!rawText) {
      return res.status(400).json({ error: "Raw text is required" });
    }
    
    // Log processing attempt
    console.log(`Processing text with batching. Text length: ${rawText.length} characters`);
    
    // Split text into smaller parts (min 20 parts with min 1000 words each) at sentence boundaries
    const textParts = splitTextIntoSentenceParts(rawText, 20);
    console.log(`Split text into ${textParts.length} parts`);
    
    // Fetch the system prompt from the database
    let systemPrompt;
    try {
      const promptDoc = await Prompt.findOne({ prompt_type: "batchProcessing", isActive: true });
      if (promptDoc) {
        systemPrompt = promptDoc.prompt;
        console.log("Successfully loaded Batch Processing prompt from database");
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
      
      // Check if the combined text appears to contain JSON formatted questions
      if (combinedPrompt.includes('"Q":') && combinedPrompt.includes('"question":')) {
        try {
          console.log("Detected question format in the batch output - attempting to structure as question array");
          
          // Extract JSON objects from the text
          const questionJsonObjects = combinedPrompt.match(/\{[\s\S]*?"Q"[\s\S]*?"question"[\s\S]*?\}/g);
          
          if (questionJsonObjects && questionJsonObjects.length > 0) {
            console.log(`Found ${questionJsonObjects.length} potential question objects in the text`);
            
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
                    totalQuestions: structuredQuestions.length
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
                
                // Validate the required fields
                if (questionObj.Q !== undefined && questionObj.question) {
                  // Track this validation
                  pendingValidations++;
                  
                  // Run the validation asynchronously
                  (async () => {
                    try {
                      // Check if the question should be kept
                      const validationResult = await validateQuestionWithOpenAI(questionObj.question);
                      if (validationResult === "keep") {
                        // Add default values for missing fields
                        structuredQuestions.push({
                          Q: questionObj.Q,
                          question: questionObj.question,
                          question_marks: questionObj.question_marks || 1,
                          subtopic: questionObj.subtopic || "General",
                          tentativeAnswer: questionObj.tentativeAnswer || "",
                          difficultyLevel: questionObj.difficultyLevel || "Medium"
                        });
                        successCount++;
                      } else {
                        console.log(`Skipping question at index ${index} based on validation`);
                        errorCount++;
                      }
                    } catch (error) {
                      console.error(`Error validating question at index ${index}:`, error);
                      // Default to keeping the question if validation fails
                      structuredQuestions.push({
                        Q: questionObj.Q,
                        question: questionObj.question,
                        question_marks: questionObj.question_marks || 1,
                        subtopic: questionObj.subtopic || "General",
                        tentativeAnswer: questionObj.tentativeAnswer || "",
                        difficultyLevel: questionObj.difficultyLevel || "Medium"
                      });
                      successCount++;
                    } finally {
                      // Mark this validation as complete
                      pendingValidations--;
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
      }
      
      // Standard response format - only reaches here if we didn't return from question processing
      return res.json({ 
        success: true, 
        message: "Text processed successfully",
        combinedPrompt: combinedPrompt,
        processedText: combinedPrompt // Include for backward compatibility
      });
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

// Semantic search for chapters using embeddings
router.post("/semantic-search", authenticateUser, async (req, res) => {
  try {
    const { query, limit = 5, bookId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }
    
    // Find chapters with embeddings, optionally filtered by bookId
    const queryOptions = { embedding: { $ne: null } };
    if (bookId) {
      queryOptions.bookId = bookId;
    }
    
    // Get total count of chapters with embeddings
    const chaptersWithEmbeddingsCount = await Chapter.countDocuments(queryOptions);
    
    if (chaptersWithEmbeddingsCount === 0) {
      return res.status(404).json({ 
        message: "No chapters with embeddings found. Please process chapters first." 
      });
    }
    
    // Use the model's findSimilar method to get semantically similar chapters
    const similarChapters = await Chapter.findSimilar(query, limit);
    
    // Format response to include relevant fields
    const results = similarChapters.map(chapter => ({
      chapterId: chapter.chapterId,
      title: chapter.title,
      bookId: chapter.bookId,
      createdAt: chapter.createdAt,
      questionCount: Array.isArray(chapter.questionPrompt) ? chapter.questionPrompt.length : 0
    }));
    
    res.json({
      success: true,
      message: `Found ${results.length} similar chapters`,
      results,
      total: chaptersWithEmbeddingsCount
    });
    
  } catch (error) {
    console.error("Error in semantic search:", error);
    res.status(500).json({ 
      error: "Failed to perform semantic search", 
      message: error.message 
    });
  }
});

// Generate embeddings for existing chapters that don't have them yet
router.post("/generate-embeddings", authenticateAdmin, async (req, res) => {
  try {
    const { bookId } = req.body;
    
    // Find chapters without embeddings, optionally filtered by bookId
    const queryOptions = { embedding: null };
    if (bookId) {
      queryOptions.bookId = bookId;
    }
    
    const chapters = await Chapter.find(queryOptions);
    
    if (chapters.length === 0) {
      return res.json({
        message: "No chapters found that need embeddings",
        processed: 0
      });
    }
    
    console.log(`Found ${chapters.length} chapters that need embeddings`);
    
    let processed = 0;
    let errors = 0;
    
    // Process each chapter to generate embeddings
    for (const chapter of chapters) {
      try {
        await chapter.generateEmbedding();
        await chapter.save();
        processed++;
        console.log(`Generated embedding for chapter: ${chapter.title} (${processed}/${chapters.length})`);
      } catch (error) {
        console.error(`Error generating embedding for chapter ${chapter.chapterId}:`, error);
        errors++;
      }
    }
    
    res.json({
      success: true,
      message: `Generated embeddings for ${processed} chapters with ${errors} errors`,
      processed,
      errors,
      total: chapters.length
    });
    
  } catch (error) {
    console.error("Error generating embeddings:", error);
    res.status(500).json({
      error: "Failed to generate embeddings",
      message: error.message
    });
  }
});

// Generate QnA from raw text
router.post("/generate-qna", authenticateAdmin, async (req, res) => {
  try {
    const { rawText, bookId, title, subject } = req.body;

    if (!rawText || !bookId || !title) {
      return res.status(400).json({ error: "Raw text, bookId, and title are required" });
    }

    // Check if text is extremely large and truncate if necessary
    const MAX_TEXT_LENGTH = 100000; // ~100KB limit for raw text
    let processedText = rawText;
    let wasTextTruncated = false;
    
    if (rawText.length > MAX_TEXT_LENGTH) {
      console.log(`Text is too large (${rawText.length} chars). Truncating to ${MAX_TEXT_LENGTH} chars.`);
      processedText = rawText.substring(0, MAX_TEXT_LENGTH);
      wasTextTruncated = true;
    }

    // 1. Split raw text into chunks for embedding-based retrieval
    const textChunks = splitTextIntoChunks(processedText, 800, 150); // Smaller chunks (800 chars with 150 char overlap)
    console.log(`Split text into ${textChunks.length} chunks for embedding-based retrieval`);
    
    // 2. Generate embeddings for each chunk
    const chunkEmbeddings = [];
    for (let i = 0; i < textChunks.length; i++) {
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: textChunks[i],
          encoding_format: "float"
        });
        
        chunkEmbeddings.push({
          text: textChunks[i],
          embedding: embeddingResponse.data[0].embedding
        });
        console.log(`Generated embedding for chunk ${i+1}/${textChunks.length}`);
      } catch (error) {
        console.error(`Error generating embedding for chunk ${i+1}:`, error);
      }
      
      // Add a small delay between embedding requests to prevent rate limiting
      if (i < textChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // 3. Fetch the batch processing system prompt from the database
    let systemPrompt;
    try {
      const promptDoc = await Prompt.findOne({ prompt_type: "batchProcessing", isActive: true });
      if (promptDoc) {
        systemPrompt = promptDoc.prompt;
        console.log("Successfully loaded Batch Processing prompt from database");
      } else {
        systemPrompt = `You are an expert in creating educational questions from content.
For the provided text, extract and create questions and organize them by subtopics.
Format each question in a JSON structure as follows:
{
  "subtopic": "The subtopic name",
  "question": "The complete question text"
}

Each question should be self-contained and not reference external figures or diagrams.
Provide one question per JSON object and ensure they cover different concepts.`;
        console.warn("Warning: Batch Processing system prompt not found in database, using default");
      }
    } catch (error) {
      console.error("Error fetching Batch Processing system prompt:", error);
      systemPrompt = `You are an expert in creating educational questions from content.
For the provided text, extract and create questions and organize them by subtopics.
Format each question in a JSON structure as follows:
{
  "subtopic": "The subtopic name",
  "question": "The complete question text"
}

Each question should be self-contained and not reference external figures or diagrams.
Provide one question per JSON object and ensure they cover different concepts.`;
    }

    // 4. Send text to LLM with batch processing prompt to get questions
    // If text was truncated, add a note to the prompt
    let promptText = processedText;
    if (wasTextTruncated) {
      promptText = `${processedText}\n\n[Note: This text was truncated from a larger document. Please generate questions based on the available content.]`;
    }
    
    const questionsResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      temperature: 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: promptText }
      ]
    });

    if (!questionsResponse.choices || questionsResponse.choices.length === 0) {
      return res.status(500).json({ error: "Failed to generate questions from content" });
    }

    // 5. Extract questions from the response
    const questionsText = questionsResponse.choices[0].message.content;
    console.log("Raw questions response:", questionsText);

    // Extract JSON objects from the text using regex
    const questionObjects = [];
    const jsonRegex = /\{[\s\S]*?"subtopic"[\s\S]*?"question"[\s\S]*?\}/g;
    const matches = questionsText.match(jsonRegex);

    if (!matches || matches.length === 0) {
      return res.status(500).json({ 
        error: "Failed to extract question objects from the response",
        rawResponse: questionsText
      });
    }

    console.log(`Found ${matches.length} potential question objects`);

    // 6. Process each question to analyze it using vector embeddings
    const analyzedQuestions = [];
    
    // Limit the number of questions to analyze to prevent memory issues
    const MAX_QUESTIONS_TO_ANALYZE = 15;
    const questionsToProcess = matches.slice(0, MAX_QUESTIONS_TO_ANALYZE);
    
    if (matches.length > MAX_QUESTIONS_TO_ANALYZE) {
      console.log(`Limiting analysis to first ${MAX_QUESTIONS_TO_ANALYZE} questions to prevent memory issues`);
    }

    for (let i = 0; i < questionsToProcess.length; i++) {
      try {
        // Parse the question object
        const cleanedJson = questionsToProcess[i].trim().replace(/,\s*$/, '');
        const questionObj = JSON.parse(cleanedJson);
        
        if (!questionObj.subtopic || !questionObj.question) {
          console.error(`Invalid question object at index ${i}`);
          continue;
        }

        console.log(`Analyzing question ${i+1}/${questionsToProcess.length}: ${questionObj.question.substring(0, 50)}...`);
        
        // Generate embedding for the question
        const questionEmbeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: questionObj.question,
          encoding_format: "float"
        });
        
        const questionEmbedding = questionEmbeddingResponse.data[0].embedding;
        
        // Find the most relevant chunks using cosine similarity
        const relevantChunks = chunkEmbeddings
          .map(chunk => ({
            text: chunk.text,
            similarity: cosineSimilarity(questionEmbedding, chunk.embedding)
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 3) // Get top 3 most relevant chunks
          .map(chunk => chunk.text)
          .join("\n\n");
        
        console.log(`Retrieved ${relevantChunks.length > 0 ? '3' : '0'} most relevant text chunks for question ${i+1}`);
        
        // 7. Use the relevant chunks for question analysis
        const analysisResponse = await openai.chat.completions.create({
          model: "gpt-4-turbo",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: `You are an educational content analyzer. Given a question and relevant content, determine:
              1. The difficulty level (Easy, Medium, Hard)
              2. Appropriate marks for this question (1-10)
              3. A tentative answer based on the content
              
              Use ONLY the provided content to determine the answer. If the answer cannot be derived from the provided content, say "Cannot determine from provided content."
              Format your response as JSON with properties: difficultyLevel, question_marks, tentativeAnswer`
            },
            {
              role: "user",
              content: `CONTENT:\n${relevantChunks}\n\nQUESTION: ${questionObj.question}`
            }
          ]
        });
        
        const analysisContent = analysisResponse.choices[0].message.content;
        let analysisData;
        
        try {
          // Extract JSON data from the response
          const jsonMatch = analysisContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysisData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("No JSON found in response");
          }
        } catch (parseError) {
          console.error(`Error parsing analysis response for question ${i+1}:`, parseError);
          // Create default analysis data
          analysisData = {
            difficultyLevel: "Medium",
            question_marks: 3,
            tentativeAnswer: "Analysis failed - please review manually."
          };
        }
        
        // Add the question with analysis data to the results
        analyzedQuestions.push({
          subtopic: questionObj.subtopic,
          question: questionObj.question,
          difficultyLevel: analysisData.difficultyLevel || "Medium",
          question_marks: parseInt(analysisData.question_marks || 3, 10),
          tentativeAnswer: analysisData.tentativeAnswer || "",
          questionId: `QID-${Date.now()}-${i}`
        });
        
        // Add a small delay between question analyses to prevent rate limiting
        if (i < questionsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`Error processing question ${i+1}:`, error);
      }
    }

    // 8. Return the analyzed questions to the frontend
    res.json({
      success: true,
      message: `Successfully generated and analyzed ${analyzedQuestions.length} questions using vector embeddings`,
      analyzedQuestions,
      wasTextTruncated
    });
    
    // 9. Optionally save the chapter if requested
    if (req.body.saveChapter === true) {
      try {
        // Create a new chapter with the analyzed questions
        const newChapter = new Chapter({
          bookId,
          title,
          prompt: JSON.stringify(analyzedQuestions),
          rawText: processedText, // Save the potentially truncated text
          questionPrompt: analyzedQuestions
        });

        // Save the chapter
        await newChapter.save();
        
        console.log(`Chapter "${title}" saved with ${analyzedQuestions.length} analyzed questions`);
      } catch (saveError) {
        console.error("Error saving chapter during generate-qna:", saveError);
        // Don't fail the request if chapter save fails, we've already returned success response
      }
    }
    
  } catch (error) {
    console.error("Error in generate-qna:", error);
    res.status(500).json({ 
      error: "Failed to generate and analyze questions", 
      message: error.message 
    });
  }
});

// Helper function to split text into chunks for embedding
function splitTextIntoChunks(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let currentPos = 0;
  
  while (currentPos < text.length) {
    let chunkEnd = Math.min(currentPos + chunkSize, text.length);
    
    // Try to find a natural break point (period followed by space)
    if (chunkEnd < text.length) {
      const nextPeriod = text.indexOf('. ', chunkEnd - overlap);
      if (nextPeriod !== -1 && nextPeriod < chunkEnd + overlap) {
        chunkEnd = nextPeriod + 2; // +2 to include the period and space
      }
    }
    
    chunks.push(text.substring(currentPos, chunkEnd));
    
    // Move position forward, accounting for overlap
    currentPos = chunkEnd - overlap;
    
    // Make sure we're making progress
    if (currentPos <= 0 || currentPos >= text.length) {
      break;
    }
  }
  
  return chunks;
}

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  return dotProduct / (magnitudeA * magnitudeB);
}

module.exports = router;
