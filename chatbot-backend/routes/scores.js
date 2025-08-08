const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/authMiddleware");
const QnALists = require("../models/QnALists");
const Chat = require("../models/Chat");
const Chapter = require("../models/Chapter");
const Book = require("../models/Book");
const User = require("../models/User");

console.log("📊 Scores Routes: Comprehensive scoring and progress system loaded");

// ================================================================
// 1. SCORE AND PROGRESS DETAILS API
// ================================================================

/**
 * @route GET /api/scores/progress-details/:userId
 * @desc Get comprehensive score and progress details
 * @access Private
 */
router.get("/progress-details/:userId", authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`📊 Fetching progress details for user: ${userId}`);

        // Verify user authorization
        if (req.user.userId !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: "Unauthorized access" 
            });
        }

        // Get all user's QnA records
        const qnaRecords = await QnALists.find({ studentId: userId })
            .populate('bookId', 'title subject grade publisher')
            .populate('chapterId', 'title')
            .sort({ updatedAt: -1 });

        const userChats = await Chat.find({ userId })
            .populate('chapterId', 'title')
            .sort({ lastActive: -1 });

        // Calculate statistics
        const stats = {
            booksStarted: new Set(),
            chaptersCompleted: new Set(),
            chaptersInProgress: new Set(),
            quizzesTaken: 0,
            totalQuestionsAnswered: 0,
            totalMarksEarned: 0,
            totalMarksAvailable: 0,
            totalTimeSpentMinutes: 0,
            subjects: new Map(),
            grades: new Map(),
            publishers: new Map()
        };

        // Process QnA records
        qnaRecords.forEach(record => {
            if (record.bookId) {
                stats.booksStarted.add(record.bookId._id.toString());
                
                // Track by subject
                const subject = record.bookId.subject || 'Unknown';
                if (!stats.subjects.has(subject)) {
                    stats.subjects.set(subject, {
                        questionsAnswered: 0,
                        marksEarned: 0,
                        marksAvailable: 0,
                        chaptersAttempted: new Set()
                    });
                }
                
                // Track by grade
                const grade = record.bookId.grade || 'Unknown';
                if (!stats.grades.has(grade)) {
                    stats.grades.set(grade, {
                        questionsAnswered: 0,
                        marksEarned: 0,
                        marksAvailable: 0,
                        booksAttempted: new Set()
                    });
                }

                // Track by publisher
                const publisher = record.bookId.publisher || 'Unknown';
                if (!stats.publishers.has(publisher)) {
                    stats.publishers.set(publisher, {
                        questionsAnswered: 0,
                        marksEarned: 0,
                        marksAvailable: 0,
                        booksAttempted: new Set()
                    });
                }
            }

            if (record.chapterId) {
                const chapterId = record.chapterId._id.toString();
                const answeredQuestions = record.qnaDetails.filter(q => q.status === 1);
                
                if (answeredQuestions.length > 0) {
                    stats.quizzesTaken++;
                    stats.chaptersInProgress.add(chapterId);
                    
                    const chapterMarksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                    const chapterMarksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);
                    
                    stats.totalQuestionsAnswered += answeredQuestions.length;
                    stats.totalMarksEarned += chapterMarksEarned;
                    stats.totalMarksAvailable += chapterMarksAvailable;
                    
                    // Check if chapter is completed (>= 80% questions answered)
                    const totalQuestions = record.qnaDetails.length;
                    const completionPercentage = (answeredQuestions.length / totalQuestions) * 100;
                    if (completionPercentage >= 80) {
                        stats.chaptersCompleted.add(chapterId);
                    }

                    // Update subject stats
                    if (record.bookId && record.bookId.subject) {
                        const subjectStats = stats.subjects.get(record.bookId.subject);
                        subjectStats.questionsAnswered += answeredQuestions.length;
                        subjectStats.marksEarned += chapterMarksEarned;
                        subjectStats.marksAvailable += chapterMarksAvailable;
                        subjectStats.chaptersAttempted.add(chapterId);
                    }

                    // Update grade stats
                    if (record.bookId && record.bookId.grade) {
                        const gradeStats = stats.grades.get(record.bookId.grade);
                        gradeStats.questionsAnswered += answeredQuestions.length;
                        gradeStats.marksEarned += chapterMarksEarned;
                        gradeStats.marksAvailable += chapterMarksAvailable;
                        gradeStats.booksAttempted.add(record.bookId._id.toString());
                    }

                    // Update publisher stats
                    if (record.bookId && record.bookId.publisher) {
                        const publisherStats = stats.publishers.get(record.bookId.publisher);
                        publisherStats.questionsAnswered += answeredQuestions.length;
                        publisherStats.marksEarned += chapterMarksEarned;
                        publisherStats.marksAvailable += chapterMarksAvailable;
                        publisherStats.booksAttempted.add(record.bookId._id.toString());
                    }
                }
            }
        });

        // Calculate time spent from chat sessions
        userChats.forEach(chat => {
            if (chat.metadata && chat.metadata.timeSpentMinutes) {
                stats.totalTimeSpentMinutes += chat.metadata.timeSpentMinutes;
            }
        });

        // Calculate overall score
        const overallScore = stats.totalMarksAvailable > 0 
            ? (stats.totalMarksEarned / stats.totalMarksAvailable) * 100 
            : 0;

        // Get chapter details for completed and in-progress chapters
        const completedChapterIds = Array.from(stats.chaptersCompleted);
        const inProgressChapterIds = Array.from(stats.chaptersInProgress).filter(id => !stats.chaptersCompleted.has(id));
        
        // Get chapter details from the database
        const completedChapters = await Chapter.find({ _id: { $in: completedChapterIds } }, 'title bookId');
        const inProgressChapters = await Chapter.find({ _id: { $in: inProgressChapterIds } }, 'title bookId');
        
        // Format response
        const response = {
            success: true,
            data: {
                userId,
                booksStarted: stats.booksStarted.size,
                chaptersCompleted: stats.chaptersCompleted.size,
                chaptersInProgress: inProgressChapterIds.length, // Use filtered in-progress count
                quizzesTaken: stats.quizzesTaken,
                totalQuestionsAnswered: stats.totalQuestionsAnswered,
                overallScore: parseFloat(overallScore.toFixed(2)),
                totalMarksEarned: parseFloat(stats.totalMarksEarned.toFixed(2)),
                totalMarksAvailable: parseFloat(stats.totalMarksAvailable.toFixed(2)),
                totalTimeSpentMinutes: stats.totalTimeSpentMinutes,
                totalTimeSpentHours: parseFloat((stats.totalTimeSpentMinutes / 60).toFixed(2)),
                chapterDetails: {
                    completed: completedChapters.map(chapter => ({
                        id: chapter._id,
                        title: chapter.title,
                        bookId: chapter.bookId
                    })),
                    inProgress: inProgressChapters.map(chapter => ({
                        id: chapter._id,
                        title: chapter.title,
                        bookId: chapter.bookId
                    }))
                },
                breakdown: {
                    bySubject: Array.from(stats.subjects.entries()).map(([subject, data]) => ({
                        subject,
                        questionsAnswered: data.questionsAnswered,
                        marksEarned: parseFloat(data.marksEarned.toFixed(2)),
                        marksAvailable: parseFloat(data.marksAvailable.toFixed(2)),
                        percentage: data.marksAvailable > 0 ? parseFloat(((data.marksEarned / data.marksAvailable) * 100).toFixed(2)) : 0,
                        chaptersAttempted: data.chaptersAttempted.size
                    })),
                    byGrade: Array.from(stats.grades.entries()).map(([grade, data]) => ({
                        grade,
                        questionsAnswered: data.questionsAnswered,
                        marksEarned: parseFloat(data.marksEarned.toFixed(2)),
                        marksAvailable: parseFloat(data.marksAvailable.toFixed(2)),
                        percentage: data.marksAvailable > 0 ? parseFloat(((data.marksEarned / data.marksAvailable) * 100).toFixed(2)) : 0,
                        booksAttempted: data.booksAttempted.size
                    })),
                    byPublisher: Array.from(stats.publishers.entries()).map(([publisher, data]) => ({
                        publisher,
                        questionsAnswered: data.questionsAnswered,
                        marksEarned: parseFloat(data.marksEarned.toFixed(2)),
                        marksAvailable: parseFloat(data.marksAvailable.toFixed(2)),
                        percentage: data.marksAvailable > 0 ? parseFloat(((data.marksEarned / data.marksAvailable) * 100).toFixed(2)) : 0,
                        booksAttempted: data.booksAttempted.size
                    }))
                }
            }
        };

        console.log(`📊 Progress details calculated for user ${userId}: ${overallScore.toFixed(1)}% overall`);
        res.json(response);

    } catch (error) {
        console.error("📊 Error fetching progress details:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to fetch progress details", 
            details: error.message 
        });
    }
});

