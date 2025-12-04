const mongoose = require("mongoose");

// Schema for individual question-answer details (unchanged)
const qnaDetailSchema = new mongoose.Schema({
  questionId: { 
    type: String, 
    required: true
  },
  questionText: {
    type: String,
    default: ""
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
  },
  agentType: {
    type: String,
    enum: ["oldchat_ai", "newchat_ai", "closureChat_ai", "explanation_ai"],
    default: "oldchat_ai"
  }
}, { timestamps: true });

// Session schema that wraps qnaDetails
const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: Number,  // Changed to Number for incremental IDs (1, 2, 3...)
    required: true
  },
  sessionStatus: {
    type: String,
    enum: ["started", "inProgress", "closed"],
    default: "started"
  },
  scorePercentage: {
    type: Number,  // totalScore/totalMarks when closureChat_ai selected
    default: 0
  },
  startSessionAfter: {
    type: Number,  // Hours: 24 if scorePercentage < 80%, else 72
    default: null
  },
  qnaDetails: [qnaDetailSchema]
}, { timestamps: true });

// Main QnALists schema with sessions
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
    sessions: [sessionSchema]
  },
  { timestamps: true }
);

// Create compound index for more efficient lookups
qnaListsSchema.index({ studentId: 1, chapterId: 1 });

// Helper to get the next session ID (incremental)
qnaListsSchema.methods.getNextSessionId = function() {
  if (!this.sessions || this.sessions.length === 0) return 1;
  const maxSessionId = Math.max(...this.sessions.map(s => s.sessionId));
  return maxSessionId + 1;
};

// Helper to get the current active session (latest non-closed session)
qnaListsSchema.methods.getCurrentSession = function() {
  if (!this.sessions || this.sessions.length === 0) return null;
  
  // Find the latest session that is not closed
  const activeSessions = this.sessions.filter(s => s.sessionStatus !== "closed");
  if (activeSessions.length > 0) {
    return activeSessions[activeSessions.length - 1];
  }
  
  // If all sessions are closed, return null (a new session should be started)
  return null;
};

// Helper to get the latest session (regardless of status)
qnaListsSchema.methods.getLatestSession = function() {
  if (!this.sessions || this.sessions.length === 0) return null;
  return this.sessions[this.sessions.length - 1];
};

// Helper to check if a new session can be started (based on startSessionAfter)
qnaListsSchema.methods.canStartNewSession = function() {
  const latestSession = this.getLatestSession();
  
  if (!latestSession) return true; // No sessions yet
  if (latestSession.sessionStatus !== "closed") return false; // Current session still active
  
  if (!latestSession.startSessionAfter) return true; // No cooldown set
  
  // Check if cooldown period has passed
  const sessionClosedAt = latestSession.updatedAt || latestSession.createdAt;
  const cooldownHours = latestSession.startSessionAfter;
  const cooldownEndTime = new Date(sessionClosedAt.getTime() + (cooldownHours * 60 * 60 * 1000));
  
  return new Date() >= cooldownEndTime;
};

// Helper to get time remaining before new session can start (in hours)
qnaListsSchema.methods.getTimeUntilNextSession = function() {
  const latestSession = this.getLatestSession();
  
  if (!latestSession || latestSession.sessionStatus !== "closed") return 0;
  if (!latestSession.startSessionAfter) return 0;
  
  const sessionClosedAt = latestSession.updatedAt || latestSession.createdAt;
  const cooldownHours = latestSession.startSessionAfter;
  const cooldownEndTime = new Date(sessionClosedAt.getTime() + (cooldownHours * 60 * 60 * 1000));
  const now = new Date();
  
  if (now >= cooldownEndTime) return 0;
  
  const remainingMs = cooldownEndTime - now;
  return Math.ceil(remainingMs / (60 * 60 * 1000)); // Return remaining hours
};

// Static method to check if a question has been answered in the current session
qnaListsSchema.statics.isQuestionAnswered = async function(studentId, chapterId, questionId, sessionId = null) {
  const record = await this.findOne({ 
    studentId,
    chapterId
  });
  
  if (!record) return false;
  
  // Get the current or specified session
  let session;
  if (sessionId) {
    session = record.sessions.find(s => s.sessionId === sessionId);
  } else {
    session = record.getCurrentSession();
  }
  
  if (!session) return false;
  
  // Check if question is answered in this session
  const question = session.qnaDetails.find(q => q.questionId === questionId && q.status === 1);
  return !!question;
};

