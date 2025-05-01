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

  // If prompt looks like a JSON array of questions, try to parse it into questionPrompt
  const prompt = this.prompt;
  
  if (typeof prompt === 'string' && prompt.trim().startsWith('[') && prompt.trim().endsWith(']')) {
    try {
      const questionArray = JSON.parse(prompt);
      
      // Validate it's an array of question objects
      if (Array.isArray(questionArray) && 
          questionArray.length > 0 &&
          questionArray.every(q => q && typeof q === 'object' && q.Q !== undefined && typeof q.question === 'string')) {
        
        console.log(`Detected question array format in prompt. Setting questionPrompt with ${questionArray.length} questions.`);
        this.questionPrompt = questionArray;
      }
    } catch (error) {
      console.log("Prompt looks like JSON but failed to parse as question array:", error.message);
    }
  }

  next();
});

module.exports = mongoose.model("Chapter", chapterSchema);
