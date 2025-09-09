const mongoose = require("mongoose");
const OpenAI = require("openai");

const questionSchema = new mongoose.Schema({
  questionId: { type: String, unique: true }, // Unique ID for each question
  Q: { type: Number, required: true },
  question: { type: String, required: true },
  question_marks: { type: Number, default: 1 },
  subtopic: { type: String, default: "General" },
  question_type: { type: String, default: "multiple-choice" },
  tentativeAnswer: { type: String, default: "" },
  difficultyLevel: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" }
});

const chapterSchema = new mongoose.Schema(
  {
    chapterId: { type: String, unique: true }, // Auto-generated
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true }, // Reference to Book
    title: { type: String, required: true },
    prompt: { type: String, required: true }, // Original raw text or JSON questions
    cleanedContent: { type: String, default: null }, // Clean, organized text content (for display only)
    embedding: { type: [Number], default: null }, // Embedding vector for semantic search
    vectorStoreId: { type: String, default: null }, // OpenAI vector store ID for knowledge base
    questionPrompt: {
      type: Array,
      default: [],
      validate: {
        validator: function(questions) {
          if (!Array.isArray(questions)) return true; // Skip validation if not an array
          
          // Validate each question has the required structure
          return questions.every(q => 
            q && 
            typeof q === 'object' && 
            q.Q !== undefined && 
            typeof q.question === 'string'
          );
        },
        message: "Each question must have at least Q (number) and question (string) properties"
      }
    }
  },
  { timestamps: true }
);

// Try to use native fetch first (Node.js 18+), fallback to node-fetch
let fetchImplementation;
try {
  // Check if native fetch is available (Node.js 18+)
  if (typeof globalThis.fetch !== 'undefined') {
    fetchImplementation = globalThis.fetch;
    console.log("Using native Node.js fetch for OpenAI client");
  } else {
    // Fallback to node-fetch for older Node.js versions
    fetchImplementation = require('node-fetch');
    console.log("Using node-fetch for OpenAI client (native fetch not available)");
  }
} catch (error) {
  console.warn("Error setting up fetch implementation:", error.message);
  fetchImplementation = undefined; // Let OpenAI use its default
}

// Initialize OpenAI client - use environment variable if available
let openai;
try {
  if (process.env.OPENAI_API_KEY) {
    const clientConfig = { 
      apiKey: process.env.OPENAI_API_KEY
    };
    
    // Only add fetch if we have a compatible implementation
    if (fetchImplementation && typeof globalThis.fetch !== 'undefined') {
      // Use native fetch which supports FormData properly
      clientConfig.fetch = fetchImplementation;
    }
    // If using node-fetch or no fetch specified, let OpenAI use its default
    
    openai = new OpenAI(clientConfig);
    console.log("OpenAI client initialized successfully in Chapter.js");
  } else {
    console.warn("OPENAI_API_KEY not found in environment variables. OpenAI features will be disabled.");
    // Create a mock OpenAI client to prevent errors
    openai = {
      embeddings: {
        create: async () => ({ data: [{ embedding: Array(1536).fill(0) }] })
      },
      vectorStores: {
        create: async () => ({ id: 'mock-vector-store', name: 'mock', status: 'completed' }),
        files: {
          uploadAndPoll: async () => ({ id: 'mock-file', status: 'completed' })
        }
      },
      chat: {
        completions: {
          create: async () => ({ choices: [{ message: { content: "Mock cleaned content" } }] })
        }
      }
    };
  }
} catch (error) {
  console.error("Error initializing OpenAI client in Chapter.js:", error);
  // Create a mock OpenAI client to prevent errors
  openai = {
    embeddings: {
      create: async () => ({ data: [{ embedding: Array(1536).fill(0) }] })
    },
    vectorStores: {
      create: async () => ({ id: 'mock-vector-store', name: 'mock', status: 'completed' }),
      files: {
        uploadAndPoll: async () => ({ id: 'mock-file', status: 'completed' })
      }
    },
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content: "Mock cleaned content" } }] })
      }
    }
  };
}