// Static method to record a question answer
qnaListsSchema.statics.recordAnswer = async function(data) {
  const { studentId, bookId, chapterId, questionId, questionMarks, score, answerText, questionText, agentType, sessionId } = data;
  
  // Check if student-chapter record already exists
  let existingRecord = await this.findOne({
    studentId,
    chapterId
  });
  
  if (existingRecord) {
    // Get or create a session
    let session = existingRecord.getCurrentSession();
    
    // If no active session, create a new one with incremental ID
    if (!session) {
      const nextSessionId = existingRecord.getNextSessionId();
      
      session = {
        sessionId: nextSessionId,
        sessionStatus: "started",  // First qnaDetail save → started
        scorePercentage: 0,
        startSessionAfter: null,
        qnaDetails: []
      };
      existingRecord.sessions.push(session);
      session = existingRecord.sessions[existingRecord.sessions.length - 1];
    }
    
    // Check if this specific question exists in the session
    const questionIndex = session.qnaDetails.findIndex(q => q.questionId === questionId);
    
    if (questionIndex >= 0) {
      // Question already exists - update it
      session.qnaDetails[questionIndex].score = score;
      session.qnaDetails[questionIndex].status = 1; // Mark as answered
      session.qnaDetails[questionIndex].answerText = answerText || "";
      session.qnaDetails[questionIndex].questionText = questionText || "";
      session.qnaDetails[questionIndex].attemptedAt = Date.now();
      session.qnaDetails[questionIndex].agentType = agentType || "oldchat_ai";
    } else {
      // Add new question detail
      session.qnaDetails.push({
        questionId,
        questionText: questionText || "",
        questionMarks,
        score,
        status: 1, // Mark as answered
        answerText: answerText || "",
        attemptedAt: Date.now(),
        agentType: agentType || "oldchat_ai"
      });
    }
    
    // Update session status to inProgress if it was started (after first qnaDetail)
    if (session.sessionStatus === "started" && session.qnaDetails.length > 0) {
      session.sessionStatus = "inProgress";
    }
    
    return existingRecord.save();
  } else {
    // Create new record with the first session (sessionId = 1) and question detail
    return this.create({
      studentId,
      bookId,
      chapterId,
      sessions: [{
        sessionId: 1,  // First session starts at 1
        sessionStatus: "started",  // First qnaDetail save → started
        scorePercentage: 0,
        startSessionAfter: null,
        qnaDetails: [{
          questionId,
          questionText: questionText || "",
          questionMarks,
          score,
          status: 1, // Mark as answered
          answerText: answerText || "",
          attemptedAt: Date.now(),
          agentType: agentType || "oldchat_ai"
        }]
      }]
    });
  }
};

// Static method to close a session (when closureChat_ai is selected)
qnaListsSchema.statics.closeSession = async function(studentId, chapterId, sessionId = null) {
  const record = await this.findOne({ studentId, chapterId });
  
  if (!record) return null;
  
  let session;
  if (sessionId) {
    session = record.sessions.find(s => s.sessionId === sessionId);
  } else {
    session = record.getCurrentSession();
  }
  
  if (!session) return null;
  
  // Update session status to closed
  session.sessionStatus = "closed";
  
  // Calculate final scorePercentage (totalScore / totalMarks)
  const answeredQuestions = session.qnaDetails.filter(q => q.status === 1);
  const totalMarks = answeredQuestions.reduce((sum, q) => sum + q.questionMarks, 0);
  const earnedMarks = answeredQuestions.reduce((sum, q) => sum + q.score, 0);
  session.scorePercentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
  
  // Set startSessionAfter based on scorePercentage
  // If scorePercentage < 80% → 24 hours, else → 72 hours
  session.startSessionAfter = session.scorePercentage < 80 ? 24 : 72;
  
  return record.save();
};

// Static method to get current session ID (or create new if none active)
qnaListsSchema.statics.getOrCreateSessionId = async function(studentId, bookId, chapterId) {
  let record = await this.findOne({ studentId, chapterId });
  
  if (record) {
    const currentSession = record.getCurrentSession();
    if (currentSession) {
      return currentSession.sessionId;
    }
    
    // Check if new session can be started (cooldown check)
    if (!record.canStartNewSession()) {
      const hoursRemaining = record.getTimeUntilNextSession();
      return { 
        error: "cooldown", 
        message: `New session can start after ${hoursRemaining} hour(s)`,
        hoursRemaining 
      };
    }
    
    // No active session, create a new one with incremental ID
    const nextSessionId = record.getNextSessionId();
    record.sessions.push({
      sessionId: nextSessionId,
      sessionStatus: "started",
      scorePercentage: 0,
      startSessionAfter: null,
      qnaDetails: []
    });
    await record.save();
    return nextSessionId;
  } else {
    // Create new record with session 1
    await this.create({
      studentId,
      bookId,
      chapterId,
      sessions: [{
        sessionId: 1,
        sessionStatus: "started",
        scorePercentage: 0,
        startSessionAfter: null,
        qnaDetails: []
      }]
    });
    return 1;
  }
};

