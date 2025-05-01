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
            model: "gpt-4o",
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

// Process raw text through OpenAI
router.post("/process-text", authenticateAdmin, async (req, res) => {
  try {
    const { rawText } = req.body;

    if (!rawText) {
      return res.status(400).json({ error: "Raw text is required" });
    }
    
    // Log processing attempt
    console.log(`Processing text of length: ${rawText.length} characters`);
    
    // Fetch the goodText system prompt from the database
    let systemPrompt;
    try {
      const promptDoc = await Prompt.findOne({ prompt_type: "goodText", isActive: true });
      if (promptDoc) {
        systemPrompt = promptDoc.prompt;
        console.log("Successfully loaded Good Text prompt from database");
      } else {
        // Fallback to default prompt if not found in DB
        systemPrompt = "Below find raw text that I got after converting a PDF of a book to a text file. I need you to fix the text word by word, sentence by sentence. Do not omit any content. \n\nImportant instructions:\n1. Look for and properly format page numbers in the text\n2. Fix any special characters or escape sequences (like \\t, \\n, \\x07, etc.) that appear in the raw text\n3. Maintain proper paragraph structure and formatting\n4. Preserve all content including figure references (Fig. X.X) and mathematical symbols\n5. If text contains different languages, retain them without translation\n6. Handle any control characters or strange formatting artifacts from the PDF conversion\n\nGo ahead page by page and convert the raw text to what the actual text would appear like in the original book. Do not add any outside knowledge or content.";
        console.warn("Warning: Good Text system prompt not found in database, using default");
      }
    } catch (error) {
      console.error("Error fetching Good Text system prompt:", error);
      // Fallback to default prompt
      systemPrompt = "Below find raw text that I got after converting a PDF of a book to a text file. I need you to fix the text word by word, sentence by sentence. Do not omit any content.";
    }

    // Construct messages for OpenAI
    const messagesForOpenAI = [
      { role: "system", content: systemPrompt },
      { role: "user", content: rawText }
    ];

    // Add a timeout for the OpenAI request
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI request timed out')), 600000); // 10 minutes timeout for large texts
    });
    
    // Function to make OpenAI request with retry logic
    const makeOpenAIRequest = async (retryCount = 0, maxRetries = 2) => {
      try {
        console.log(`OpenAI request attempt ${retryCount + 1}/${maxRetries + 1}`);
        
        // Send request to OpenAI
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
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
      console.error("Invalid or empty response from OpenAI");
      throw new Error("Invalid response from OpenAI");
    }

    const processedText = response.choices[0].message.content;
    console.log("Text processed successfully. Result length:", processedText.length);
    res.json({ processedText });

  } catch (error) {
    console.error("Error processing text:", error);
    
    // Add specific error messages based on the error type
    if (error.message === 'OpenAI request timed out') {
      return res.status(504).json({ 
        error: "Processing timed out. The text may be too complex. Please try with a smaller text segment or try again later." 
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
});

// Process raw text through OpenAI with text splitting (batched processing)
router.post("/process-text-batch", authenticateAdmin, async (req, res) => {
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
        systemPrompt = "You are a helpful assistant helping to understand and process educational content. Provide a comprehensive and detailed response to the text I will share with you. Focus on explaining the key concepts, identifying important information, and organizing the content in a structured way.";
        console.warn("Warning: Batch Processing system prompt not found in database, using default");
      }
    } catch (error) {
      console.error("Error fetching Batch Processing system prompt:", error);
      // Fallback to default prompt
      systemPrompt = "You are a helpful assistant helping to understand and process educational content. Provide a comprehensive and detailed response to the text I will share with you.";
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
              model: "gpt-4o",
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
            
            questionJsonObjects.forEach((jsonStr, index) => {
              try {
                // Clean up the JSON string - ensure it's properly formatted
                const cleanedJson = jsonStr.trim().replace(/,\s*$/, '');
                const questionObj = JSON.parse(cleanedJson);
                
                // Validate the required fields
                if (questionObj.Q !== undefined && questionObj.question) {
                  // Add default values for missing fields
                  structuredQuestions.push({
                    Q: questionObj.Q,
                    question: questionObj.question,
                    question_answered: questionObj.question_answered || false,
                    question_marks: questionObj.question_marks || 1,
                    marks_gained: questionObj.marks_gained || 0
                  });
                  successCount++;
                } else {
                  console.log(`Question object at index ${index} is missing required fields`);
                  errorCount++;
                }
              } catch (parseError) {
                console.error(`Error parsing question JSON at index ${index}:`, parseError.message);
                errorCount++;
              }
            });
            
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
            }
          }
        } catch (formatError) {
          console.error("Error attempting to format as questions:", formatError);
          // Continue with normal processing if question formatting fails
        }
      }
      
      // Standard response if not detected as question format
      res.json({ 
        success: true, 
        message: "Text processed successfully",
        combinedPrompt: combinedPrompt
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
});

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