// Method to clean and organize raw text using OpenAI
chapterSchema.methods.generateCleanedContent = async function(rawText) {
  try {
    console.log(`Generating cleaned content for chapter: ${this.title}`);
    
    const cleaningPrompt = `You are an expert text editor and content organizer. Your task is to clean, organize, and improve the given raw text while keeping it compact and well-structured.

Instructions:
1. Clean up the text by fixing grammar, punctuation, and spelling errors
2. Organize sentences and paragraphs logically
3. Remove redundant or repetitive content
4. Keep the content compact but comprehensive
5. Maintain all important information and concepts
6. Use proper paragraph breaks for better readability
7. Ensure smooth flow between sentences and ideas
8. Remove any formatting artifacts or OCR errors
9. Make the text suitable for educational purposes

Raw text to clean:
${rawText}

Please provide only the cleaned and organized text content without any additional commentary or explanations.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: "You are an expert text editor. Clean and organize the provided text while keeping it compact and well-structured. Return only the cleaned text."
        },
        {
          role: "user",
          content: cleaningPrompt
        }
      ],
      temperature: 0.3, // Low temperature for consistent, focused output
      max_tokens: 4000 // Reasonable limit for cleaned content
    });

    if (response && response.choices && response.choices[0]) {
      const cleanedText = response.choices[0].message.content.trim();
      console.log(`Generated cleaned content (${cleanedText.length} characters) for chapter: ${this.title}`);
      return cleanedText;
    } else {
      throw new Error("Invalid response from OpenAI for text cleaning");
    }
  } catch (error) {
    console.error("Error generating cleaned content:", error);
    // Return the original raw text as fallback
    return rawText;
  }
};

// Method to generate embedding for a chapter
chapterSchema.methods.generateEmbedding = async function() {
  try {
    // ALWAYS use the original prompt for embedding (not cleaned content)
    // This ensures consistency with vector store content
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small", // Most efficient embedding model
      input: this.prompt,
      encoding_format: "float"
    });
    
    if (response && response.data && response.data[0]) {
      this.embedding = response.data[0].embedding;
      console.log(`Generated embedding for chapter ${this.chapterId || this.title}`);
      return this.embedding;
    } else {
      throw new Error("Invalid response from OpenAI embeddings API");
    }
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
};

// Static method to find similar chapters using embeddings
chapterSchema.statics.findSimilar = async function(query, limit = 5) {
  try {
    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float"
    });
    
    if (!embeddingResponse || !embeddingResponse.data || !embeddingResponse.data[0]) {
      throw new Error("Failed to generate embedding for query");
    }
    
    const queryEmbedding = embeddingResponse.data[0].embedding;
    
    // Find chapters with embeddings
    const chapters = await this.find({ embedding: { $ne: null } });
    
    if (chapters.length === 0) {
      return [];
    }
    
    // Calculate cosine similarity for each chapter
    const withSimilarity = chapters.map(chapter => ({
      chapter,
      similarity: cosineSimilarity(queryEmbedding, chapter.embedding)
    }));
    
    // Sort by similarity (descending) and take top results
    return withSimilarity
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.chapter);
  } catch (error) {
    console.error("Error finding similar chapters:", error);
    throw error;
  }
};

// Helper function to calculate cosine similarity between two vectors
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

// Method to create a vector store for the chapter content
chapterSchema.methods.createVectorStore = async function() {
  try {
    // Skip if already has a vector store ID
    if (this.vectorStoreId) {
      console.log(`Chapter ${this.chapterId || this.title} already has a vector store: ${this.vectorStoreId}`);
      return this.vectorStoreId;
    }

    // ALWAYS use the original prompt for vector store (not cleaned content)
    // This ensures the knowledge base contains the raw, unprocessed information
    const contentForVectorStore = this.prompt;

    // Create a vector store with chapter title as the name
    const vectorStoreName = `Chapter_${this.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    console.log(`Creating vector store for chapter: ${vectorStoreName}`);
    
    // Use the OpenAI API to create a vector store
    const vectorStore = await openai.vectorStores.create({
      name: vectorStoreName,
    });
    
    if (!vectorStore || !vectorStore.id) {
      throw new Error("Failed to create vector store");
    }
    
    console.log(`Created vector store: ${vectorStore.id}`);
    
    // Create a temporary file with the chapter content
    const tempFileName = `temp_chapter_${Date.now()}.txt`;
    const tempDir = require('path').join(__dirname, '../uploads');
    const fs = require('fs');
    
    // Ensure the uploads directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = require('path').join(tempDir, tempFileName);
    
    try {
      fs.writeFileSync(tempFilePath, contentForVectorStore, 'utf8');
      
      // Upload the file to the vector store
      const fileStream = fs.createReadStream(tempFilePath);
      const vectorStoreFile = await openai.vectorStores.files.uploadAndPoll(
        vectorStore.id,
        fileStream
      );
      
      console.log(`Added file to vector store: ${vectorStoreFile.id}, status: ${vectorStoreFile.status}`);
      
      // Save the vector store ID to the chapter
      this.vectorStoreId = vectorStore.id;
      return this.vectorStoreId;
      
    } finally {
      // Always clean up the temporary file, even if there's an error
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log(`Cleaned up temporary file: ${tempFilePath}`);
        }
      } catch (cleanupError) {
        console.error(`Error cleaning up temporary file: ${cleanupError.message}`);
      }
    }
    
  } catch (error) {
    console.error("Error creating vector store:", error);
    return null;
  }
};

