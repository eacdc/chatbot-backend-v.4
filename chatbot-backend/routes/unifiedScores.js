const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/authMiddleware");
const QnALists = require("../models/QnALists");
const Chat = require("../models/Chat");
const Chapter = require("../models/Chapter");
const Book = require("../models/Book");
const User = require("../models/User");

console.log("📊 Unified Scores API: Single comprehensive scoring and progress system loaded");

// ================================================================
// UNIFIED SCORES AND PROGRESS API
// ================================================================

/**
 * @route GET /api/unified-scores/:userId
 * @desc Get comprehensive score and progress data with optional filters
 * @access Private
 * @query {string} include - Comma-separated list of sections to include (basic,detailed,recent,scoreboard,assessment,trends)
 * @query {string} bookId - Filter by specific book
 * @query {string} subject - Filter by subject
 * @query {string} chapterId - Filter by specific chapter
 * @query {string} timeframe - Filter by timeframe (week,month,quarter,year)
 * @query {string} startDate - Custom start date (YYYY-MM-DD)
 * @query {string} endDate - Custom end date (YYYY-MM-DD)
 * @query {number} recentLimit - Limit for recent activities (default: 20)
 * @query {number} recentDays - Days for recent activities (default: 30)
 */
router.get("/:userId", authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params;
        const { 
            include = 'basic', 
            bookId, 
            subject, 
            chapterId,
            timeframe,
            startDate,
            endDate,
            recentLimit = 20,
            recentDays = 30
        } = req.query;

        console.log(`📊 Fetching unified scores for user: ${userId}`);
        console.log(`📊 Include sections: ${include}`);

        // Verify user authorization
        if (req.user.userId !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                error: "Unauthorized access" 
            });
        }

        // Parse included sections
        const includedSections = include.split(',').map(s => s.trim());
        const includeBasic = includedSections.includes('basic') || includedSections.includes('all');
        const includeDetailed = includedSections.includes('detailed') || includedSections.includes('all');
        const includeRecent = includedSections.includes('recent') || includedSections.includes('all');
        const includeScoreboard = includedSections.includes('scoreboard') || includedSections.includes('all');
        const includeAssessment = includedSections.includes('assessment') || includedSections.includes('all');
        const includeTrends = includedSections.includes('trends') || includedSections.includes('all');

        // Build base query for QnA records
        const qnaQuery = { studentId: userId };
        if (bookId) qnaQuery.bookId = bookId;
        if (chapterId) qnaQuery.chapterId = chapterId;

        // Add date filtering
        if (timeframe || startDate || endDate) {
            qnaQuery.updatedAt = {};
            
            if (timeframe) {
                const now = new Date();
                let filterStartDate;
                
                switch (timeframe) {
                    case 'week':
                        filterStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'month':
                        filterStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    case 'quarter':
                        filterStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                        break;
                    case 'year':
                        filterStartDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                        break;
                }
                
                if (filterStartDate) qnaQuery.updatedAt.$gte = filterStartDate;
            }
            
            if (startDate) qnaQuery.updatedAt.$gte = new Date(startDate);
            if (endDate) qnaQuery.updatedAt.$lte = new Date(endDate + 'T23:59:59.999Z');
        }

        // Get QnA records
        let qnaRecords = await QnALists.find(qnaQuery)
            .populate('bookId', 'title subject grade publisher bookCoverImgLink')
            .populate('chapterId', 'title')
            .sort({ updatedAt: -1 });

        // Filter by subject if specified
        if (subject) {
            qnaRecords = qnaRecords.filter(record => 
                record.bookId && record.bookId.subject === subject
            );
        }

        // Get chat data
        const chatQuery = { userId };
        if (includeRecent || includeBasic || includeDetailed) {
            var userChats = await Chat.find(chatQuery)
                .populate('chapterId', 'title')
                .sort({ lastActive: -1 });
        }

        // Get user info if needed
        let user = null;
        if (includeDetailed || includeTrends) {
            user = await User.findById(userId).select('username fullname grade createdAt');
        }

        // Initialize response structure
        const response = {
            success: true,
            data: {
                userId,
                timestamp: new Date(),
                filters: { bookId, subject, chapterId, timeframe, startDate, endDate }
            }
        };

        // ================================================================
        // BASIC STATISTICS (Always included or when requested)
        // ================================================================
        if (includeBasic) {
            const basicStats = {
                booksStarted: new Set(),
                chaptersCompleted: new Set(),
                chaptersInProgress: new Set(),
                quizzesTaken: 0,
                totalQuestionsAnswered: 0,
                totalMarksEarned: 0,
                totalMarksAvailable: 0,
                totalTimeSpentMinutes: 0,
                overallScore: 0
            };

            // Process QnA records for basic stats
            for (const record of qnaRecords) {
                if (record.bookId) {
                    basicStats.booksStarted.add(record.bookId._id.toString());
                }

                if (record.chapterId) {
                    const chapterId = record.chapterId._id.toString();
                    const answeredQuestions = record.qnaDetails.filter(q => q.status === 1);
                    
                    if (answeredQuestions.length > 0) {
                        basicStats.quizzesTaken++;
                        basicStats.chaptersInProgress.add(chapterId);
                        
                        const chapterMarksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                        const chapterMarksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);
                        
                        basicStats.totalQuestionsAnswered += answeredQuestions.length;
                        basicStats.totalMarksEarned += chapterMarksEarned;
                        basicStats.totalMarksAvailable += chapterMarksAvailable;
                        
                        // Check if chapter is completed (>= 80% questions answered)
                        try {
                            const chapter = await Chapter.findById(chapterId);
                            let totalQuestions = record.qnaDetails.length;
                            
                            if (chapter && chapter.questionPrompt && Array.isArray(chapter.questionPrompt)) {
                                totalQuestions = chapter.questionPrompt.length;
                            }
                            
                            const completionPercentage = (answeredQuestions.length / totalQuestions) * 100;
                            if (completionPercentage >= 80) {
                                basicStats.chaptersCompleted.add(chapterId);
                            }
                        } catch (err) {
                            console.error(`Error checking chapter completion for ${chapterId}:`, err);
                        }
                    }
                }
            }

            // Calculate time spent from chat sessions
            if (userChats) {
                userChats.forEach(chat => {
                    if (chat.metadata && chat.metadata.timeSpentMinutes) {
                        basicStats.totalTimeSpentMinutes += chat.metadata.timeSpentMinutes;
                    }
                });
            }

            // Calculate overall score
            basicStats.overallScore = basicStats.totalMarksAvailable > 0 
                ? (basicStats.totalMarksEarned / basicStats.totalMarksAvailable) * 100 
                : 0;

            response.data.basic = {
                booksStarted: basicStats.booksStarted.size,
                chaptersCompleted: basicStats.chaptersCompleted.size,
                chaptersInProgress: basicStats.chaptersInProgress.size - basicStats.chaptersCompleted.size,
                quizzesTaken: basicStats.quizzesTaken,
                totalQuestionsAnswered: basicStats.totalQuestionsAnswered,
                totalMarksEarned: parseFloat(basicStats.totalMarksEarned.toFixed(2)),
                totalMarksAvailable: parseFloat(basicStats.totalMarksAvailable.toFixed(2)),
                overallScore: parseFloat(basicStats.overallScore.toFixed(2)),
                totalTimeSpentMinutes: basicStats.totalTimeSpentMinutes,
                totalTimeSpentHours: parseFloat((basicStats.totalTimeSpentMinutes / 60).toFixed(2)),
                totalPointsEarned: Math.round(basicStats.totalMarksEarned * 10) // 10 points per mark
            };
        }

        // ================================================================
        // DETAILED BREAKDOWN
        // ================================================================
        if (includeDetailed) {
            const subjects = new Map();
            const grades = new Map();
            const publishers = new Map();
            const completedChapters = [];
            const inProgressChapters = [];

            // Process records for detailed breakdown
            for (const record of qnaRecords) {
                const answeredQuestions = record.qnaDetails.filter(q => q.status === 1);
                
                if (answeredQuestions.length > 0) {
                    const chapterMarksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                    const chapterMarksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);

                    // Track by subject
                    if (record.bookId && record.bookId.subject) {
                        const subject = record.bookId.subject;
                        if (!subjects.has(subject)) {
                            subjects.set(subject, {
                                questionsAnswered: 0,
                                marksEarned: 0,
                                marksAvailable: 0,
                                chaptersAttempted: new Set()
                            });
                        }
                        const subjectStats = subjects.get(subject);
                        subjectStats.questionsAnswered += answeredQuestions.length;
                        subjectStats.marksEarned += chapterMarksEarned;
                        subjectStats.marksAvailable += chapterMarksAvailable;
                        subjectStats.chaptersAttempted.add(record.chapterId._id.toString());
                    }

                    // Track by grade
                    if (record.bookId && record.bookId.grade) {
                        const grade = record.bookId.grade;
                        if (!grades.has(grade)) {
                            grades.set(grade, {
                                questionsAnswered: 0,
                                marksEarned: 0,
                                marksAvailable: 0,
                                booksAttempted: new Set()
                            });
                        }
                        const gradeStats = grades.get(grade);
                        gradeStats.questionsAnswered += answeredQuestions.length;
                        gradeStats.marksEarned += chapterMarksEarned;
                        gradeStats.marksAvailable += chapterMarksAvailable;
                        gradeStats.booksAttempted.add(record.bookId._id.toString());
                    }

                    // Track by publisher
                    if (record.bookId && record.bookId.publisher) {
                        const publisher = record.bookId.publisher;
                        if (!publishers.has(publisher)) {
                            publishers.set(publisher, {
                                questionsAnswered: 0,
                                marksEarned: 0,
                                marksAvailable: 0,
                                booksAttempted: new Set()
                            });
                        }
                        const publisherStats = publishers.get(publisher);
                        publisherStats.questionsAnswered += answeredQuestions.length;
                        publisherStats.marksEarned += chapterMarksEarned;
                        publisherStats.marksAvailable += chapterMarksAvailable;
                        publisherStats.booksAttempted.add(record.bookId._id.toString());
                    }

                    // Check chapter completion for detailed list
                    if (record.chapterId) {
                        const completionPercentage = (answeredQuestions.length / record.qnaDetails.length) * 100;
                        const chapterData = {
                            id: record.chapterId._id,
                            title: record.chapterId.title,
                            bookId: record.bookId._id,
                            bookTitle: record.bookId.title,
                            subject: record.bookId.subject,
                            questionsAnswered: answeredQuestions.length,
                            totalQuestions: record.qnaDetails.length,
                            completionPercentage: parseFloat(completionPercentage.toFixed(1)),
                            marksEarned: parseFloat(chapterMarksEarned.toFixed(2)),
                            marksAvailable: parseFloat(chapterMarksAvailable.toFixed(2)),
                            lastAttempted: record.updatedAt
                        };

                        if (completionPercentage >= 80) {
                            completedChapters.push(chapterData);
                        } else {
                            inProgressChapters.push(chapterData);
                        }
                    }
                }
            }

            response.data.detailed = {
                userInfo: user ? {
                    username: user.username,
                    fullname: user.fullname,
                    grade: user.grade,
                    memberSince: user.createdAt
                } : null,
                chapterDetails: {
                    completed: completedChapters,
                    inProgress: inProgressChapters
                },
                breakdown: {
                    bySubject: Array.from(subjects.entries()).map(([subject, data]) => ({
                        subject,
                        questionsAnswered: data.questionsAnswered,
                        marksEarned: parseFloat(data.marksEarned.toFixed(2)),
                        marksAvailable: parseFloat(data.marksAvailable.toFixed(2)),
                        percentage: data.marksAvailable > 0 ? parseFloat(((data.marksEarned / data.marksAvailable) * 100).toFixed(2)) : 0,
                        chaptersAttempted: data.chaptersAttempted.size
                    })),
                    byGrade: Array.from(grades.entries()).map(([grade, data]) => ({
                        grade,
                        questionsAnswered: data.questionsAnswered,
                        marksEarned: parseFloat(data.marksEarned.toFixed(2)),
                        marksAvailable: parseFloat(data.marksAvailable.toFixed(2)),
                        percentage: data.marksAvailable > 0 ? parseFloat(((data.marksEarned / data.marksAvailable) * 100).toFixed(2)) : 0,
                        booksAttempted: data.booksAttempted.size
                    })),
                    byPublisher: Array.from(publishers.entries()).map(([publisher, data]) => ({
                        publisher,
                        questionsAnswered: data.questionsAnswered,
                        marksEarned: parseFloat(data.marksEarned.toFixed(2)),
                        marksAvailable: parseFloat(data.marksAvailable.toFixed(2)),
                        percentage: data.marksAvailable > 0 ? parseFloat(((data.marksEarned / data.marksAvailable) * 100).toFixed(2)) : 0,
                        booksAttempted: data.booksAttempted.size
                    }))
                }
            };
        }

        // ================================================================
        // RECENT ACTIVITIES
        // ================================================================
        if (includeRecent) {
            const recentStartDate = new Date();
            recentStartDate.setDate(recentStartDate.getDate() - parseInt(recentDays));

            const recentQnaRecords = qnaRecords.filter(record => 
                new Date(record.updatedAt) >= recentStartDate
            ).slice(0, parseInt(recentLimit));

            const recentChats = userChats ? userChats.filter(chat => 
                new Date(chat.lastActive) >= recentStartDate
            ).slice(0, parseInt(recentLimit)) : [];

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

            // Process chat activities
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

            // Convert to array and sort
            recentActivities.push(...Array.from(activityMap.values()));
            recentActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            response.data.recent = {
                timeframe: `Last ${recentDays} days`,
                activities: recentActivities.slice(0, parseInt(recentLimit)),
                summary: {
                    totalActivities: recentActivities.length,
                    quizActivities: recentActivities.filter(a => a.type === 'quiz_completed').length,
                    chapterVisits: recentActivities.filter(a => a.type === 'chapter_visited').length,
                    totalPointsEarned: recentActivities
                        .filter(a => a.type === 'quiz_completed')
                        .reduce((sum, a) => sum + (a.pointsEarned || 0), 0)
                }
            };
        }

        // ================================================================
        // SCOREBOARD DATA
        // ================================================================
        if (includeScoreboard) {
            const completedQuizzes = [];
            const quizzesInProgress = [];
            let totalPointsEarned = 0;
            let totalMinutesSpent = 0;

            // Process quizzes for scoreboard
            qnaRecords.forEach(record => {
                const answeredQuestions = record.qnaDetails.filter(q => q.status === 1);
                const totalQuestions = record.qnaDetails.length;
                const completionPercentage = totalQuestions > 0 ? (answeredQuestions.length / totalQuestions) * 100 : 0;
                
                const quizMarksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                const quizMarksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);
                const quizPercentage = quizMarksAvailable > 0 ? (quizMarksEarned / quizMarksAvailable) * 100 : 0;
                
                const pointsEarned = Math.round(quizMarksEarned * 10);
                totalPointsEarned += pointsEarned;

                const quizData = {
                    chapterId: record.chapterId?._id,
                    chapterTitle: record.chapterId?.title || 'Unknown Chapter',
                    bookTitle: record.bookId?.title || 'Unknown Book',
                    subject: record.bookId?.subject || 'Unknown',
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
                    completedQuizzes.push(quizData);
                } else if (answeredQuestions.length > 0) {
                    quizzesInProgress.push(quizData);
                }
            });

            // Calculate time spent
            if (userChats) {
                userChats.forEach(chat => {
                    if (chat.metadata && chat.metadata.timeSpentMinutes) {
                        totalMinutesSpent += chat.metadata.timeSpentMinutes;
                    }
                });
            }

            // Simple streak calculation
            const recentActivities = [...qnaRecords]
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                .slice(0, 30);

            let currentStreak = 0;
            let longestStreak = 0;
            if (recentActivities.length > 0) {
                const activityDates = recentActivities.map(activity => 
                    new Date(activity.updatedAt).toDateString()
                );
                const uniqueDates = [...new Set(activityDates)];
                
                // Simple consecutive day calculation
                currentStreak = Math.min(uniqueDates.length, 7); // Cap at 7 days
                longestStreak = Math.min(uniqueDates.length, 30); // Cap at 30 days
            }

            response.data.scoreboard = {
                completedQuizzes: completedQuizzes.slice(0, 20), // Limit to 20
                quizzesInProgress: quizzesInProgress.slice(0, 20), // Limit to 20
                totalPointsEarned,
                totalHoursSpent: parseFloat((totalMinutesSpent / 60).toFixed(2)),
                streakData: {
                    currentStreak,
                    longestStreak,
                    lastActivityDate: recentActivities[0]?.updatedAt || null
                },
                summary: {
                    totalQuizzes: completedQuizzes.length + quizzesInProgress.length,
                    completedCount: completedQuizzes.length,
                    inProgressCount: quizzesInProgress.length,
                    averageScore: completedQuizzes.length > 0 
                        ? parseFloat((completedQuizzes.reduce((sum, q) => sum + q.scorePercentage, 0) / completedQuizzes.length).toFixed(1))
                        : 0
                }
            };
        }

        // ================================================================
        // ASSESSMENT ANALYSIS
        // ================================================================
        if (includeAssessment) {
            let totalQuestions = 0;
            let totalScore = 0;
            let totalMaxScore = 0;
            let correctAnswers = 0;
            const topicPerformance = {};
            const difficultyAnalysis = {
                easy: { attempted: 0, correct: 0, avgScore: 0 },
                medium: { attempted: 0, correct: 0, avgScore: 0 },
                hard: { attempted: 0, correct: 0, avgScore: 0 }
            };

            qnaRecords.forEach(record => {
                const answeredQuestions = record.qnaDetails.filter(q => q.status === 1);
                
                answeredQuestions.forEach(qna => {
                    totalQuestions++;
                    totalScore += qna.score || 0;
                    totalMaxScore += qna.questionMarks || 0;
                    
                    const scorePercentage = qna.questionMarks > 0 
                        ? (qna.score / qna.questionMarks) * 100 
                        : 0;
                    
                    if (scorePercentage >= 80) correctAnswers++;

                    // Track by subject/topic
                    const subject = record.bookId?.subject || 'Unknown';
                    if (!topicPerformance[subject]) {
                        topicPerformance[subject] = {
                            attempted: 0,
                            correct: 0,
                            totalScore: 0,
                            maxScore: 0
                        };
                    }
                    topicPerformance[subject].attempted++;
                    topicPerformance[subject].totalScore += qna.score || 0;
                    topicPerformance[subject].maxScore += qna.questionMarks || 0;
                    if (scorePercentage >= 80) topicPerformance[subject].correct++;

                    // Difficulty analysis (simplified)
                    const difficulty = qna.difficultyLevel || 'medium';
                    if (difficultyAnalysis[difficulty]) {
                        difficultyAnalysis[difficulty].attempted++;
                        if (scorePercentage >= 80) difficultyAnalysis[difficulty].correct++;
                    }
                });
            });

            // Calculate averages for difficulty analysis
            Object.keys(difficultyAnalysis).forEach(level => {
                const data = difficultyAnalysis[level];
                data.avgScore = data.attempted > 0 ? (data.correct / data.attempted) * 100 : 0;
            });

            // Find strengths and weaknesses
            const subjectAnalysis = Object.entries(topicPerformance).map(([subject, data]) => ({
                subject,
                attempted: data.attempted,
                accuracy: data.attempted > 0 ? (data.correct / data.attempted) * 100 : 0,
                avgScore: data.maxScore > 0 ? (data.totalScore / data.maxScore) * 100 : 0
            })).sort((a, b) => b.accuracy - a.accuracy);

            const strengths = subjectAnalysis.filter(s => s.accuracy >= 80).slice(0, 5);
            const weaknesses = subjectAnalysis.filter(s => s.accuracy < 60).slice(0, 5);

            response.data.assessment = {
                totalAssessments: qnaRecords.length,
                performanceMetrics: {
                    totalQuestions,
                    avgScore: totalMaxScore > 0 ? parseFloat(((totalScore / totalMaxScore) * 100).toFixed(2)) : 0,
                    accuracyRate: totalQuestions > 0 ? parseFloat(((correctAnswers / totalQuestions) * 100).toFixed(2)) : 0,
                    completionRate: qnaRecords.length > 0 ? parseFloat(((qnaRecords.filter(r => r.qnaDetails.filter(q => q.status === 1).length > 0).length / qnaRecords.length) * 100).toFixed(2)) : 0
                },
                difficultyAnalysis,
                subjectAnalysis,
                strengths,
                weaknesses,
                recommendations: weaknesses.length > 0 
                    ? [`Focus more on ${weaknesses[0].subject}`, "Practice more questions in weak areas", "Review incorrect answers"]
                    : ["Keep up the great work!", "Try more challenging questions", "Help others with your strong subjects"]
            };
        }

        // ================================================================
        // PERFORMANCE TRENDS
        // ================================================================
        if (includeTrends) {
            const monthlyData = {};
            const weeklyData = {};
            const dailyData = {};

            qnaRecords.forEach(record => {
                const answeredQuestions = record.qnaDetails.filter(q => q.status === 1);
                
                if (answeredQuestions.length > 0) {
                    const date = new Date(record.updatedAt);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const weekKey = getWeekKey(date);
                    const dayKey = date.toDateString();

                    const marksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                    const marksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);

                    // Monthly data
                    if (!monthlyData[monthKey]) {
                        monthlyData[monthKey] = { questionsAnswered: 0, marksEarned: 0, marksAvailable: 0, quizzes: 0 };
                    }
                    monthlyData[monthKey].questionsAnswered += answeredQuestions.length;
                    monthlyData[monthKey].marksEarned += marksEarned;
                    monthlyData[monthKey].marksAvailable += marksAvailable;
                    monthlyData[monthKey].quizzes++;

                    // Weekly data
                    if (!weeklyData[weekKey]) {
                        weeklyData[weekKey] = { questionsAnswered: 0, marksEarned: 0, marksAvailable: 0, quizzes: 0 };
                    }
                    weeklyData[weekKey].questionsAnswered += answeredQuestions.length;
                    weeklyData[weekKey].marksEarned += marksEarned;
                    weeklyData[weekKey].marksAvailable += marksAvailable;
                    weeklyData[weekKey].quizzes++;

                    // Daily data (last 30 days only)
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    if (date >= thirtyDaysAgo) {
                        if (!dailyData[dayKey]) {
                            dailyData[dayKey] = { questionsAnswered: 0, marksEarned: 0, marksAvailable: 0, quizzes: 0 };
                        }
                        dailyData[dayKey].questionsAnswered += answeredQuestions.length;
                        dailyData[dayKey].marksEarned += marksEarned;
                        dailyData[dayKey].marksAvailable += marksAvailable;
                        dailyData[dayKey].quizzes++;
                    }
                }
            });

            // Format trend data
            const formatTrendData = (data) => {
                return Object.entries(data).map(([period, stats]) => ({
                    period,
                    questionsAnswered: stats.questionsAnswered,
                    quizzes: stats.quizzes,
                    avgScore: stats.marksAvailable > 0 ? parseFloat(((stats.marksEarned / stats.marksAvailable) * 100).toFixed(2)) : 0,
                    marksEarned: parseFloat(stats.marksEarned.toFixed(2)),
                    marksAvailable: parseFloat(stats.marksAvailable.toFixed(2))
                })).sort((a, b) => a.period.localeCompare(b.period));
            };

            response.data.trends = {
                monthly: formatTrendData(monthlyData),
                weekly: formatTrendData(weeklyData),
                daily: formatTrendData(dailyData)
            };
        }

        console.log(`📊 Unified scores data compiled for user ${userId} with sections: ${include}`);
        res.json(response);

    } catch (error) {
        console.error("📊 Error fetching unified scores:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to fetch unified scores", 
            details: error.message 
        });
    }
});

// Helper function to get week key
function getWeekKey(date) {
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    return `${year}-W${String(week).padStart(2, '0')}`;
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Test endpoint
router.get("/test", (req, res) => {
    res.json({ 
        message: "Unified Scores API is working!",
        availableSections: [
            "basic - Basic statistics (default)",
            "detailed - Detailed breakdown by subject/grade/publisher with chapter lists", 
            "recent - Recent activities and timeline",
            "scoreboard - Gamification data with points and streaks",
            "assessment - Detailed assessment analysis with strengths/weaknesses",
            "trends - Performance trends over time (monthly/weekly/daily)",
            "all - Include all sections"
        ],
        sampleUsage: [
            "GET /api/unified-scores/USER_ID - Basic stats only",
            "GET /api/unified-scores/USER_ID?include=basic,recent - Basic stats + recent activities",
            "GET /api/unified-scores/USER_ID?include=all - Everything",
            "GET /api/unified-scores/USER_ID?include=basic&subject=Mathematics - Basic stats filtered by subject",
            "GET /api/unified-scores/USER_ID?include=detailed&timeframe=month - Detailed stats for last month"
        ]
    });
});

module.exports = router;
