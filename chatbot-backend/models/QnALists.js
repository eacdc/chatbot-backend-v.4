const mongoose = require("mongoose");

const qnaDetailSchema = new mongoose.Schema({
  questionId: { 
    type: String, 
    required: true
  },
  questionMarks: { 
    type: Number, 
    required: true,
    default: 1 
  },
  score: { 
    type: Number, 
    required: true,
    default: 0 
  },
  status: { 
    type: Number, 
    enum: [0, 1], // 0 = not answered, 1 = answered
    default: 0
  },
  answerText: {
    type: String,
    default: ""
  },
  attemptedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const qnaListsSchema = new mongoose.Schema(
  {
    studentId: { 
      type: String, 
      required: true,
      index: true 
    },
    bookId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Book", 
      required: true,
      index: true 
    },
    chapterId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Chapter", 
      required: true,
      index: true 
    },
    qnaDetails: [qnaDetailSchema]
  },
  { timestamps: true }
);

// Create compound index for more efficient lookups
qnaListsSchema.index({ studentId: 1, chapterId: 1 });

// Static method to check if a question has been answered
qnaListsSchema.statics.isQuestionAnswered = async function(studentId, chapterId, questionId) {
  const record = await this.findOne({ 
    studentId,
    chapterId,
    "qnaDetails.questionId": questionId,
    "qnaDetails.status": 1
  });
  
  return !!record;
};

// Static method to record a question answer
qnaListsSchema.statics.recordAnswer = async function(data) {
  const { studentId, bookId, chapterId, questionId, questionMarks, score, answerText } = data;
  
  // Check if student-chapter record already exists
  const existingRecord = await this.findOne({
    studentId,
    chapterId
  });
  
  if (existingRecord) {
    // Check if this specific question exists in the array
    const questionIndex = existingRecord.qnaDetails.findIndex(q => q.questionId === questionId);
    
    if (questionIndex >= 0) {
      // Question already exists - update it
      existingRecord.qnaDetails[questionIndex].score = score;
      existingRecord.qnaDetails[questionIndex].status = 1; // Mark as answered
      existingRecord.qnaDetails[questionIndex].answerText = answerText || "";
      existingRecord.qnaDetails[questionIndex].attemptedAt = Date.now();
    } else {
      // Add new question detail
      existingRecord.qnaDetails.push({
        questionId,
        questionMarks,
        score,
        status: 1, // Mark as answered
        answerText: answerText || "",
        attemptedAt: Date.now()
      });
    }
    
    return existingRecord.save();
  } else {
    // Create new record with the first question detail
    return this.create({
      studentId,
      bookId,
      chapterId,
      qnaDetails: [{
        questionId,
        questionMarks,
        score,
        status: 1, // Mark as answered
        answerText: answerText || "",
        attemptedAt: Date.now()
      }]
    });
  }
};

// Static method to get all answered questions for a chapter
qnaListsSchema.statics.getAnsweredQuestionsForChapter = async function(studentId, chapterId) {
  const record = await this.findOne({
    studentId,
    chapterId
  });
  
  if (!record) return [];
  
  // Return only the answered questions from qnaDetails
  return record.qnaDetails.filter(q => q.status === 1);
};

// Static method to get statistics for a chapter
qnaListsSchema.statics.getChapterStats = async function(studentId, chapterId) {
  const record = await this.findOne({
    studentId,
    chapterId
  });
  
  if (!record || !record.qnaDetails || record.qnaDetails.length === 0) {
    return {
      totalQuestions: 0,
      answeredQuestions: 0,
      totalMarks: 0,
      earnedMarks: 0,
      percentage: 0
    };
  }
  
  const questions = record.qnaDetails;
  const answeredQuestions = questions.filter(q => q.status === 1);
  const totalMarks = questions.reduce((sum, q) => sum + q.questionMarks, 0);
  const earnedMarks = questions.reduce((sum, q) => sum + q.score, 0);
  
  return {
    totalQuestions: questions.length,
    answeredQuestions: answeredQuestions.length,
    totalMarks,
    earnedMarks,
    percentage: totalMarks > 0 ? (earnedMarks / totalMarks) * 100 : 0
  };
};

// Static method to get detailed chapter statistics for closure
qnaListsSchema.statics.getChapterStatsForClosure = async function(studentId, chapterId) {
  // First get the basic stats
  const basicStats = await this.getChapterStats(studentId, chapterId);
  
  // Get all questions for this chapter
  const record = await this.findOne({
    studentId,
    chapterId
  });
  
  if (!record || !record.qnaDetails || record.qnaDetails.length === 0) {
    return {
      ...basicStats,
      correctAnswers: 0,
      partialAnswers: 0,
      incorrectAnswers: 0,
      correctPercentage: 0,
      partialPercentage: 0,
      incorrectPercentage: 0,
      timeSpentMinutes: 0,
      lastAttemptedAt: null,
      firstAttemptedAt: null
    };
  }
  
  // Get answered questions and sort by attempted time
  const answeredQuestions = record.qnaDetails
    .filter(q => q.status === 1)
    .sort((a, b) => new Date(a.attemptedAt) - new Date(b.attemptedAt));
  
  // Calculate additional metrics
  const totalAnswered = answeredQuestions.length;
  const correctAnswers = answeredQuestions.filter(q => q.score >= q.questionMarks * 0.7).length;
  const partialAnswers = answeredQuestions.filter(q => q.score > 0 && q.score < q.questionMarks * 0.7).length;
  const incorrectAnswers = answeredQuestions.filter(q => q.score === 0).length;
  
  // Calculate percentages
  const correctPercentage = totalAnswered > 0 ? (correctAnswers / totalAnswered) * 100 : 0;
  const partialPercentage = totalAnswered > 0 ? (partialAnswers / totalAnswered) * 100 : 0;
  const incorrectPercentage = totalAnswered > 0 ? (incorrectAnswers / totalAnswered) * 100 : 0;
  
  // Get time spent (from first to last answer)
  let timeSpentMinutes = 0;
  if (answeredQuestions.length > 1) {
    const firstAttempt = new Date(answeredQuestions[0].attemptedAt);
    const lastAttempt = new Date(answeredQuestions[answeredQuestions.length - 1].attemptedAt);
    timeSpentMinutes = Math.round((lastAttempt - firstAttempt) / 60000); // Convert to minutes
  }
  
  // Return detailed stats
  return {
    ...basicStats,
    correctAnswers,
    partialAnswers,
    incorrectAnswers,
    correctPercentage,
    partialPercentage,
    incorrectPercentage,
    timeSpentMinutes,
    lastAttemptedAt: answeredQuestions.length > 0 ? answeredQuestions[answeredQuestions.length - 1].attemptedAt : null,
    firstAttemptedAt: answeredQuestions.length > 0 ? answeredQuestions[0].attemptedAt : null
  };
};

module.exports = mongoose.model("QnALists", qnaListsSchema); 