const mongoose = require("mongoose");

// Import models (will be available after mongoose connection)
let QnALists, Chat, Session;

const pointsTableSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true
    },
    username: {
        type: String,
        required: true
    },
    fullname: {
        type: String,
        default: ""
    },
    points: {
        type: Number,
        default: 0,
        index: true
    },
    totalMarksEarned: {
        type: Number,
        default: 0
    },
    quizTimeHours: {
        type: Number,
        default: 0,
        index: true  // For tie-breaking
    },
    learningTimeHours: {
        type: Number,
        default: 0
    },
    rank: {
        type: Number,
        default: 0,
        index: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Compound index for efficient ranking queries (points desc, quizTimeHours asc)
pointsTableSchema.index({ points: -1, quizTimeHours: 1 });

// Static method to refresh all rankings
pointsTableSchema.statics.refreshRankings = async function() {
    try {
        console.log("🔄 Starting PointsTable refresh...");
        
        // Lazy load models to avoid circular dependencies
        if (!QnALists) QnALists = mongoose.model("QnALists");
        if (!Chat) Chat = mongoose.model("Chat");
        if (!Session) Session = mongoose.model("Session");
        
        // Get all users
        const User = mongoose.model("User");
        const users = await User.find({}).select("_id username fullname");
        
        console.log(`🔄 Processing ${users.length} users...`);
        
        const pointsData = [];
        
        // Calculate points for each user
        for (const user of users) {
            try {
                const { points, totalMarksEarned, quizTimeHours, learningTimeHours } = 
                    await calculateUserPoints(user._id);
                
                pointsData.push({
                    userId: user._id,
                    username: user.username,
                    fullname: user.fullname || "",
                    points: points,
                    totalMarksEarned: totalMarksEarned,
                    quizTimeHours: quizTimeHours,
                    learningTimeHours: learningTimeHours
                });
            } catch (err) {
                console.error(`Error calculating points for user ${user._id}:`, err);
            }
        }
        
        // Sort by points (descending), then by quizTimeHours (ascending - less time = better rank)
        pointsData.sort((a, b) => {
            if (b.points !== a.points) {
                return b.points - a.points;  // Higher points = better
            }
            return a.quizTimeHours - b.quizTimeHours;  // Less time = better
        });
        
        // Assign ranks
        pointsData.forEach((data, index) => {
            data.rank = index + 1;
        });
        
        // Bulk update PointsTable
        const bulkOps = pointsData.map(data => ({
            updateOne: {
                filter: { userId: data.userId },
                update: {
                    $set: {
                        ...data,
                        lastUpdated: new Date()
                    }
                },
                upsert: true
            }
        }));
        
        await this.bulkWrite(bulkOps);
        
        console.log(`✅ PointsTable refreshed successfully. ${pointsData.length} users ranked.`);
        return { success: true, count: pointsData.length };
        
    } catch (error) {
        console.error("Error refreshing PointsTable:", error);
        throw error;
    }
};

// Helper function to calculate user points (same logic as unified-scores API)
async function calculateUserPoints(userId) {
    // Lazy load models to avoid circular dependencies
    if (!QnALists) QnALists = mongoose.model("QnALists");
    if (!Chat) Chat = mongoose.model("Chat");
    if (!Session) Session = mongoose.model("Session");
    
    // Get all QnA records for the user (no date filter - all time)
    const qnaRecords = await QnALists.find({ studentId: userId })
        .populate('bookId', 'title subject')
        .populate('chapterId', 'title');
    
    // Calculate total marks earned (from last session of each QnA record)
    let totalMarksEarned = 0;
    for (const record of qnaRecords) {
        if (record.sessions && record.sessions.length > 0) {
            const lastSession = record.sessions[record.sessions.length - 1];
            if (lastSession.qnaDetails) {
                const answeredQuestions = lastSession.qnaDetails.filter(q => q.status === 1);
                const marksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                totalMarksEarned += marksEarned;
            }
        }
    }
    
    // Get all chats for the user
    const userChats = await Chat.find({ userId })
        .populate('chapterId', 'title')
        .sort({ updatedAt: -1 });
    
    // Calculate total quiz time (from last session of each chat)
    let quizTimeMs = 0;
    for (const chat of userChats) {
        if (chat.sessions && chat.sessions.length > 0) {
            const lastSession = chat.sessions[chat.sessions.length - 1];
            if (lastSession.totalTime) {
                quizTimeMs += lastSession.totalTime;
            }
        }
    }
    const quizTimeHours = quizTimeMs / (60 * 60 * 1000);
    
    // Calculate total learning time
    let learningTimeMinutes = 0;
    try {
        const learningSessions = await Session.find({
            userId: userId,
            status: "closed",
            sessionType: "Learning",
            timeTaken: { $ne: null }
        });
        learningTimeMinutes = learningSessions.reduce((sum, session) => {
            return sum + (session.timeTaken || 0);
        }, 0);
    } catch (err) {
        console.error("Error fetching learning sessions:", err);
    }
    const learningTimeHours = learningTimeMinutes / 60;
    
    // Calculate points: (totalMarksEarned / quizTimeHours) + (learningTimeHours / 100)
    let points = 0;
    if (quizTimeHours > 0) {
        points = (totalMarksEarned / quizTimeHours) + (learningTimeHours / 100);
    } else {
        points = learningTimeHours / 100;
    }
    
    return {
        points: parseFloat(points.toFixed(2)),
        totalMarksEarned: parseFloat(totalMarksEarned.toFixed(2)),
        quizTimeHours: parseFloat(quizTimeHours.toFixed(2)),
        learningTimeHours: parseFloat(learningTimeHours.toFixed(2))
    };
}

// Static method to get user ranking with neighbors
pointsTableSchema.statics.getUserRanking = async function(userId, neighborsCount = 5) {
    try {
        // Get user's ranking entry
        const userEntry = await this.findOne({ userId })
            .populate('userId', 'username fullname');
        
        if (!userEntry) {
            return {
                success: false,
                message: "User not found in rankings. Rankings may need to be refreshed.",
                userRanking: null,
                neighbors: []
            };
        }
        
        const userRank = userEntry.rank;
        
        // Get users above (better rank = lower number)
        const usersAbove = await this.find({
            rank: { $lt: userRank }
        })
        .sort({ rank: 1 })
        .limit(neighborsCount)
        .populate('userId', 'username fullname');
        
        // Get users below (worse rank = higher number)
        const usersBelow = await this.find({
            rank: { $gt: userRank }
        })
        .sort({ rank: 1 })
        .limit(neighborsCount)
        .populate('userId', 'username fullname');
        
        // Get total users count
        const totalUsers = await this.countDocuments();
        
        return {
            success: true,
            userRanking: {
                rank: userRank,
                totalUsers: totalUsers,
                userId: userEntry.userId._id,
                username: userEntry.username,
                fullname: userEntry.fullname,
                points: userEntry.points,
                totalMarksEarned: userEntry.totalMarksEarned,
                quizTimeHours: userEntry.quizTimeHours,
                learningTimeHours: userEntry.learningTimeHours,
                lastUpdated: userEntry.lastUpdated
            },
            usersAbove: usersAbove.map(entry => ({
                rank: entry.rank,
                userId: entry.userId._id,
                username: entry.username,
                fullname: entry.fullname,
                points: entry.points,
                quizTimeHours: entry.quizTimeHours
            })),
            usersBelow: usersBelow.map(entry => ({
                rank: entry.rank,
                userId: entry.userId._id,
                username: entry.username,
                fullname: entry.fullname,
                points: entry.points,
                quizTimeHours: entry.quizTimeHours
            }))
        };
        
    } catch (error) {
        console.error("Error getting user ranking:", error);
        throw error;
    }
};

const PointsTable = mongoose.model("PointsTable", pointsTableSchema);

module.exports = PointsTable;

