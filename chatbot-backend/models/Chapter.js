const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  Q: { type: Number, required: true },
  question: { type: String, required: true },
  question_answered: { type: Boolean, default: false },
  question_marks: { type: Number, default: 1 },
  marks_gained: { type: Number, default: 0 }
});

const chapterSchema = new mongoose.Schema(
  {
    chapterId: { type: String, unique: true }, // Auto-generated
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true }, // Reference to Book
    title: { type: String, required: true },
    prompt: { type: String, required: true },
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

// Auto-generate chapterId before saving
chapterSchema.pre("save", async function (next) {
  if (!this.chapterId) {
    this.chapterId = "CHAP-" + Math.floor(100000 + Math.random() * 900000);
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
        
        // Make sure each question has the required fields with proper types
        const formattedQuestions = parsedPrompt.map(q => ({
          Q: q.Q,
          question: q.question,
          question_answered: Boolean(q.question_answered || false),
          question_marks: parseInt(q.question_marks || 3, 10),
          marks_gained: parseInt(q.marks_gained || 0, 10)
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
                    Q: questionObj.Q,
                    question: questionObj.question,
                    question_answered: Boolean(questionObj.question_answered || false),
                    question_marks: parseInt(questionObj.question_marks || 3, 10),
                    marks_gained: parseInt(questionObj.marks_gained || 0, 10)
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

  next();
});

module.exports = mongoose.model("Chapter", chapterSchema);