// Auto-generate chapterId and handle question parsing before saving
chapterSchema.pre("save", async function (next) {
  if (!this.chapterId) {
    this.chapterId = "CHAP-" + Math.floor(100000 + Math.random() * 900000);
  }

  // Generate embedding if it doesn't exist
  if (!this.embedding) {
    try {
      await this.generateEmbedding();
    } catch (error) {
      console.error("Error generating embedding on save, continuing anyway:", error);
      // Continue with save even if embedding generation fails
    }
  }
  
  // Smart vector store creation logic
  // Only create vector store if explicitly needed and not already provided
  // Skip automatic vector store creation for chapters with question prompts (they should reuse existing vector stores)
  const hasQuestionPrompts = this.questionPrompt && Array.isArray(this.questionPrompt) && this.questionPrompt.length > 0;
  const isJsonQuestionFormat = typeof this.prompt === 'string' && 
    ((this.prompt.trim().startsWith('[') && this.prompt.trim().endsWith(']')) ||
     (this.prompt.includes('"Q":') && this.prompt.includes('"question":')));
  
  // Only create vector store if:
  // 1. No vectorStoreId is already set
  // 2. Has prompt content
  // 3. Is NOT a question format (questions should reuse existing vector stores)
  // 4. Doesn't already have structured question prompts
  if (!this.vectorStoreId && this.prompt && this.prompt.length > 0 && !isJsonQuestionFormat && !hasQuestionPrompts) {
    try {
      console.log("Creating vector store for chapter (non-question format)");
      await this.createVectorStore();
    } catch (error) {
      console.error("Error creating vector store on save, continuing anyway:", error);
      // Continue with save even if vector store creation fails
    }
  } else if (!this.vectorStoreId && (isJsonQuestionFormat || hasQuestionPrompts)) {
    console.log("Skipping vector store creation for question-format chapter (should reuse existing vector store)");
  }

  // Parse questionPrompt from the prompt field if it appears to be a JSON array of questions
  const prompt = this.prompt;
  
  if (typeof prompt === 'string' && 
      ((prompt.trim().startsWith('[') && prompt.trim().endsWith(']')) ||
       prompt.includes('"Q":') && prompt.includes('"question":') && prompt.includes('"question_marks":'))) {
    try {
      console.log("Detected potential JSON question array in prompt field - attempting to parse");
      
      // Try parsing the prompt as a JSON array
      const parsedPrompt = JSON.parse(prompt);
      
      // Check if it's an array of properly formatted question objects
      if (Array.isArray(parsedPrompt) && 
          parsedPrompt.length > 0 &&
          parsedPrompt.every(q => q && typeof q === 'object' && q.Q !== undefined && typeof q.question === 'string')) {
        
        console.log(`Successfully parsed question array format in prompt with ${parsedPrompt.length} questions`);
        
        // Make sure each question has the required fields with proper types and a unique questionId
        const formattedQuestions = parsedPrompt.map((q, index) => ({
          questionId: q.questionId || `QID-${this._id || new mongoose.Types.ObjectId()}-${index}-${Date.now()}`,
          Q: q.Q,
          question: q.question,
          question_marks: parseInt(q.question_marks || 3, 10),
          subtopic: q.subtopic || "General",
          question_type: q.question_type || "multiple-choice",
          tentativeAnswer: q.tentativeAnswer || "",
          difficultyLevel: q.difficultyLevel || "Medium"
        }));
        
        this.questionPrompt = formattedQuestions;
        console.log(`Assigned ${formattedQuestions.length} structured questions to questionPrompt array`);
      } else {
        console.log("JSON array found but not in valid question format, skipping questionPrompt assignment");
      }
    } catch (error) {
      console.log("Prompt contains JSON-like content but failed to parse:", error.message);
      
      // Try extracting JSON objects using regex as a fallback
      try {
        if (prompt.includes('"Q":') && prompt.includes('"question":')) {
          console.log("Attempting to extract question objects using regex pattern");
          
          const questionJsonObjects = prompt.match(/\{[\s\S]*?"Q"[\s\S]*?"question"[\s\S]*?\}/g);
          
          if (questionJsonObjects && questionJsonObjects.length > 0) {
            console.log(`Found ${questionJsonObjects.length} potential question objects using regex`);
            
            const structuredQuestions = [];
            let successCount = 0;
            
            questionJsonObjects.forEach((jsonStr, index) => {
              try {
                // Clean up the JSON string
                const cleanedJson = jsonStr.trim().replace(/,\s*$/, '');
                const questionObj = JSON.parse(cleanedJson);
                
                // Validate and add with proper types
                if (questionObj.Q !== undefined && questionObj.question) {
                  structuredQuestions.push({
                    questionId: questionObj.questionId || `QID-${this._id || new mongoose.Types.ObjectId()}-${index}-${Date.now()}`,
                    Q: questionObj.Q,
                    question: questionObj.question,
                    question_marks: parseInt(questionObj.question_marks || 3, 10),
                    subtopic: questionObj.subtopic || "General",
                    question_type: questionObj.question_type || "multiple-choice",
                    tentativeAnswer: questionObj.tentativeAnswer || "",
                    difficultyLevel: questionObj.difficultyLevel || "Medium"
                  });
                  successCount++;
                }
              } catch (parseError) {
                console.error(`Error parsing individual question JSON at index ${index}:`, parseError.message);
              }
            });
            
            if (structuredQuestions.length > 0) {
              console.log(`Successfully extracted ${successCount} questions using regex approach`);
              this.questionPrompt = structuredQuestions;
            }
          }
        }
      } catch (regexError) {
        console.error("Regex extraction attempt failed:", regexError.message);
      }
    }
  }

  // Ensure all questions in questionPrompt have a questionId if manually set
  if (this.questionPrompt && Array.isArray(this.questionPrompt)) {
    this.questionPrompt = this.questionPrompt.map((q, index) => {
      if (!q.questionId) {
        q.questionId = `QID-${this._id || new mongoose.Types.ObjectId()}-${index}-${Date.now()}`;
      }
      return q;
    });
  }

  next();
});

module.exports = mongoose.model("Chapter", chapterSchema);