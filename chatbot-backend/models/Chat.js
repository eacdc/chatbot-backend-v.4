const mongoose = require("mongoose");

// Schema for individual messages (unchanged)
const messageSchema = new mongoose.Schema({
    role: { type: String, enum: ["user", "assistant", "system"] },
    content: { type: String },
    timestamp: { type: Date, default: Date.now },
    isAudio: { type: Boolean, default: false },
    audioFileId: { type: String, default: null },
    messageId: { type: String, default: null }
});

// Session schema that wraps messages
const sessionSchema = new mongoose.Schema({
    sessionId: {
        type: Number,  // Incremental: 1, 2, 3...
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
    totalTime: {
        type: Number,  // Duration in milliseconds (endTime - startTime)
        default: 0
    },
    startTime: {
        type: Date,    // First user message datetime for that session
        default: null
    },
    endTime: {
        type: Date,    // Last bot message datetime for that session (when closed)
        default: null
    },
    startSessionAfter: {
        type: Number,  // Hours: 24 if scorePercentage < 80%, else 72
        default: null
    },
    messages: [messageSchema],
    agentName: { 
        type: String, 
        enum: ["oldchat_ai", "newchat_ai", "closureChat_ai", "explanation_ai", null],
        default: null 
    },
    metadata: {
        answeredQuestions: [String],
        totalMarks: { type: Number, default: 0 },
        earnedMarks: { type: Number, default: 0 },
        lastQuestionAsked: String,
        lastActive: { type: Date, default: Date.now }
    }
}, { timestamps: true });

// Main Chat schema with sessions
const chatSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", default: null },
    sessions: [sessionSchema]
}, { timestamps: true });

// Compound index for efficient lookups
chatSchema.index({ userId: 1, chapterId: 1 });

// Helper to get the next session ID (incremental)
chatSchema.methods.getNextSessionId = function() {
    if (!this.sessions || this.sessions.length === 0) return 1;
    const maxSessionId = Math.max(...this.sessions.map(s => s.sessionId));
    return maxSessionId + 1;
};