// ================================================================
// 2. ASSESSMENT DATA API
// ================================================================

/**
 * @route GET /api/scores/assessment-data/:userId
 * @desc Get detailed assessment data with question-level insights
 * @access Private
 */
router.get("/assessment-data/:userId", authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;
        const { chapterId, bookId, subject, timeframe } = req.query;
        
        console.log(`📊 Fetching assessment data for user: ${userId}`);

        // Build query filters
        const queryFilter = { studentId: userId };
        if (chapterId) queryFilter.chapterId = chapterId;
        if (bookId) queryFilter.bookId = bookId;

        // Get assessment records
        let qnaRecords = await QnALists.find(queryFilter)
            .populate('bookId', 'title subject grade publisher')
            .populate('chapterId', 'title')
            .sort({ updatedAt: -1 });

        // Filter by subject if specified
        if (subject) {
            qnaRecords = qnaRecords.filter(record => 
                record.bookId && record.bookId.subject === subject
            );
        }

        // Filter by timeframe if specified
        if (timeframe) {
            const now = new Date();
            let startDate;
            
            switch (timeframe) {
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'quarter':
                    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                case 'year':
                    startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
            }
            
            if (startDate) {
                qnaRecords = qnaRecords.filter(record => 
                    new Date(record.updatedAt) >= startDate
                );
            }
        }

        // Process detailed assessment data
        const assessmentData = {
            totalAssessments: qnaRecords.length,
            questionDetails: [],
            performanceMetrics: {
                avgScore: 0,
                accuracyRate: 0,
                completionRate: 0,
                difficultyAnalysis: {
                    easy: { attempted: 0, correct: 0, avgScore: 0 },
                    medium: { attempted: 0, correct: 0, avgScore: 0 },
                    hard: { attempted: 0, correct: 0, avgScore: 0 }
                },
                topicStrengths: {},
                areasForImprovement: {},
                timeAnalysis: {
                    avgTimePerQuestion: 0,
                    fastestQuestion: null,
                    slowestQuestion: null
                }
            }
        };

        let totalQuestions = 0;
        let totalScore = 0;
        let totalMaxScore = 0;
        let correctAnswers = 0;
        let totalTimeSpent = 0;

        // Process each record
        qnaRecords.forEach(record => {
            const answeredQuestions = record.qnaDetails.filter(q => q.status === 1);
            
            answeredQuestions.forEach(qna => {
                totalQuestions++;
                totalScore += qna.score || 0;
                totalMaxScore += qna.questionMarks || 0;
                
                const scorePercentage = qna.questionMarks > 0 
                    ? (qna.score / qna.questionMarks) * 100 
                    : 0;
                
                if (scorePercentage >= 90) correctAnswers++;

                // Determine question difficulty (you might want to add this to your schema)
                const difficulty = qna.difficultyLevel || 'medium';
                if (assessmentData.performanceMetrics.difficultyAnalysis[difficulty]) {
                    assessmentData.performanceMetrics.difficultyAnalysis[difficulty].attempted++;
                    assessmentData.performanceMetrics.difficultyAnalysis[difficulty].avgScore += scorePercentage;
                    if (scorePercentage >= 90) {
                        assessmentData.performanceMetrics.difficultyAnalysis[difficulty].correct++;
                    }
                }

                // Topic analysis (based on subtopic)
                const topic = qna.subtopic || 'General';
                if (!assessmentData.performanceMetrics.topicStrengths[topic]) {
                    assessmentData.performanceMetrics.topicStrengths[topic] = {
                        attempted: 0,
                        avgScore: 0,
                        totalScore: 0
                    };
                }
                assessmentData.performanceMetrics.topicStrengths[topic].attempted++;
                assessmentData.performanceMetrics.topicStrengths[topic].totalScore += scorePercentage;

                // Store question details
                assessmentData.questionDetails.push({
                    questionId: qna.questionId,
                    questionText: qna.questionText,
                    answerText: qna.answerText,
                    score: qna.score,
                    maxScore: qna.questionMarks,
                    percentage: scorePercentage,
                    difficulty: difficulty,
                    topic: topic,
                    timestamp: qna.timestamp,
                    chapterTitle: record.chapterId?.title || 'Unknown Chapter',
                    bookTitle: record.bookId?.title || 'Unknown Book',
                    subject: record.bookId?.subject || 'Unknown'
                });
            });
        });

        // Calculate performance metrics
        if (totalQuestions > 0) {
            assessmentData.performanceMetrics.avgScore = (totalScore / totalMaxScore) * 100;
            assessmentData.performanceMetrics.accuracyRate = (correctAnswers / totalQuestions) * 100;
            assessmentData.performanceMetrics.completionRate = 100; // Since we only count answered questions
        }

        // Calculate difficulty analysis averages
        Object.keys(assessmentData.performanceMetrics.difficultyAnalysis).forEach(difficulty => {
            const diffData = assessmentData.performanceMetrics.difficultyAnalysis[difficulty];
            if (diffData.attempted > 0) {
                diffData.avgScore = diffData.avgScore / diffData.attempted;
                diffData.accuracyRate = (diffData.correct / diffData.attempted) * 100;
            }
        });

        // Calculate topic averages and identify strengths/weaknesses
        Object.keys(assessmentData.performanceMetrics.topicStrengths).forEach(topic => {
            const topicData = assessmentData.performanceMetrics.topicStrengths[topic];
            topicData.avgScore = topicData.totalScore / topicData.attempted;
            
            if (topicData.avgScore < 60) {
                assessmentData.performanceMetrics.areasForImprovement[topic] = topicData;
            }
        });

        // Sort question details by most recent
        assessmentData.questionDetails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const response = {
            success: true,
            data: {
                userId,
                filters: { chapterId, bookId, subject, timeframe },
                assessmentSummary: {
                    totalAssessments: assessmentData.totalAssessments,
                    totalQuestions,
                    avgScore: parseFloat(assessmentData.performanceMetrics.avgScore.toFixed(2)),
                    accuracyRate: parseFloat(assessmentData.performanceMetrics.accuracyRate.toFixed(2)),
                    completionRate: parseFloat(assessmentData.performanceMetrics.completionRate.toFixed(2))
                },
                performanceMetrics: assessmentData.performanceMetrics,
                questionDetails: assessmentData.questionDetails.slice(0, 100), // Limit to recent 100 questions
                totalQuestionDetails: assessmentData.questionDetails.length
            }
        };

        console.log(`📊 Assessment data retrieved for user ${userId}: ${totalQuestions} questions analyzed`);
        res.json(response);

    } catch (error) {
        console.error("📊 Error fetching assessment data:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to fetch assessment data", 
            details: error.message 
        });
    }
});