// Static method to get all answered questions for a chapter (current session)
qnaListsSchema.statics.getAnsweredQuestionsForChapter = async function(studentId, chapterId, sessionId = null) {
  const record = await this.findOne({
    studentId,
    chapterId
  });
  
  if (!record) return [];
  
  // Get the current or specified session
  let session;
  if (sessionId) {
    session = record.sessions.find(s => s.sessionId === sessionId);
  } else {
    session = record.getCurrentSession();
  }
  
  if (!session) return [];
  
  // Return only the answered questions from qnaDetails
  return session.qnaDetails.filter(q => q.status === 1);
};

// Static method to get statistics for a chapter (current session)
qnaListsSchema.statics.getChapterStats = async function(studentId, chapterId, sessionId = null) {
  const record = await this.findOne({
    studentId,
    chapterId
  });
  
  if (!record) {
    return {
      totalQuestions: 0,
      answeredQuestions: 0,
      totalMarks: 0,
      earnedMarks: 0,
      percentage: 0,
      sessionId: null,
      sessionStatus: null
    };
  }
  
  // Get the current or specified session
  let session;
  if (sessionId) {
    session = record.sessions.find(s => s.sessionId === sessionId);
  } else {
    session = record.getCurrentSession();
  }
  
  if (!session || !session.qnaDetails || session.qnaDetails.length === 0) {
    return {
      totalQuestions: 0,
      answeredQuestions: 0,
      totalMarks: 0,
      earnedMarks: 0,
      percentage: 0,
      sessionId: session ? session.sessionId : null,
      sessionStatus: session ? session.sessionStatus : null
    };
  }
  
  const questions = session.qnaDetails;
  const answeredQuestions = questions.filter(q => q.status === 1);
  const totalMarks = questions.reduce((sum, q) => sum + q.questionMarks, 0);
  const earnedMarks = questions.reduce((sum, q) => sum + q.score, 0);
  
  return {
    totalQuestions: questions.length,
    answeredQuestions: answeredQuestions.length,
    totalMarks,
    earnedMarks,
    percentage: totalMarks > 0 ? (earnedMarks / totalMarks) * 100 : 0,
    sessionId: session.sessionId,
    sessionStatus: session.sessionStatus
  };
};

// Static method to get detailed chapter statistics for closure (current session)
qnaListsSchema.statics.getChapterStatsForClosure = async function(studentId, chapterId, sessionId = null) {
  // First get the basic stats
  const basicStats = await this.getChapterStats(studentId, chapterId, sessionId);
  
  // Get all questions for this chapter
  const record = await this.findOne({
    studentId,
    chapterId
  });
  
  if (!record) {
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
  
  // Get the current or specified session
  let session;
  if (sessionId) {
    session = record.sessions.find(s => s.sessionId === sessionId);
  } else {
    session = record.getCurrentSession();
  }
  
  if (!session || !session.qnaDetails || session.qnaDetails.length === 0) {
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
  const answeredQuestions = session.qnaDetails
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

// Static method to get all sessions for a student-chapter
qnaListsSchema.statics.getAllSessions = async function(studentId, chapterId) {
  const record = await this.findOne({ studentId, chapterId });
  
  if (!record || !record.sessions) return [];
  
  return record.sessions.map(session => ({
    sessionId: session.sessionId,
    sessionStatus: session.sessionStatus,
    scorePercentage: session.scorePercentage,
    startSessionAfter: session.startSessionAfter,
    questionsCount: session.qnaDetails.length,
    answeredCount: session.qnaDetails.filter(q => q.status === 1).length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  }));
};

// Static method to check cooldown status
qnaListsSchema.statics.getCooldownStatus = async function(studentId, chapterId) {
  const record = await this.findOne({ studentId, chapterId });
  
  if (!record) {
    return { canStart: true, hoursRemaining: 0, lastSessionScore: null };
  }
  
  const canStart = record.canStartNewSession();
  const hoursRemaining = record.getTimeUntilNextSession();
  const latestSession = record.getLatestSession();
  
  return {
    canStart,
    hoursRemaining,
    lastSessionScore: latestSession ? latestSession.scorePercentage : null,
    lastSessionStatus: latestSession ? latestSession.sessionStatus : null,
    totalSessions: record.sessions.length
  };
};

module.exports = mongoose.model("QnALists", qnaListsSchema);
