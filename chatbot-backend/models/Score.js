const mongoose = require("mongoose");

const scoreSchema = new mongoose.Schema(
  {
    userId: { 
      type: String, 
      required: true,
      index: true 
    },
    chapterId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Chapter", 
      required: true,
      index: true 
    },
    bookId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Book", 
      required: true 
    },
    totalMarksObtained: { 
      type: Number, 
      required: true,
      default: 0 
    },
    totalQuestionMarks: { 
      type: Number, 
      required: true,
      default: 0 
    },
    scorePercentage: {
      type: Number,
      default: function() {
        return this.totalQuestionMarks > 0 ? 
          (this.totalMarksObtained / this.totalQuestionMarks) * 100 : 0;
      }
    },
    attemptType: { 
      type: String, 
      enum: ['first', 'retry', 'practice'],
      default: 'first' 
    },
    questionsAnswered: {
      type: Number,
      required: true,
      default: 0
    },
    totalQuestions: {
      type: Number,
      required: true
    },
    completionStatus: {
      type: String,
      enum: ['complete', 'partial', 'abandoned'],
      default: 'partial'
    }
  },
  { 
    timestamps: true 
  }
);

// Create compound index for unique user chapter attempts by type
scoreSchema.index({ userId: 1, chapterId: 1, attemptType: 1, createdAt: 1 });

// Method to calculate stats
scoreSchema.methods.calculateStats = function() {
  this.scorePercentage = this.totalQuestionMarks > 0 ? 
    (this.totalMarksObtained / this.totalQuestionMarks) * 100 : 0;
    
  // Set completion status
  if (this.questionsAnswered >= this.totalQuestions) {
    this.completionStatus = 'complete';
  } else if (this.questionsAnswered > 0) {
    this.completionStatus = 'partial';
  } else {
    this.completionStatus = 'abandoned';
  }
};

// Create a new score entry
scoreSchema.statics.createAttempt = async function(data) {
  const { userId, chapterId, bookId, attemptType = 'first' } = data;
  
  // Get chapter to find total question count
  const Chapter = mongoose.model('Chapter');
  const chapter = await Chapter.findById(chapterId);
  
  if (!chapter || !chapter.questionPrompt) {
    throw new Error('Chapter not found or has no questions');
  }
  
  // Only get the total question count, not the marks
  const totalQuestions = chapter.questionPrompt.length;
  
  // Create score record with initial values
  return this.create({
    userId,
    chapterId,
    bookId,
    attemptType,
    totalMarksObtained: 0,
    totalQuestionMarks: 0, // Start with 0, will be added as questions are answered
    questionsAnswered: 0,
    totalQuestions
  });
};

// Update score when a question is answered
scoreSchema.statics.updateQuestionScore = async function(scoreId, questionNumber, marksGained, maxMarks) {
  const score = await this.findById(scoreId);
  
  if (!score) {
    throw new Error('Score record not found');
  }
  
  // Update marks and questions answered
  score.totalMarksObtained += marksGained;
  score.totalQuestionMarks += maxMarks; // Add this question's max marks to the total
  score.questionsAnswered += 1;
  
  // Recalculate stats
  score.calculateStats();
  
  return score.save();
};

// Find latest attempt
scoreSchema.statics.findLatestAttempt = async function(userId, chapterId) {
  return this.findOne({ userId, chapterId })
    .sort({ createdAt: -1 })
    .exec();
};

module.exports = mongoose.model("Score", scoreSchema); 