// ================================================================
// 3. SCORE BOARD API
// ================================================================

/**
 * @route GET /api/scores/scoreboard/:userId
 * @desc Get scoreboard data with quiz progress and points
 * @access Private
 */
router.get("/scoreboard/:userId", authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`📊 Fetching scoreboard data for user: ${userId}`);

        // Get user's quiz data
        const qnaRecords = await QnALists.find({ studentId: userId })
            .populate('bookId', 'title subject grade')
            .populate('chapterId', 'title')
            .sort({ updatedAt: -1 });

        const userChats = await Chat.find({ userId })
            .populate('chapterId', 'title')
            .sort({ lastActive: -1 });

        // Categorize quizzes
        const scoreboardData = {
            quizzesInProgress: [],
            completedQuizzes: [],
            totalHoursSpent: 0,
            totalPointsEarned: 0,
            streakData: {
                currentStreak: 0,
                longestStreak: 0,
                lastActivityDate: null
            },
            achievements: [],
            rankings: {
                weeklyRank: null,
                monthlyRank: null,
                overallRank: null
            }
        };

        let totalMinutesSpent = 0;

        // Process each quiz record
        qnaRecords.forEach(record => {
            const answeredQuestions = record.qnaDetails.filter(q => q.status === 1);
            const totalQuestions = record.qnaDetails.length;
            const completionPercentage = totalQuestions > 0 ? (answeredQuestions.length / totalQuestions) * 100 : 0;
            
            const quizMarksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
            const quizMarksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);
            const quizPercentage = quizMarksAvailable > 0 ? (quizMarksEarned / quizMarksAvailable) * 100 : 0;
            
            // Calculate points (you can adjust the point calculation formula)
            const pointsEarned = Math.round(quizMarksEarned * 10); // 10 points per mark
            scoreboardData.totalPointsEarned += pointsEarned;

            const quizData = {
                chapterId: record.chapterId?._id,
                chapterTitle: record.chapterId?.title || 'Unknown Chapter',
                bookTitle: record.bookId?.title || 'Unknown Book',
                subject: record.bookId?.subject || 'Unknown',
                grade: record.bookId?.grade || 'Unknown',
                questionsAnswered: answeredQuestions.length,
                totalQuestions,
                completionPercentage: parseFloat(completionPercentage.toFixed(1)),
                marksEarned: parseFloat(quizMarksEarned.toFixed(2)),
                marksAvailable: parseFloat(quizMarksAvailable.toFixed(2)),
                scorePercentage: parseFloat(quizPercentage.toFixed(1)),
                pointsEarned,
                lastAttempted: record.updatedAt,
                status: completionPercentage >= 80 ? 'completed' : 'in_progress'
            };

            if (completionPercentage >= 80) {
                scoreboardData.completedQuizzes.push(quizData);
            } else if (answeredQuestions.length > 0) {
                scoreboardData.quizzesInProgress.push(quizData);
            }
        });

        // Calculate time spent from chat sessions
        userChats.forEach(chat => {
            if (chat.metadata && chat.metadata.timeSpentMinutes) {
                totalMinutesSpent += chat.metadata.timeSpentMinutes;
            }
            // Also check for session-based time tracking
            if (chat.messages && chat.messages.length > 0) {
                // Estimate time based on message frequency (rough calculation)
                const sessionMinutes = Math.max(1, Math.min(30, chat.messages.length * 2));
                totalMinutesSpent += sessionMinutes;
            }
        });

        scoreboardData.totalHoursSpent = parseFloat((totalMinutesSpent / 60).toFixed(2));

        // Calculate streak data (simplified - you might want to implement more sophisticated logic)
        const recentActivities = [...qnaRecords]
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 30); // Look at last 30 activities

        if (recentActivities.length > 0) {
            scoreboardData.streakData.lastActivityDate = recentActivities[0].updatedAt;
            
            // Simple streak calculation (consecutive days with activity)
            const activityDates = recentActivities.map(activity => 
                new Date(activity.updatedAt).toDateString()
            );
            const uniqueDates = [...new Set(activityDates)].sort((a, b) => new Date(b) - new Date(a));
            
            let currentStreak = 0;
            const today = new Date().toDateString();
            
            for (let i = 0; i < uniqueDates.length; i++) {
                const daysDiff = Math.floor((new Date(today) - new Date(uniqueDates[i])) / (1000 * 60 * 60 * 24));
                if (daysDiff === currentStreak) {
                    currentStreak++;
                } else {
                    break;
                }
            }
            
            scoreboardData.streakData.currentStreak = currentStreak;
            scoreboardData.streakData.longestStreak = Math.max(currentStreak, uniqueDates.length);
        }

        // Generate achievements based on performance
        const achievements = [];
        
        if (scoreboardData.completedQuizzes.length >= 10) {
            achievements.push({
                id: 'quiz_master',
                title: 'Quiz Master',
                description: 'Completed 10+ quizzes',
                unlockedAt: new Date(),
                points: 100
            });
        }
        
        if (scoreboardData.totalPointsEarned >= 1000) {
            achievements.push({
                id: 'point_collector',
                title: 'Point Collector',
                description: 'Earned 1000+ points',
                unlockedAt: new Date(),
                points: 150
            });
        }
        
        if (scoreboardData.streakData.currentStreak >= 7) {
            achievements.push({
                id: 'week_warrior',
                title: 'Week Warrior',
                description: '7-day activity streak',
                unlockedAt: new Date(),
                points: 200
            });
        }

        scoreboardData.achievements = achievements;

        // Sort quizzes by last attempted (most recent first)
        scoreboardData.quizzesInProgress.sort((a, b) => new Date(b.lastAttempted) - new Date(a.lastAttempted));
        scoreboardData.completedQuizzes.sort((a, b) => new Date(b.lastAttempted) - new Date(a.lastAttempted));

        const response = {
            success: true,
            data: {
                userId,
                summary: {
                    totalQuizzesInProgress: scoreboardData.quizzesInProgress.length,
                    totalCompletedQuizzes: scoreboardData.completedQuizzes.length,
                    totalHoursSpent: scoreboardData.totalHoursSpent,
                    totalPointsEarned: scoreboardData.totalPointsEarned,
                    currentStreak: scoreboardData.streakData.currentStreak,
                    achievementsUnlocked: scoreboardData.achievements.length
                },
                quizzesInProgress: scoreboardData.quizzesInProgress,
                completedQuizzes: scoreboardData.completedQuizzes,
                achievements: scoreboardData.achievements,
                streakData: scoreboardData.streakData,
                rankings: scoreboardData.rankings // To be implemented with comparative data
            }
        };

        console.log(`📊 Scoreboard data retrieved for user ${userId}: ${scoreboardData.totalPointsEarned} points earned`);
        res.json(response);

    } catch (error) {
        console.error("📊 Error fetching scoreboard data:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to fetch scoreboard data", 
            details: error.message 
        });
    }
});

