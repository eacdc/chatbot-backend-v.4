const mongoose = require("mongoose");
const OpenAI = require("openai");

const questionSchema = new mongoose.Schema({
  questionId: { type: String, unique: true }, // Unique ID for each question
  Q: { type: Number, required: true },
  question: { type: String, required: true },
  question_marks: { type: Number, default: 1 },
  subtopic: { type: String, default: "General" },
  tentativeAnswer: { type: String, default: "" },
  difficultyLevel: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" }
});

const chapterSchema = new mongoose.Schema(
  {
    chapterId: { type: String, unique: true }, // Auto-generated
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true }, // Reference to Book
    title: { type: String, required: true },
    prompt: { type: String, required: true },
    embedding: { type: [Number], default: null }, // Embedding vector for semantic search
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

// Initialize OpenAI client - use environment variable
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Method to generate embedding for a chapter
chapterSchema.methods.generateEmbedding = async function() {
  try {
    // Use the prompt as the input for the embedding
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
