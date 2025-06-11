const express = require("express");
const router = express.Router();
const QnALists = require("../models/QnALists");
const authenticateUser = require("../middleware/authMiddleware");

console.log("New stats routes loaded successfully with QnALists model");

router.get("/test", (req, res) => {
    res.json({ 
        success: true, 
        message: "New stats route working" 
    });
});

// Test endpoint without authentication to debug database issues
router.get("/user/:userId/debug", async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`🔍 Debug: Testing database connection for user: ${userId}`);

        // Test 1: Simple count
        const count = await QnALists.countDocuments({ studentId: userId });
        console.log(`🔍 Debug: Found ${count} records`);

        // Test 2: Get basic records
        const records = await QnALists.find({ studentId: userId }).limit(1);
        console.log(`🔍 Debug: Sample record:`, records[0] ? {
            studentId: records[0].studentId,
            bookId: records[0].bookId,
            chapterId: records[0].chapterId,
            qnaDetailsCount: records[0].qnaDetails?.length || 0
        } : "No records found");

        return res.json({
            success: true,
            debug: {
                userId,
                recordCount: count,
                hasRecords: count > 0,
                sampleRecord: records[0] ? {
                    studentId: records[0].studentId,
                    bookId: records[0].bookId,
                    chapterId: records[0].chapterId,
                    qnaDetailsCount: records[0].qnaDetails?.length || 0
                } : null
            }
        });
    } catch (error) {
        console.error("🔍 Debug error:", error);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

router.get("/user/:userId", authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`📊 Starting stats fetch for user: ${userId}`);

        // Step 1: Test basic database connection
        try {
            const testQuery = await QnALists.countDocuments({ studentId: userId });
            console.log(`📊 Found ${testQuery} QnALists records for user in database`);
        } catch (dbError) {
            console.error("📊 Database connection error:", dbError);
            return res.status(500).json({ 
                success: false, 
                error: "Database connection failed", 
                details: dbError.message 
            });
        }

        // Step 2: Get basic records without population first
        let userRecords;
        try {
            userRecords = await QnALists.find({ studentId: userId })
                .sort({ updatedAt: -1 });
            console.log(`📊 Found ${userRecords.length} basic QnALists records for user`);
        } catch (queryError) {
            console.error("📊 Basic query error:", queryError);
            return res.status(500).json({ 
                success: false, 
                error: "Failed to fetch basic records", 
                details: queryError.message 
            });
        }

        // Step 3: Try to populate references
        try {
            userRecords = await QnALists.find({ studentId: userId })
                .populate('bookId', 'title subject grade')
                .populate('chapterId', 'title')
                .sort({ updatedAt: -1 });
            console.log(`📊 Successfully populated ${userRecords.length} records`);
        } catch (populateError) {
            console.error("📊 Population error:", populateError);
            // Continue with unpopulated data
            console.log("📊 Continuing with unpopulated data");
        }

        if (!userRecords || userRecords.length === 0) {
            console.log(`📊 No records found for user ${userId}`);
            return res.json({
                success: true,
                data: {
                    totalBooksAttempted: 0,
                    totalChaptersAttempted: 0,
                    totalQuestionsAnswered: 0,
                    totalMarksEarned: 0,
                    totalMarksAvailable: 0,
                    overallPercentage: 0,
                    bookStats: [],
                    chapterStats: [],
                    recentActivity: []
                }
            });
        }

        console.log(`📊 Processing ${userRecords.length} records`);

        // Calculate overall statistics
        let totalQuestionsAnswered = 0;
        let totalMarksEarned = 0;
        let totalMarksAvailable = 0;
        const uniqueBooks = new Set();
        const uniqueChapters = new Set();

        // Process chapter statistics
        const chapterStats = [];
        const recentActivity = [];

        userRecords.forEach((record, index) => {
            console.log(`📊 Processing record ${index + 1}: chapterId=${record.chapterId}, qnaDetails count=${record.qnaDetails?.length || 0}`);
            
            if (!record.qnaDetails) {
                console.log(`📊 Record ${index + 1} has no qnaDetails`);
                return;
            }

            // Filter answered questions (status = 1)
            const answeredQuestions = record.qnaDetails.filter(q => q.status === 1);
            console.log(`📊 Record ${index + 1}: ${answeredQuestions.length} answered questions out of ${record.qnaDetails.length} total`);
            
            if (answeredQuestions.length > 0) {
                const chapterMarksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                const chapterMarksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);
                
                totalQuestionsAnswered += answeredQuestions.length;
                totalMarksEarned += chapterMarksEarned;
                totalMarksAvailable += chapterMarksAvailable;
                
                if (record.bookId) {
                    uniqueBooks.add(record.bookId._id ? record.bookId._id.toString() : record.bookId.toString());
                }
                uniqueChapters.add(record.chapterId._id ? record.chapterId._id.toString() : record.chapterId.toString());

                // Get performance breakdown
                const correctAnswers = answeredQuestions.filter(q => (q.score || 0) >= (q.questionMarks || 1) * 0.7).length;
                const partialAnswers = answeredQuestions.filter(q => (q.score || 0) > 0 && (q.score || 0) < (q.questionMarks || 1) * 0.7).length;
                const incorrectAnswers = answeredQuestions.filter(q => (q.score || 0) === 0).length;

                // Calculate time spent
                const attempts = answeredQuestions.sort((a, b) => new Date(a.attemptedAt) - new Date(b.attemptedAt));
                let timeSpentMinutes = 0;
                if (attempts.length > 1) {
                    const firstAttempt = new Date(attempts[0].attemptedAt);
                    const lastAttempt = new Date(attempts[attempts.length - 1].attemptedAt);
                    timeSpentMinutes = Math.round((lastAttempt - firstAttempt) / 60000);
                }

                // Determine completion status
                let completionStatus = 'not_started';
                if (answeredQuestions.length === 0) {
                    completionStatus = 'not_started';
                } else if (answeredQuestions.length >= record.qnaDetails.length * 0.8) {
                    completionStatus = 'completed';
                } else {
                    completionStatus = 'in_progress';
                }

                chapterStats.push({
                    chapterId: record.chapterId._id || record.chapterId,
                    chapterTitle: record.chapterId.title || `Chapter ${record.chapterId}`,
                    bookId: record.bookId ? (record.bookId._id || record.bookId) : null,
                    bookTitle: record.bookId ? (record.bookId.title || 'Unknown Book') : 'Unknown Book',
                    subject: record.bookId ? (record.bookId.subject || 'Unknown') : 'Unknown',
                    grade: record.bookId ? (record.bookId.grade || 'Unknown') : 'Unknown',
                    questionsAnswered: answeredQuestions.length,
                    totalQuestions: record.qnaDetails.length,
                    marksEarned: chapterMarksEarned,
                    marksAvailable: chapterMarksAvailable,
                    percentage: chapterMarksAvailable > 0 ? (chapterMarksEarned / chapterMarksAvailable) * 100 : 0,
                    correctAnswers,
                    partialAnswers,
                    incorrectAnswers,
                    timeSpentMinutes,
                    lastAttempted: attempts.length > 0 ? attempts[attempts.length - 1].attemptedAt : null,
                    firstAttempted: attempts.length > 0 ? attempts[0].attemptedAt : null,
                    completionStatus: completionStatus
                });

                // Add to recent activity
                answeredQuestions.forEach(q => {
                    recentActivity.push({
                        questionId: q.questionId,
                        questionText: (q.questionText || 'Question').substring(0, 100) + '...',
                        score: q.score || 0,
                        questionMarks: q.questionMarks || 1,
                        percentage: (q.questionMarks || 1) > 0 ? ((q.score || 0) / (q.questionMarks || 1)) * 100 : 0,
                        attemptedAt: q.attemptedAt,
                        chapterTitle: record.chapterId.title || `Chapter ${record.chapterId}`,
                        bookTitle: record.bookId ? (record.bookId.title || 'Unknown Book') : 'Unknown Book',
                        subject: record.bookId ? (record.bookId.subject || 'Unknown') : 'Unknown'
                    });
                });
            }
        });

        // Sort recent activity by date and take last 10
        recentActivity.sort((a, b) => new Date(b.attemptedAt) - new Date(a.attemptedAt));
        const limitedRecentActivity = recentActivity.slice(0, 10);

        const response = {
            success: true,
            data: {
                totalBooksAttempted: uniqueBooks.size,
                totalChaptersAttempted: uniqueChapters.size,
                totalQuestionsAnswered,
                totalMarksEarned,
                totalMarksAvailable,
                overallPercentage: totalMarksAvailable > 0 ? (totalMarksEarned / totalMarksAvailable) * 100 : 0,
                bookStats: [], // Can be implemented later if needed
                chapterStats: chapterStats.sort((a, b) => new Date(b.lastAttempted || 0) - new Date(a.lastAttempted || 0)),
                recentActivity: limitedRecentActivity
            }
        };

        console.log(`📊 Stats computed successfully for user ${userId}:`, {
            totalBooks: uniqueBooks.size,
            totalChapters: uniqueChapters.size,
            totalQuestions: totalQuestionsAnswered,
            overallPercentage: response.data.overallPercentage.toFixed(1)
        });

        res.json(response);

    } catch (error) {
        console.error("📊 Unexpected error in stats route:", error);
        console.error("📊 Error stack:", error.stack);
        res.status(500).json({ 
            success: false, 
            error: "Failed to fetch statistics", 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router; 