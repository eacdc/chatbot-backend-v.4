const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const Chapter = require("../models/Chapter");
const OpenAI = require("openai");
const jwt = require("jsonwebtoken"); // Make sure to import jwt
const authenticateUser = require("../middleware/authMiddleware");
const authenticateAdmin = require("../middleware/adminAuthMiddleware");

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
            model: "gpt-3.5-turbo",
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
    
    // Add input validation and size limits
    if (rawText.length > 25000) {
      console.warn("Text too large:", rawText.length, "characters");
      return res.status(413).json({ 
        error: "Text is too large to process. Please break it into smaller chunks (max 25000 characters)." 
      });
    }

    // Log processing attempt
    console.log(`Processing text of length: ${rawText.length} characters`);
    
    // Predefined system prompt for processing text
    const systemPrompt = "Below find raw text that i got after converting PDF of a book to text file. I need you to fix the text word by word, sentence by sentence.Do not omit any content. Also try to locate the page number of the book and in your converted text use page number as reference.Go ahead page by page and convert the raw text to what actual text would appear.Do not include any outside knowledge or content. Also do not ignore any word or sentence.If the raw text, contains portions which are in different language retain the same without translating";

    // Construct messages for OpenAI
    const messagesForOpenAI = [
      { role: "system", content: systemPrompt },
      { role: "user", content: rawText }
    ];

    // Add a timeout for the OpenAI request
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI request timed out')), 60000); // 60 seconds timeout
    });
    
    // Send request to OpenAI with timeout
    const openAIPromise = openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: messagesForOpenAI,
    });
    
    // Race the promises
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
        error: "Processing timed out. The text may be too complex. Please try with a smaller text segment." 
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

// Generate QnA through OpenAI
router.post("/generate-qna", authenticateAdmin, async (req, res) => {
    try {
      const { subject, grade, text, specialInstructions } = req.body;
  
      if (!text) {
        return res.status(400).json({ error: "Text content is required" });
      }
  
      // Predefined system prompt for QnA generation
      const systemPrompt = `Prompt for generation of questions: 
You are an intelligent and adaptive tutor designed to help students improve their understanding of a subject. You will receive a chapter or passage from a textbook, and your task is to generate a variety of questions strictly based on the content provided. Your questions should be engaging, diverse in format, and cover different difficulty levels to help students grasp concepts thoroughly.

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
Balance difficulty levels: 30% easy, 30% moderate, 40% challenging.
Make questions engaging by incorporating practical examples or relatable scenarios when possible.
Avoid direct repetition—each question should test a unique aspect of the content.
Ensure clarity and precision in wording.
After each question mention the difficulty level {easy, medium, hard}. This will enable the software to select the right question based on the answer of previous question, create a bank of atleast 30 questions`
      // Construct messages for OpenAI
      const messagesForOpenAI = [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ];
  
      // Get AI response
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messagesForOpenAI,
      });
  
      if (!response || !response.choices || response.choices.length === 0) {
        throw new Error("Invalid response from OpenAI");
      }
  
      const qnaOutput = response.choices[0].message.content;
      res.json({ qnaOutput });
  
    } catch (error) {
      console.error("Error generating QnA:", error);
      res.status(500).json({ error: "Failed to generate QnA", message: error.message });
    }
  });

// Generate final prompt through OpenAI
router.post("/generate-final-prompt", authenticateAdmin, async (req, res) => {
    try {
      const { subject, grade, specialInstructions, qnaOutput } = req.body;
  
      if (!qnaOutput) {
        return res.status(400).json({ error: "QnA content is required" });
      }
  
      // Create a modified system prompt by inserting the values directly
      const finalPrompt = `Question Bank
  
          ${qnaOutput}
  
          End of Question Bank
  
          You are a brilliant and strict yet friendly teacher who focuses on improving students' understanding of the subject. For this session, you are teaching ${subject} for Grade ${grade}.
  
          You have been provided with a set of reference questions from the student's lesson. However, you must rephrase, rewrite, and enhance the questions to make them engaging, interactive, and appropriately challenging. The questions should be asked one at a time, and student responses must be carefully evaluated.
  
          Questioning and Evaluation Approach
          Randomized Questions: Select questions in a non-sequential manner to keep students engaged.
          Adaptive Difficulty:
          If a student answers correctly, gradually increase the difficulty to challenge them.
          If they answer incorrectly, ask a simpler or related question to reinforce the concept.
          Scoring & Feedback:
          Assign a score out of 10 for each response, based on the accuracy, depth, and relevance of the answer.
          Strict scoring: Be fair, but do not over-score incorrect or vague answers.
          If the student scores below 6, ask if they would like to reattempt before moving to the next question.
          If the answer is completely incorrect, explain the concept clearly, referring to the relevant section of the book.
          Subject-Specific Evaluation Standards
          Science, Mathematics, and Accounts:
          Answers must be precise and accurate.
          Partial understanding results in lower scores and additional guidance.
          History, Literature, and Humanities:
          Answers should demonstrate understanding beyond facts, connecting historical events or literary themes to the present.
          Creativity and logical reasoning should be encouraged but factually incorrect answers will be marked low.
          Languages & Creative Writing:
          Evaluate grammar, structure, and expression of ideas.
          Encouragement is key, but scores must reflect clarity, coherence, and correctness.
          Interactive Learning Approach
          Convert questions into multiple-choice, scenario-based, or real-life application questions where possible.
          Never ask repetitive questions. If you do, you will be penalized $1000 per duplicate question!
          Maintain a friendly, engaging, and supportive tone so students feel comfortable.
          This is not an exam or interview! The goal is to help students learn, not intimidate them.
          Final Evaluation
          At the end of the session, provide a final score for the chapter.
          If the overall score is below 6, ask if the student wants to reattempt answering some questions to improve their understanding.
          Special Instructions
          ${specialInstructions || ""}
          Respond only in the language of knowledge (e.g., if the session is in French, stick to French).
          Never answer off-topic questions—politely decline and refocus on the subject.
          Encourage deeper thinking and curiosity while maintaining strict academic integrity.`;
  
      // Return the modified prompt directly without sending to OpenAI
      res.json({ finalPrompt });
  
    } catch (error) {
      console.error("Error generating final prompt:", error);
      res.status(500).json({ error: "Failed to generate final prompt", message: error.message });
    }
  });

module.exports = router;