// ================================================================
// 4. RECENT ACTIVITY API
// ================================================================

/**
 * @route GET /api/scores/recent-activity/:userId
 * @desc Get recent learning activity and progress
 * @access Private
 */
router.get("/recent-activity/:userId", authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20, days = 30 } = req.query;
        
        console.log(`📊 Fetching recent activity for user: ${userId}`);

        // Calculate date range
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Get recent QnA activities
        const recentQnaRecords = await QnALists.find({ 
            studentId: userId,
            updatedAt: { $gte: startDate }
        })
        .populate('bookId', 'title subject grade bookCoverImgLink')
        .populate('chapterId', 'title')
        .sort({ updatedAt: -1 })
        .limit(parseInt(limit));

        // Get recent chat activities
        const recentChats = await Chat.find({ 
            userId,
            lastActive: { $gte: startDate }
        })
        .populate('chapterId', 'title')
        .sort({ lastActive: -1 })
        .limit(parseInt(limit));

        // Get all user's historical data for progress calculation
        const allQnaRecords = await QnALists.find({ studentId: userId })
            .populate('bookId', 'title subject grade bookCoverImgLink')
            .populate('chapterId', 'title');

        // Process recent activities
        const recentActivities = [];
        const activityMap = new Map();

        // Process QnA activities
        recentQnaRecords.forEach(record => {
            const answeredQuestions = record.qnaDetails.filter(q => q.status === 1);
            
            if (answeredQuestions.length > 0) {
                const activityKey = `${record.chapterId?._id}-${record.updatedAt.toDateString()}`;
                
                if (!activityMap.has(activityKey)) {
                    const marksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                    const marksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);
                    
                    activityMap.set(activityKey, {
                        type: 'quiz_completed',
                        chapterId: record.chapterId?._id,
                        chapterTitle: record.chapterId?.title || 'Unknown Chapter',
                        bookTitle: record.bookId?.title || 'Unknown Book',
                        subject: record.bookId?.subject || 'Unknown',
                        grade: record.bookId?.grade || 'Unknown',
                        questionsAnswered: answeredQuestions.length,
                        totalQuestions: record.qnaDetails.length,
                        marksEarned: parseFloat(marksEarned.toFixed(2)),
                        marksAvailable: parseFloat(marksAvailable.toFixed(2)),
                        scorePercentage: marksAvailable > 0 ? parseFloat(((marksEarned / marksAvailable) * 100).toFixed(1)) : 0,
                        timestamp: record.updatedAt,
                        pointsEarned: Math.round(marksEarned * 10)
                    });
                }
            }
        });

        // Process chat activities (chapter visits)
        recentChats.forEach(chat => {
            if (chat.chapterId) {
                const activityKey = `chat-${chat.chapterId._id}-${chat.lastActive.toDateString()}`;
                
                if (!activityMap.has(activityKey)) {
                    activityMap.set(activityKey, {
                        type: 'chapter_visited',
                        chapterId: chat.chapterId._id,
                        chapterTitle: chat.chapterId.title || 'Unknown Chapter',
                        messageCount: chat.messages ? chat.messages.length : 0,
                        timestamp: chat.lastActive
                    });
                }
            }
        });

        // Convert map to array and sort by timestamp
        recentActivities.push(...Array.from(activityMap.values()));
        recentActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Calculate recent books and overall progress
        const recentBooks = new Map();
        const chaptersCompleted = new Set();
        const chaptersInProgress = new Set();
        let totalQuestionsAnswered = 0;
        let totalMarksEarned = 0;
        let totalMarksAvailable = 0;

        // Process all historical data for progress calculation
        allQnaRecords.forEach(record => {
            if (record.bookId) {
                const bookId = record.bookId._id.toString();
                if (!recentBooks.has(bookId)) {
                    recentBooks.set(bookId, {
                        bookId,
                        title: record.bookId.title,
                        subject: record.bookId.subject,
                        grade: record.bookId.grade,
                        bookCoverImgLink: record.bookId.bookCoverImgLink, // <-- Add this line
                        chaptersAttempted: new Set(),
                        chaptersCompleted: new Set(),
                        questionsAnswered: 0,
                        marksEarned: 0,
                        marksAvailable: 0,
                        lastActivity: record.updatedAt
                    });
                }
                
                const bookData = recentBooks.get(bookId);
                const answeredQuestions = record.qnaDetails.filter(q => q.status === 1);
                
                if (answeredQuestions.length > 0) {
                    const chapterId = record.chapterId._id.toString();
                    bookData.chaptersAttempted.add(chapterId);
                    chaptersInProgress.add(chapterId);
                    
                    const chapterMarksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                    const chapterMarksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);
                    
                    bookData.questionsAnswered += answeredQuestions.length;
                    bookData.marksEarned += chapterMarksEarned;
                    bookData.marksAvailable += chapterMarksAvailable;
                    
                    totalQuestionsAnswered += answeredQuestions.length;
                    totalMarksEarned += chapterMarksEarned;
                    totalMarksAvailable += chapterMarksAvailable;
                    
                    // Check if chapter is completed (>= 80% questions answered)
                    const completionPercentage = (answeredQuestions.length / record.qnaDetails.length) * 100;
                    if (completionPercentage >= 80) {
                        bookData.chaptersCompleted.add(chapterId);
                        chaptersCompleted.add(chapterId);
                    }
                    
                    if (record.updatedAt > bookData.lastActivity) {
                        bookData.lastActivity = record.updatedAt;
                    }
                }
            }
        });

        // Format recent books data
        const recentBooksArray = Array.from(recentBooks.values()).map(book => ({
            bookId: book.bookId,
            title: book.title,
            subject: book.subject,
            grade: book.grade,
            bookCoverImgLink: book.bookCoverImgLink, // <-- Add this line
            chaptersAttempted: book.chaptersAttempted.size,
            chaptersCompleted: book.chaptersCompleted.size,
            questionsAnswered: book.questionsAnswered,
            marksEarned: parseFloat(book.marksEarned.toFixed(2)),
            marksAvailable: parseFloat(book.marksAvailable.toFixed(2)),
            progressPercentage: book.marksAvailable > 0 ? parseFloat(((book.marksEarned / book.marksAvailable) * 100).toFixed(1)) : 0,
            lastActivity: book.lastActivity
        }));

        // Sort by last activity
        recentBooksArray.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

        const overallProgressPercentage = totalMarksAvailable > 0 
            ? parseFloat(((totalMarksEarned / totalMarksAvailable) * 100).toFixed(1)) 
            : 0;

        const response = {
            success: true,
            data: {
                userId,
                timeframe: `Last ${days} days`,
                recentBooks: recentBooksArray.slice(0, 10), // Limit to 10 most recent books
                totalChaptersCompleted: chaptersCompleted.size,
                totalChaptersInProgress: chaptersInProgress.size,
                overallProgressPercentage,
                totalQuestionsAnswered,
                recentActivities: recentActivities.slice(0, parseInt(limit)),
                quizData: {
                    totalQuizzesTaken: recentActivities.filter(a => a.type === 'quiz_completed').length,
                    avgQuizScore: recentActivities
                        .filter(a => a.type === 'quiz_completed' && a.scorePercentage)
                        .reduce((sum, a, _, arr) => sum + a.scorePercentage / arr.length, 0),
                    totalPointsEarned: recentActivities
                        .filter(a => a.type === 'quiz_completed')
                        .reduce((sum, a) => sum + (a.pointsEarned || 0), 0)
                },
                activitySummary: {
                    totalActivities: recentActivities.length,
                    quizActivities: recentActivities.filter(a => a.type === 'quiz_completed').length,
                    chapterVisits: recentActivities.filter(a => a.type === 'chapter_visited').length,
                    mostActiveDay: null // You can implement day-wise analysis
                }
            }
        };

        console.log(`📊 Recent activity retrieved for user ${userId}: ${recentActivities.length} activities in last ${days} days`);
        res.json(response);

    } catch (error) {
        console.error("📊 Error fetching recent activity:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to fetch recent activity", 
            details: error.message 
        });
    }
});