// Generate QnA through OpenAI
router.post("/generate-qna", authenticateAdmin, async (req, res) => {
  try {
    const { text, bookId, subject, specialInstructions } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text content is required" });
    }

    if (!bookId) {
      return res.status(400).json({ error: "Book ID is required" });
    }

    // Get book details to find the grade
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }

    const grade = book.grade;

    console.log("Generating QnA with text length:", text.length, "for grade:", grade);

    // Fetch the QnA system prompt from the database
    let systemPrompt;
    try {
      const promptDoc = await Prompt.findOne({ prompt_type: "qna", isActive: true });
      if (promptDoc) {
        // Replace placeholders in the prompt
        systemPrompt = promptDoc.prompt
          .replace(/{grade}/g, grade)
          .replace(/{subject}/g, subject || "");
        console.log("Successfully loaded QnA prompt from database");
      } else {
        // Fallback to default prompt if not found in DB
        console.warn("Warning: QnA system prompt not found in database, using default");
        systemPrompt = `You are an intelligent and adaptive tutor designed to help students improve their understanding of a subject. 
        You will receive a chapter from a textbook, and your task is to generate a variety of questions strictly based on the content provided. 
        Your questions should be engaging, diverse in format, and cover different difficulty levels to help students grasp concepts thoroughly.
        
        You are generating questions for Grade ${grade} students studying ${subject}.

Question Types & Criteria:
Basic Recall Questions – Directly test the student's memory by asking factual questions from the text.
Example: "What is the definition of [concept]?"
Multiple-Choice Questions (MCQs) – Convert key concepts into MCQs with one correct answer and three plausible distractors.
Example: "Which of the following statements about [topic] is true?"
Conceptual Understanding Questions – Encourage students to think deeper by rewording information in a way that tests their comprehension.
Example: "Why does [concept] occur in this process?"
Application-Based Questions – Connect concepts to real-world scenarios to make learning more engaging.
Example: "How would you apply [concept] in [real-life situation]?"
Critical Thinking & Analytical Questions – Challenge students to evaluate, compare, or infer conclusions based on the text.
Example: "If [scenario] changes, what would happen to [concept]?"
Fill-in-the-Blanks & Match-the-Following – Engage students in active recall exercises.
Example: "The process of [blank] is essential for [blank]."
Short Answer & Long-Form Questions – Test the ability to express understanding in their own words.
Example: "Explain the importance of [concept] in your own words."
Guidelines:
Ensure that all questions strictly come from the provided text. Do not add any external information.
If the chapter already contains questions as exercises for students, you can use the same as well.
Balance difficulty levels: 30% easy, 30% moderate, 40% challenging.
Create a databank of atleast 30 questions.
Make questions engaging by incorporating practical examples or relatable scenarios when possible.
Avoid direct repetition—each question should test a unique aspect of the content.
Ensure clarity and precision in wording.
After each question mention the difficulty level {easy, medium, hard}. This will enable the software to select the right question based on the answer of previous question.`;
      }
      
      // Add special instructions if provided
      if (specialInstructions) {
        systemPrompt += `\n\n${specialInstructions}`;
      }
    } catch (error) {
      console.error("Error fetching QnA system prompt:", error);
      // Fallback to default prompt
      systemPrompt = `Generate questions and answers for Grade ${grade} students studying ${subject}.`;
    }

    // Construct messages for OpenAI
    const messagesForOpenAI = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Please generate questions based on the following text:\n\n${text}` }
    ];

    // Add a timeout for the OpenAI request
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI request timed out')), 600000); // 10 minutes timeout
    });
    
    // Function to make OpenAI request with retry logic
    const makeOpenAIRequest = async (retryCount = 0, maxRetries = 2) => {
      try {
        console.log(`QnA generation attempt ${retryCount + 1}/${maxRetries + 1}`);
        
        // Send request to OpenAI
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
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
    
    // Race the promises
    const openAIPromise = makeOpenAIRequest();
    const response = await Promise.race([openAIPromise, timeoutPromise]);

    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error("Invalid response from OpenAI");
    }

    const qnaOutput = response.choices[0].message.content;
    res.json({ qnaOutput });

  } catch (error) {
    console.error("Error generating QnA:", error);
    
    // Add specific error messages based on the error type
    if (error.message === 'OpenAI request timed out') {
      return res.status(504).json({ 
        error: "Processing timed out. The text may be too complex. Please try again later." 
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
      error: "Failed to generate QnA", 
      message: error.message || "Unknown error" 
    });
  }
});

// Generate final prompt through OpenAI
router.post("/generate-final-prompt", authenticateAdmin, async (req, res) => {
  try {
    const { subject, grade, bookId, specialInstructions, qnaOutput, chapterTitle } = req.body;

    if (!qnaOutput) {
      return res.status(400).json({ error: "QnA content is required" });
    }

    if (!chapterTitle) {
      return res.status(400).json({ error: "Chapter title is required" });
    }

    let finalGrade = grade;

    // If bookId is provided but grade is not, fetch the grade from the book
    if (bookId && !grade) {
      const book = await Book.findById(bookId);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      finalGrade = book.grade;
    }

    if (!finalGrade) {
      return res.status(400).json({ error: "Grade is required either directly or through bookId" });
    }

    // Fetch the finalPrompt system prompt from the database
    let finalPrompt;
    try {
      const promptDoc = await Prompt.findOne({ prompt_type: "finalPrompt", isActive: true });
      if (promptDoc) {
        // Replace placeholders in the prompt
        finalPrompt = promptDoc.prompt
          .replace(/\${qnaOutput}/g, qnaOutput)
          .replace(/{subject}/g, subject || "")
          .replace(/{finalGrade}/g, finalGrade)
          .replace(/{chapterTitle}/g, chapterTitle);
          
        console.log("Successfully loaded Final Prompt from database");
        
        // Add special instructions if provided
        if (specialInstructions) {
          finalPrompt += `\n\n${specialInstructions}`;
        }
      } else {
        // Fallback to default prompt if not found in DB
        console.warn("Warning: Final Prompt system prompt not found in database, using default");
        finalPrompt = `Question Bank\n\n${qnaOutput}\n\nEnd of Question Bank\n\nYou are a teacher focusing on ${subject} for Grade ${finalGrade}. The chapter is ${chapterTitle}.`;
      }
    } catch (error) {
      console.error("Error fetching Final Prompt system prompt:", error);
      // Fallback to default prompt
      finalPrompt = `${qnaOutput}\n\nTeach ${subject} for Grade ${finalGrade}. Chapter: ${chapterTitle}.`;
    }

    // Return the final prompt directly
    res.json({ finalPrompt });

  } catch (error) {
    console.error("Error generating final prompt:", error);
    res.status(500).json({ error: "Failed to generate final prompt", message: error.message });
  }
});

module.exports = router;