// Helper to get the current active session (latest non-closed session)
chatSchema.methods.getCurrentSession = function() {
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
chatSchema.methods.getLatestSession = function() {
    if (!this.sessions || this.sessions.length === 0) return null;
    return this.sessions[this.sessions.length - 1];
};

// Helper to check if a new session can be started (based on startSessionAfter)
chatSchema.methods.canStartNewSession = function() {
    const latestSession = this.getLatestSession();
    
    if (!latestSession) return true; // No sessions yet
    if (latestSession.sessionStatus !== "closed") return false; // Current session still active
    
    if (!latestSession.startSessionAfter) return true; // No cooldown set
    
    // Check if cooldown period has passed
    const sessionClosedAt = latestSession.endTime || latestSession.updatedAt || latestSession.createdAt;
    const cooldownHours = latestSession.startSessionAfter;
    const cooldownEndTime = new Date(sessionClosedAt.getTime() + (cooldownHours * 60 * 60 * 1000));
    
    return new Date() >= cooldownEndTime;
};

// Helper to get time remaining before new session can start (in hours)
chatSchema.methods.getTimeUntilNextSession = function() {
    const latestSession = this.getLatestSession();
    
    if (!latestSession || latestSession.sessionStatus !== "closed") return 0;
    if (!latestSession.startSessionAfter) return 0;
    
    const sessionClosedAt = latestSession.endTime || latestSession.updatedAt || latestSession.createdAt;
    const cooldownHours = latestSession.startSessionAfter;
    const cooldownEndTime = new Date(sessionClosedAt.getTime() + (cooldownHours * 60 * 60 * 1000));
    const now = new Date();
    
    if (now >= cooldownEndTime) return 0;
    
    const remainingMs = cooldownEndTime - now;
    return Math.ceil(remainingMs / (60 * 60 * 1000)); // Return remaining hours
};

// Helper to create a new session
chatSchema.methods.createNewSession = function() {
    const nextSessionId = this.getNextSessionId();
    const newSession = {
        sessionId: nextSessionId,
        sessionStatus: "started",
        scorePercentage: 0,
        totalTime: 0,
        startTime: null,  // Will be set on first user message
        endTime: null,
        startSessionAfter: null,
        messages: [],
        agentName: null,
        metadata: {
            answeredQuestions: [],
            totalMarks: 0,
            earnedMarks: 0,
            lastQuestionAsked: null,
            lastActive: new Date()
        }
    };
    
    this.sessions.push(newSession);
    return this.sessions[this.sessions.length - 1];
};

// Helper to calculate total user response time from messages
// Sum of time gaps: (bot1 → user2) + (bot2 → user3) + ... + (botN-1 → userN)
chatSchema.methods.calculateTotalTime = function(messages) {
    if (!messages || messages.length < 2) return 0;
    
    let totalTime = 0;
    
    // Iterate through messages to find bot → user pairs
    for (let i = 0; i < messages.length - 1; i++) {
        const currentMsg = messages[i];
        const nextMsg = messages[i + 1];
        
        // If current is bot (assistant) and next is user, calculate time gap
        if (currentMsg.role === "assistant" && nextMsg.role === "user") {
            const botTimestamp = new Date(currentMsg.timestamp);
            const userTimestamp = new Date(nextMsg.timestamp);
            const timeGap = userTimestamp - botTimestamp;
            
            // Only add positive time gaps (in case of timestamp issues)
            if (timeGap > 0) {
                totalTime += timeGap;
            }
        }
    }
    
    return totalTime; // Returns total time in milliseconds
};

// Helper to convert totalTime (ms) to readable format
chatSchema.methods.getTotalTimeFormatted = function(totalTimeMs) {
    if (!totalTimeMs || totalTimeMs <= 0) return { minutes: 0, seconds: 0, formatted: "0 min" };
    
    const totalSeconds = Math.floor(totalTimeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    let formatted;
    if (minutes === 0) {
        formatted = `${seconds} sec`;
    } else if (seconds === 0) {
        formatted = `${minutes} min`;
    } else {
        formatted = `${minutes} min ${seconds} sec`;
    }
    
    return { minutes, seconds, formatted, totalMs: totalTimeMs };
};

// Helper to close the current session (when closureChat_ai is selected)
chatSchema.methods.closeCurrentSession = function(scorePercentage = 0) {
    const session = this.getCurrentSession();
    if (!session) return null;
    
    session.sessionStatus = "closed";
    session.endTime = new Date();  // Last bot message datetime
    session.scorePercentage = scorePercentage;
    session.agentName = "closureChat_ai";
    
    // Calculate totalTime as sum of user response times
    // (time between each bot message and the following user message)
    session.totalTime = this.calculateTotalTime(session.messages);
    
    // Set startSessionAfter based on scorePercentage
    // If scorePercentage < 80% → 24 hours, else → 72 hours
    session.startSessionAfter = scorePercentage < 80 ? 24 : 72;
    
    return session;
};

// Helper to add a message to current session
chatSchema.methods.addMessage = function(role, content, options = {}) {
    let session = this.getCurrentSession();
    
    if (!session) {
        // Create new session if none exists
        session = this.createNewSession();
    }
    
    const now = new Date();
    
    session.messages.push({
        role,
        content,
        timestamp: now,
        isAudio: options.isAudio || false,
        audioFileId: options.audioFileId || null,
        messageId: options.messageId || null
    });
    
    // Set startTime on first user message
    if (role === "user" && !session.startTime) {
        session.startTime = now;
    }
    
    // Update session status to inProgress if it was started (after first message)
    if (session.sessionStatus === "started" && session.messages.length > 0) {
        session.sessionStatus = "inProgress";
    }
    
    // Update lastActive
    if (session.metadata) {
        session.metadata.lastActive = now;
    }
    
    return session;
};

// Static method to get or create a chat document with session
chatSchema.statics.getOrCreateWithSession = async function(userId, chapterId) {
    let chat = await this.findOne({ userId, chapterId });
    
    if (!chat) {
        // Create new chat document with session 1
        chat = new this({
            userId,
            chapterId,
            sessions: [{
                sessionId: 1,
                sessionStatus: "started",
                scorePercentage: 0,
                totalTime: 0,
                startTime: null,
                endTime: null,
                startSessionAfter: null,
                messages: [],
                agentName: null,
                metadata: {
                    answeredQuestions: [],
                    totalMarks: 0,
                    earnedMarks: 0,
                    lastQuestionAsked: null,
                    lastActive: new Date()
                }
            }]
        });
        await chat.save();
    } else {
        // Check if we need to create a new session
        const currentSession = chat.getCurrentSession();
        
        if (!currentSession) {
            // Check if new session can be started (cooldown check)
            if (!chat.canStartNewSession()) {
                const hoursRemaining = chat.getTimeUntilNextSession();
                return { 
                    error: "cooldown", 
                    message: `New session can start after ${hoursRemaining} hour(s)`,
                    hoursRemaining,
                    chat 
                };
            }
            
            // Create new session with incremental ID
            chat.createNewSession();
            await chat.save();
        }
    }
    
    return chat;
};

// Static method to get all sessions for a user-chapter
chatSchema.statics.getAllSessions = async function(userId, chapterId) {
    const chat = await this.findOne({ userId, chapterId });
    
    if (!chat || !chat.sessions) return [];
    
    return chat.sessions.map(session => {
        // Calculate formatted time
        const totalTimeFormatted = chat.getTotalTimeFormatted(session.totalTime);
        
        return {
            sessionId: session.sessionId,
            sessionStatus: session.sessionStatus,
            scorePercentage: session.scorePercentage,
            totalTime: session.totalTime,
            totalTimeFormatted: totalTimeFormatted.formatted,
            totalTimeMinutes: totalTimeFormatted.minutes,
            startTime: session.startTime,
            endTime: session.endTime,
            startSessionAfter: session.startSessionAfter,
            messagesCount: session.messages.length,
            agentName: session.agentName,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
        };
    });
};

// Static method to get messages from current session
chatSchema.statics.getCurrentSessionMessages = async function(userId, chapterId) {
    const chat = await this.findOne({ userId, chapterId });
    
    if (!chat) return { messages: [], sessionId: null, sessionStatus: null, agentName: null };
    
    const session = chat.getCurrentSession();
    
    if (!session) {
        // Return latest closed session info if no active session
        const latestSession = chat.getLatestSession();
        if (latestSession) {
            const totalTimeFormatted = chat.getTotalTimeFormatted(latestSession.totalTime);
            return {
                messages: [],  // Empty for closed session
                sessionId: latestSession.sessionId,
                sessionStatus: latestSession.sessionStatus,
                agentName: latestSession.agentName,
                scorePercentage: latestSession.scorePercentage,
                totalTime: latestSession.totalTime,
                totalTimeFormatted: totalTimeFormatted.formatted,
                totalTimeMinutes: totalTimeFormatted.minutes,
                startTime: latestSession.startTime,
                endTime: latestSession.endTime,
                startSessionAfter: latestSession.startSessionAfter,
                canStartNew: chat.canStartNewSession(),
                hoursUntilNextSession: chat.getTimeUntilNextSession()
            };
        }
        return { messages: [], sessionId: null, sessionStatus: null, agentName: null };
    }
    
    // For active sessions, calculate current totalTime from messages
    const currentTotalTime = chat.calculateTotalTime(session.messages);
    const totalTimeFormatted = chat.getTotalTimeFormatted(currentTotalTime);
    
    return {
        messages: session.messages,
        sessionId: session.sessionId,
        sessionStatus: session.sessionStatus,
        agentName: session.agentName,
        scorePercentage: session.scorePercentage,
        totalTime: currentTotalTime,
        totalTimeFormatted: totalTimeFormatted.formatted,
        totalTimeMinutes: totalTimeFormatted.minutes,
        startTime: session.startTime,
        endTime: session.endTime
    };
};

// Static method to check cooldown status
chatSchema.statics.getCooldownStatus = async function(userId, chapterId) {
    const chat = await this.findOne({ userId, chapterId });
    
    if (!chat) {
        return { canStart: true, hoursRemaining: 0, lastSessionScore: null };
    }
    
    const canStart = chat.canStartNewSession();
    const hoursRemaining = chat.getTimeUntilNextSession();
    const latestSession = chat.getLatestSession();
    
    return {
        canStart,
        hoursRemaining,
        lastSessionScore: latestSession ? latestSession.scorePercentage : null,
        lastSessionStatus: latestSession ? latestSession.sessionStatus : null,
        totalSessions: chat.sessions.length
    };
};

module.exports = mongoose.model("Chat", chatSchema);