// ================================================================
// 5. PERFORMANCE OVERVIEW API
// ================================================================

/**
 * @route GET /api/scores/performance-overview/:userId
 * @desc Get comprehensive performance overview with trends and insights
 * @access Private
 */
router.get("/performance-overview/:userId", authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;
        const { period = 'all' } = req.query;
        
        console.log(`📊 Fetching performance overview for user: ${userId}`);

        // Get all user data
        const qnaRecords = await QnALists.find({ studentId: userId })
            .populate('bookId', 'title subject grade')
            .populate('chapterId', 'title')
            .sort({ updatedAt: -1 });

        const userChats = await Chat.find({ userId })
            .populate('chapterId', 'title');

        const user = await User.findById(userId).select('username fullname grade createdAt');

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: "User not found" 
            });
        }

        // Initialize performance metrics
        const performanceOverview = {
            userInfo: {
                userId: user._id,
                username: user.username,
                fullname: user.fullname,
                grade: user.grade,
                memberSince: user.createdAt
            },
            overallMetrics: {
                totalQuestionsAnswered: 0,
                totalMarksEarned: 0,
                totalMarksAvailable: 0,
                overallScore: 0,
                totalTimeSpent: 0,
                booksStarted: new Set(),
                chaptersCompleted: new Set(),
                streakDays: 0
            },
            performanceTrends: {
                monthly: {},
                weekly: {},
                daily: {}
            },
            subjectAnalysis: {},
            strengthsAndWeaknesses: {
                strengths: [],
                weaknesses: [],
                recommendations: []
            },
            achievementMetrics: {
                accuracy: 0,
                consistency: 0,
                improvement: 0,
                difficulty: {
                    easy: { attempted: 0, accuracy: 0 },
                    medium: { attempted: 0, accuracy: 0 },
                    hard: { attempted: 0, accuracy: 0 }
                }
            },
            comparativeAnalysis: {
                gradeAverage: null,
                subjectRanking: null,
                percentile: null
            }
        };

        // Process QnA data
        const monthlyData = {};
        const weeklyData = {};
        const dailyData = {};
        const subjectPerformance = {};

        qnaRecords.forEach(record => {
            const answeredQuestions = record.qnaDetails.filter(q => q.status === 1);
            
            if (answeredQuestions.length > 0) {
                const date = new Date(record.updatedAt);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const weekKey = getWeekKey(date);
                const dayKey = date.toDateString();

                // Track book and chapter progress
                if (record.bookId) {
                    performanceOverview.overallMetrics.booksStarted.add(record.bookId._id.toString());
                }
                if (record.chapterId) {
                    const completionPercentage = (answeredQuestions.length / record.qnaDetails.length) * 100;
                    if (completionPercentage >= 80) {
                        performanceOverview.overallMetrics.chaptersCompleted.add(record.chapterId._id.toString());
                    }
                }

                answeredQuestions.forEach(qna => {
                    const score = qna.score || 0;
                    const maxScore = qna.questionMarks || 0;
                    const scorePercentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
                    
                    performanceOverview.overallMetrics.totalQuestionsAnswered++;
                    performanceOverview.overallMetrics.totalMarksEarned += score;
                    performanceOverview.overallMetrics.totalMarksAvailable += maxScore;

                    // Monthly trends
                    if (!monthlyData[monthKey]) {
                        monthlyData[monthKey] = { questions: 0, totalScore: 0, maxScore: 0 };
                    }
                    monthlyData[monthKey].questions++;
                    monthlyData[monthKey].totalScore += score;
                    monthlyData[monthKey].maxScore += maxScore;

                    // Weekly trends
                    if (!weeklyData[weekKey]) {
                        weeklyData[weekKey] = { questions: 0, totalScore: 0, maxScore: 0 };
                    }
                    weeklyData[weekKey].questions++;
                    weeklyData[weekKey].totalScore += score;
                    weeklyData[weekKey].maxScore += maxScore;

                    // Daily trends
                    if (!dailyData[dayKey]) {
                        dailyData[dayKey] = { questions: 0, totalScore: 0, maxScore: 0 };
                    }
                    dailyData[dayKey].questions++;
                    dailyData[dayKey].totalScore += score;
                    dailyData[dayKey].maxScore += maxScore;

                    // Subject analysis
                    const subject = record.bookId?.subject || 'Unknown';
                    if (!subjectPerformance[subject]) {
                        subjectPerformance[subject] = {
                            questions: 0,
                            totalScore: 0,
                            maxScore: 0,
                            chapters: new Set(),
                            difficulty: { easy: 0, medium: 0, hard: 0 }
                        };
                    }
                    subjectPerformance[subject].questions++;
                    subjectPerformance[subject].totalScore += score;
                    subjectPerformance[subject].maxScore += maxScore;
                    subjectPerformance[subject].chapters.add(record.chapterId?._id?.toString());

                    // Difficulty analysis
                    const difficulty = qna.difficultyLevel || 'medium';
                    if (performanceOverview.achievementMetrics.difficulty[difficulty]) {
                        performanceOverview.achievementMetrics.difficulty[difficulty].attempted++;
                        if (scorePercentage >= 70) {
                            performanceOverview.achievementMetrics.difficulty[difficulty].accuracy++;
                        }
                    }
                });
            }
        });

        // Calculate overall metrics
        if (performanceOverview.overallMetrics.totalMarksAvailable > 0) {
            performanceOverview.overallMetrics.overallScore = 
                (performanceOverview.overallMetrics.totalMarksEarned / performanceOverview.overallMetrics.totalMarksAvailable) * 100;
        }

        performanceOverview.overallMetrics.booksStarted = performanceOverview.overallMetrics.booksStarted.size;
        performanceOverview.overallMetrics.chaptersCompleted = performanceOverview.overallMetrics.chaptersCompleted.size;

        // Calculate achievement metrics
        const totalQuestions = performanceOverview.overallMetrics.totalQuestionsAnswered;
        if (totalQuestions > 0) {
            performanceOverview.achievementMetrics.accuracy = performanceOverview.overallMetrics.overallScore;
            
            // Calculate difficulty accuracy
            Object.keys(performanceOverview.achievementMetrics.difficulty).forEach(diff => {
                const diffData = performanceOverview.achievementMetrics.difficulty[diff];
                if (diffData.attempted > 0) {
                    diffData.accuracy = (diffData.accuracy / diffData.attempted) * 100;
                }
            });
        }

        // Format trend data
        performanceOverview.performanceTrends.monthly = Object.keys(monthlyData)
            .sort()
            .map(month => ({
                period: month,
                questionsAnswered: monthlyData[month].questions,
                averageScore: monthlyData[month].maxScore > 0 
                    ? (monthlyData[month].totalScore / monthlyData[month].maxScore) * 100 
                    : 0
            }));

        performanceOverview.performanceTrends.weekly = Object.keys(weeklyData)
            .sort()
            .slice(-12) // Last 12 weeks
            .map(week => ({
                period: week,
                questionsAnswered: weeklyData[week].questions,
                averageScore: weeklyData[week].maxScore > 0 
                    ? (weeklyData[week].totalScore / weeklyData[week].maxScore) * 100 
                    : 0
            }));

        performanceOverview.performanceTrends.daily = Object.keys(dailyData)
            .sort()
            .slice(-30) // Last 30 days
            .map(day => ({
                period: day,
                questionsAnswered: dailyData[day].questions,
                averageScore: dailyData[day].maxScore > 0 
                    ? (dailyData[day].totalScore / dailyData[day].maxScore) * 100 
                    : 0
            }));

        // Format subject analysis
        performanceOverview.subjectAnalysis = Object.keys(subjectPerformance).map(subject => {
            const data = subjectPerformance[subject];
            const avgScore = data.maxScore > 0 ? (data.totalScore / data.maxScore) * 100 : 0;
            
            return {
                subject,
                questionsAnswered: data.questions,
                averageScore: parseFloat(avgScore.toFixed(2)),
                chaptersAttempted: data.chapters.size,
                marksEarned: parseFloat(data.totalScore.toFixed(2)),
                marksAvailable: parseFloat(data.maxScore.toFixed(2)),
                grade: avgScore >= 80 ? 'A' : avgScore >= 70 ? 'B' : avgScore >= 60 ? 'C' : avgScore >= 50 ? 'D' : 'F'
            };
        }).sort((a, b) => b.averageScore - a.averageScore);

        // Identify strengths and weaknesses
        const strengths = performanceOverview.subjectAnalysis
            .filter(subject => subject.averageScore >= 80)
            .map(subject => subject.subject);
        
        const weaknesses = performanceOverview.subjectAnalysis
            .filter(subject => subject.averageScore < 60)
            .map(subject => subject.subject);

        performanceOverview.strengthsAndWeaknesses.strengths = strengths;
        performanceOverview.strengthsAndWeaknesses.weaknesses = weaknesses;

        // Generate recommendations
        const recommendations = [];
        if (weaknesses.length > 0) {
            recommendations.push(`Focus on improving performance in: ${weaknesses.join(', ')}`);
        }
        if (performanceOverview.achievementMetrics.difficulty.hard.attempted < 5) {
            recommendations.push("Try more challenging questions to improve problem-solving skills");
        }
        if (performanceOverview.overallMetrics.overallScore < 70) {
            recommendations.push("Spend more time reviewing concepts before attempting quizzes");
        }
        performanceOverview.strengthsAndWeaknesses.recommendations = recommendations;

        const response = {
            success: true,
            data: {
                ...performanceOverview,
                generatedAt: new Date(),
                period: period
            }
        };

        console.log(`📊 Performance overview generated for user ${userId}: ${performanceOverview.overallMetrics.overallScore.toFixed(1)}% overall score`);
        res.json(response);

    } catch (error) {
        console.error("📊 Error fetching performance overview:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to fetch performance overview", 
            details: error.message 
        });
    }
});

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

function getWeekKey(date) {
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// ================================================================
// TEST ENDPOINTS
// ================================================================

/**
 * @route GET /api/scores/test
 * @desc Test endpoint to verify scores routes are working
 * @access Public
 */
router.get("/test", (req, res) => {
    console.log("📊 Scores test endpoint called");
    res.json({ 
        success: true, 
        message: "Comprehensive scores API is working",
        version: "1.0.0",
        endpoints: [
            "GET /api/scores/progress-details/:userId",
            "GET /api/scores/assessment-data/:userId",
            "GET /api/scores/scoreboard/:userId", 
            "GET /api/scores/recent-activity/:userId",
            "GET /api/scores/performance-overview/:userId"
        ]
    });
});

console.log("📊 Scores Routes: All comprehensive scoring endpoints defined successfully");
module.exports = router; 