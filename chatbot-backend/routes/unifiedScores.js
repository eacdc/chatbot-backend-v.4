const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/authMiddleware");
const QnALists = require("../models/QnALists");
const Chat = require("../models/Chat");
const Chapter = require("../models/Chapter");
const Book = require("../models/Book");
const User = require("../models/User");
const Session = require("../models/Session");

console.log("📊 Unified Scores API: Session-based scoring system loaded");

// Helper function to get the last session's qnaDetails from a QnALists record
function getLastSessionData(record) {
    if (!record || !record.sessions || record.sessions.length === 0) {
        return { qnaDetails: [], session: null };
    }
    // Get the last session (most recent)
    const lastSession = record.sessions[record.sessions.length - 1];
    return {
        qnaDetails: lastSession.qnaDetails || [],
        session: lastSession
    };
}

// Helper function to get the last session from a Chat record
function getChatLastSession(chat) {
    if (!chat || !chat.sessions || chat.sessions.length === 0) {
        return null;
    }
    return chat.sessions[chat.sessions.length - 1];
}

// Helper function to calculate date range from timeframe or custom dates
function getDateRange(timeframe, startDate, endDate) {
    let dateStart = null;
    let dateEnd = null;
    
    if (timeframe) {
        const now = new Date();
        switch (timeframe) {
            case 'week':
                dateStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                dateStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'quarter':
                dateStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case 'year':
                dateStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
        }
        dateEnd = now;
    }
    
    if (startDate) {
        dateStart = new Date(startDate);
    }
    
    if (endDate) {
        dateEnd = new Date(endDate + 'T23:59:59.999Z');
    }
    
    return { dateStart, dateEnd };
}

// Helper function to check if a date is within range
function isDateInRange(date, dateStart, dateEnd) {
    if (!date) return false;
    const checkDate = new Date(date);
    if (dateStart && checkDate < dateStart) return false;
    if (dateEnd && checkDate > dateEnd) return false;
    return true;
}

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

        // Calculate date range for filtering
        const { dateStart, dateEnd } = getDateRange(timeframe, startDate, endDate);

        // Build base query for QnA records
        const qnaQuery = { studentId: userId };
        if (bookId) qnaQuery.bookId = bookId;
        if (chapterId) qnaQuery.chapterId = chapterId;

        // Add date filtering to QnA query
        if (dateStart || dateEnd) {
            qnaQuery.updatedAt = {};
            if (dateStart) qnaQuery.updatedAt.$gte = dateStart;
            if (dateEnd) qnaQuery.updatedAt.$lte = dateEnd;
        }

        // Get QnA records
        let qnaRecords = await QnALists.find(qnaQuery)
            .populate('bookId', 'title subject grade publisher bookCoverImgLink')
            .populate('chapterId', 'title')
            .sort({ updatedAt: -1 });

        // Filter QnA records by date at session level (check last session's updatedAt)
        if (dateStart || dateEnd) {
            qnaRecords = qnaRecords.filter(record => {
                if (!record.sessions || record.sessions.length === 0) return false;
                const lastSession = record.sessions[record.sessions.length - 1];
                return isDateInRange(lastSession.updatedAt || lastSession.createdAt, dateStart, dateEnd);
            });
        }

        // Filter by subject if specified
        if (subject) {
            qnaRecords = qnaRecords.filter(record => 
                record.bookId && record.bookId.subject === subject
            );
        }

        // Get chat data with date filtering
        const chatQuery = { userId };
        if (includeRecent || includeBasic || includeDetailed || includeScoreboard) {
            var userChats = await Chat.find(chatQuery)
                .populate('chapterId', 'title')
                .sort({ updatedAt: -1 });
            
            // Filter chat sessions by date (check last session's endTime or updatedAt)
            if (dateStart || dateEnd) {
                userChats = userChats.filter(chat => {
                    if (!chat.sessions || chat.sessions.length === 0) return false;
                    const lastSession = chat.sessions[chat.sessions.length - 1];
                    const sessionDate = lastSession.endTime || lastSession.updatedAt || lastSession.createdAt;
                    return isDateInRange(sessionDate, dateStart, dateEnd);
                });
            }
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
                filters: { 
                    bookId, 
                    subject, 
                    chapterId, 
                    timeframe, 
                    startDate, 
                    endDate,
                    dateRange: {
                        start: dateStart || null,
                        end: dateEnd || null
                    }
                }
            }
        };

        // ================================================================
        // BASIC STATISTICS (Always included or when requested)
        // Uses LAST SESSION data only
        // ================================================================
        if (includeBasic) {
            const basicStats = {
                booksStarted: new Set(),
                chaptersCompleted: new Set(),
                chaptersInProgress: new Set(),
                chaptersNotStarted: 0,  // Will be calculated from total chapters
                quizzesTaken: 0,
                totalQuestionsAnswered: 0,
                totalMarksEarned: 0,
                totalMarksAvailable: 0,
                totalTimeSpentMinutes: 0,
                overallScore: 0
            };
            
            // Track all chapters for "not started" calculation
            const allChaptersAttempted = new Set();

            // Process QnA records for basic stats - using LAST SESSION only
            for (const record of qnaRecords) {
                if (record.bookId) {
                    basicStats.booksStarted.add(record.bookId._id.toString());
                }

                if (record.chapterId) {
                    const chapterIdStr = record.chapterId._id.toString();
                    allChaptersAttempted.add(chapterIdStr);
                    
                    // Get last session data
                    const { qnaDetails, session } = getLastSessionData(record);
                    const answeredQuestions = qnaDetails.filter(q => q.status === 1);
                    
                    if (answeredQuestions.length > 0) {
                        basicStats.quizzesTaken++;
                        basicStats.chaptersInProgress.add(chapterIdStr);
                        
                        const chapterMarksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                        const chapterMarksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);
                        
                        basicStats.totalQuestionsAnswered += answeredQuestions.length;
                        basicStats.totalMarksEarned += chapterMarksEarned;
                        basicStats.totalMarksAvailable += chapterMarksAvailable;
                        
                        // Check if chapter is completed
                        try {
                            const chapter = await Chapter.findById(chapterIdStr);
                            if (chapter && chapter.questionPrompt && Array.isArray(chapter.questionPrompt)) {
                                const totalQuestions = chapter.questionPrompt.length;
                                if (answeredQuestions.length >= totalQuestions) {
                                    basicStats.chaptersCompleted.add(chapterIdStr);
                                }
                            }
                        } catch (err) {
                            console.error(`Error checking chapter completion for ${chapterIdStr}:`, err);
                        }
                    }
                }
            }

            // Calculate overall score
            basicStats.overallScore = basicStats.totalMarksAvailable > 0 
                ? (basicStats.totalMarksEarned / basicStats.totalMarksAvailable) * 100 
                : 0;

            // Get total chapters count for "not started" calculation
            let totalChaptersInBooks = 0;
            try {
                // Get all books that user has started
                const bookIds = Array.from(basicStats.booksStarted);
                if (bookIds.length > 0) {
                    const chapters = await Chapter.find({ bookId: { $in: bookIds } }).select('_id');
                    totalChaptersInBooks = chapters.length;
                }
            } catch (err) {
                console.error("Error getting total chapters:", err);
            }
            
            const chaptersNotStarted = Math.max(0, totalChaptersInBooks - allChaptersAttempted.size);

            // Calculate Quiz Time from Chat collection (last session totalTime) - filtered by date
            let quizTimeMs = 0;
            if (userChats) {
                for (const chat of userChats) {
                    const lastSession = getChatLastSession(chat);
                    if (lastSession && lastSession.totalTime) {
                        // Check if session is within date range
                        const sessionDate = lastSession.endTime || lastSession.updatedAt || lastSession.createdAt;
                        if (isDateInRange(sessionDate, dateStart, dateEnd)) {
                            quizTimeMs += lastSession.totalTime;
                        }
                    }
                }
            }
            const quizTimeMinutes = Math.round(quizTimeMs / 60000);

            // Calculate Learning Time from Session collection - filtered by date
            let learningTimeMinutes = 0;
            try {
                const learningQuery = { 
                    userId: userId,
                    status: "closed",
                    sessionType: "Learning",
                    timeTaken: { $ne: null }
                };
                
                // Add date filtering to learning sessions
                if (dateStart || dateEnd) {
                    learningQuery.updatedAt = {};
                    if (dateStart) learningQuery.updatedAt.$gte = dateStart;
                    if (dateEnd) learningQuery.updatedAt.$lte = dateEnd;
                }
                
                const learningSessions = await Session.find(learningQuery);
                learningTimeMinutes = learningSessions.reduce((sum, session) => {
                    return sum + (session.timeTaken || 0);
                }, 0);
            } catch (err) {
                console.error("Error fetching learning sessions:", err);
            }

            // Total Time = Quiz + Learning
            const totalTimeMinutes = quizTimeMinutes + learningTimeMinutes;

            response.data.basic = {
                booksStarted: basicStats.booksStarted.size,
                chaptersCompleted: basicStats.chaptersCompleted.size,
                chaptersInProgress: basicStats.chaptersInProgress.size - basicStats.chaptersCompleted.size,
                chaptersNotStarted: chaptersNotStarted,
                totalChaptersInBooks: totalChaptersInBooks,
                quizzesTaken: basicStats.quizzesTaken,
                totalQuestionsAnswered: basicStats.totalQuestionsAnswered,
                totalMarksEarned: parseFloat(basicStats.totalMarksEarned.toFixed(2)),
                totalMarksAvailable: parseFloat(basicStats.totalMarksAvailable.toFixed(2)),
                overallScore: parseFloat(basicStats.overallScore.toFixed(2)),
                totalTimeSpentMinutes: totalTimeMinutes,
                totalTimeSpentHours: parseFloat((totalTimeMinutes / 60).toFixed(2)),
                quizTimeSpentMinutes: quizTimeMinutes,
                quizTimeSpentHours: parseFloat((quizTimeMinutes / 60).toFixed(2)),
                learningTimeSpentMinutes: learningTimeMinutes,
                learningTimeSpentHours: parseFloat((learningTimeMinutes / 60).toFixed(2)),
                totalPointsEarned: parseFloat(basicStats.totalMarksEarned.toFixed(2))  // Same as earned marks (no multiplication)
            };
        }

        // ================================================================
        // DETAILED BREAKDOWN - Uses LAST SESSION data only
        // ================================================================
        if (includeDetailed) {
            const subjects = new Map();
            const grades = new Map();
            const publishers = new Map();
            const completedChapters = [];
            const inProgressChapters = [];

            // Process records for detailed breakdown
            for (const record of qnaRecords) {
                // Get last session data
                const { qnaDetails, session } = getLastSessionData(record);
                const answeredQuestions = qnaDetails.filter(q => q.status === 1);
                
                if (answeredQuestions.length > 0) {
                    const chapterMarksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                    const chapterMarksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);

                    // Track by subject
                    if (record.bookId && record.bookId.subject) {
                        const subjectName = record.bookId.subject;
                        if (!subjects.has(subjectName)) {
                            subjects.set(subjectName, {
                                questionsAnswered: 0,
                                marksEarned: 0,
                                marksAvailable: 0,
                                chaptersAttempted: new Set()
                            });
                        }
                        const subjectStats = subjects.get(subjectName);
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
                        let totalQuestions = qnaDetails.length;
                        let isCompleted = false;
                        
                        try {
                            const chapter = await Chapter.findById(record.chapterId._id);
                            if (chapter && chapter.questionPrompt && Array.isArray(chapter.questionPrompt)) {
                                totalQuestions = chapter.questionPrompt.length;
                                isCompleted = answeredQuestions.length >= totalQuestions;
                            }
                        } catch (err) {
                            console.error(`Error getting chapter data for ${record.chapterId._id}:`, err);
                        }
                        
                        const completionPercentage = totalQuestions > 0 ? (answeredQuestions.length / totalQuestions) * 100 : 0;
                        const chapterData = {
                            id: record.chapterId._id,
                            title: record.chapterId.title,
                            bookId: record.bookId._id,
                            bookTitle: record.bookId.title,
                            subject: record.bookId.subject,
                            questionsAnswered: answeredQuestions.length,
                            totalQuestions: totalQuestions,
                            completionPercentage: parseFloat(completionPercentage.toFixed(1)),
                            marksEarned: parseFloat(chapterMarksEarned.toFixed(2)),
                            marksAvailable: parseFloat(chapterMarksAvailable.toFixed(2)),
                            scorePercentage: session ? session.scorePercentage : 0,
                            sessionStatus: session ? session.sessionStatus : null,
                            sessionId: session ? session.sessionId : null,
                            lastAttempted: record.updatedAt
                        };

                        if (isCompleted) {
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
                    bySubject: Array.from(subjects.entries()).map(([subjectName, data]) => ({
                        subject: subjectName,
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
        // RECENT ACTIVITIES - Uses LAST SESSION data only
        // ================================================================
        if (includeRecent) {
            const recentStartDate = new Date();
            recentStartDate.setDate(recentStartDate.getDate() - parseInt(recentDays));

            const recentQnaRecords = qnaRecords.filter(record => 
                new Date(record.updatedAt) >= recentStartDate
            ).slice(0, parseInt(recentLimit));

            const recentChats = userChats ? userChats.filter(chat => 
                new Date(chat.updatedAt) >= recentStartDate
            ).slice(0, parseInt(recentLimit)) : [];

            const recentActivities = [];
            const activityMap = new Map();

            // Process QnA activities
            recentQnaRecords.forEach(record => {
                const { qnaDetails, session } = getLastSessionData(record);
                const answeredQuestions = qnaDetails.filter(q => q.status === 1);
                
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
                            totalQuestions: qnaDetails.length,
                            marksEarned: parseFloat(marksEarned.toFixed(2)),
                            marksAvailable: parseFloat(marksAvailable.toFixed(2)),
                            scorePercentage: session ? session.scorePercentage : (marksAvailable > 0 ? parseFloat(((marksEarned / marksAvailable) * 100).toFixed(1)) : 0),
                            sessionId: session ? session.sessionId : null,
                            sessionStatus: session ? session.sessionStatus : null,
                            timestamp: record.updatedAt,
                            pointsEarned: parseFloat(marksEarned.toFixed(2))  // Same as earned marks
                        });
                    }
                }
            });

            // Process chat activities
            recentChats.forEach(chat => {
                if (chat.chapterId) {
                    const lastSession = getChatLastSession(chat);
                    const activityKey = `chat-${chat.chapterId._id}-${chat.updatedAt.toDateString()}`;
                    
                    if (!activityMap.has(activityKey)) {
                        activityMap.set(activityKey, {
                            type: 'chapter_visited',
                            chapterId: chat.chapterId._id,
                            chapterTitle: chat.chapterId.title || 'Unknown Chapter',
                            messageCount: lastSession ? lastSession.messages.length : 0,
                            sessionId: lastSession ? lastSession.sessionId : null,
                            sessionStatus: lastSession ? lastSession.sessionStatus : null,
                            timestamp: chat.updatedAt
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
        // SCOREBOARD DATA - Uses LAST SESSION data only
        // ================================================================
        if (includeScoreboard) {
            const completedQuizzes = [];
            const quizzesInProgress = [];
            let totalPointsEarned = 0;

            // Process quizzes for scoreboard
            for (const record of qnaRecords) {
                const { qnaDetails, session } = getLastSessionData(record);
                const answeredQuestions = qnaDetails.filter(q => q.status === 1);
                
                if (answeredQuestions.length === 0) continue;
                
                const quizMarksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                const quizMarksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);
                const quizPercentage = quizMarksAvailable > 0 ? (quizMarksEarned / quizMarksAvailable) * 100 : 0;
                
                const pointsEarned = parseFloat(quizMarksEarned.toFixed(2));  // Same as earned marks
                totalPointsEarned += pointsEarned;

                let actualTotalQuestions = qnaDetails.length;
                let isCompleted = false;
                
                try {
                    const chapter = await Chapter.findById(record.chapterId?._id);
                    if (chapter && chapter.questionPrompt && Array.isArray(chapter.questionPrompt)) {
                        actualTotalQuestions = chapter.questionPrompt.length;
                        isCompleted = answeredQuestions.length >= actualTotalQuestions;
                    }
                } catch (err) {
                    console.error(`Error getting chapter data for quiz ${record.chapterId?._id}:`, err);
                }
                
                const actualCompletionPercentage = actualTotalQuestions > 0 ? 
                    (answeredQuestions.length / actualTotalQuestions) * 100 : 0;
                
                const quizData = {
                    chapterId: record.chapterId?._id,
                    chapterTitle: record.chapterId?.title || 'Unknown Chapter',
                    bookTitle: record.bookId?.title || 'Unknown Book',
                    subject: record.bookId?.subject || 'Unknown',
                    questionsAnswered: answeredQuestions.length,
                    totalQuestions: actualTotalQuestions,
                    completionPercentage: parseFloat(actualCompletionPercentage.toFixed(1)),
                    marksEarned: parseFloat(quizMarksEarned.toFixed(2)),
                    marksAvailable: parseFloat(quizMarksAvailable.toFixed(2)),
                    scorePercentage: session ? session.scorePercentage : parseFloat(quizPercentage.toFixed(1)),
                    pointsEarned,
                    sessionId: session ? session.sessionId : null,
                    sessionStatus: session ? session.sessionStatus : null,
                    startSessionAfter: session ? session.startSessionAfter : null,
                    lastAttempted: record.updatedAt,
                    status: isCompleted ? 'completed' : 'in_progress'
                };

                if (isCompleted || (session && session.sessionStatus === 'closed')) {
                    completedQuizzes.push(quizData);
                } else {
                    quizzesInProgress.push(quizData);
                }
            }

            // Calculate Quiz Time from Chat collection (last session totalTime) - filtered by date
            let quizTimeMs = 0;
            if (userChats) {
                for (const chat of userChats) {
                    const lastSession = getChatLastSession(chat);
                    if (lastSession && lastSession.totalTime) {
                        // Check if session is within date range
                        const sessionDate = lastSession.endTime || lastSession.updatedAt || lastSession.createdAt;
                        if (isDateInRange(sessionDate, dateStart, dateEnd)) {
                            quizTimeMs += lastSession.totalTime;
                        }
                    }
                }
            }
            const quizTimeMinutes = Math.round(quizTimeMs / 60000);

            // Calculate Learning Time from Session collection - filtered by date
            let learningTimeMinutes = 0;
            try {
                const learningQuery = { 
                    userId: userId,
                    status: "closed",
                    sessionType: "Learning",
                    timeTaken: { $ne: null }
                };
                
                // Add date filtering to learning sessions
                if (dateStart || dateEnd) {
                    learningQuery.updatedAt = {};
                    if (dateStart) learningQuery.updatedAt.$gte = dateStart;
                    if (dateEnd) learningQuery.updatedAt.$lte = dateEnd;
                }
                
                const learningSessions = await Session.find(learningQuery);
                learningTimeMinutes = learningSessions.reduce((sum, session) => {
                    return sum + (session.timeTaken || 0);
                }, 0);
            } catch (err) {
                console.error("Error fetching learning sessions for scoreboard:", err);
            }

            // Total Time = Quiz + Learning
            const totalTimeMinutes = quizTimeMinutes + learningTimeMinutes;

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
                currentStreak = Math.min(uniqueDates.length, 7);
                longestStreak = Math.min(uniqueDates.length, 30);
            }

            response.data.scoreboard = {
                completedQuizzes: completedQuizzes.slice(0, 20),
                quizzesInProgress: quizzesInProgress.slice(0, 20),
                totalPointsEarned,
                totalTimeSpentMinutes: totalTimeMinutes,
                totalHoursSpent: parseFloat((totalTimeMinutes / 60).toFixed(2)),
                quizTimeSpentMinutes: quizTimeMinutes,
                quizTimeSpentHours: parseFloat((quizTimeMinutes / 60).toFixed(2)),
                learningTimeSpentMinutes: learningTimeMinutes,
                learningTimeSpentHours: parseFloat((learningTimeMinutes / 60).toFixed(2)),
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
        // ASSESSMENT ANALYSIS - Uses LAST SESSION data only
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
                const { qnaDetails } = getLastSessionData(record);
                const answeredQuestions = qnaDetails.filter(q => q.status === 1);
                
                answeredQuestions.forEach(qna => {
                    totalQuestions++;
                    totalScore += qna.score || 0;
                    totalMaxScore += qna.questionMarks || 0;
                    
                    const scorePercentage = qna.questionMarks > 0 
                        ? (qna.score / qna.questionMarks) * 100 
                        : 0;
                    
                    if (scorePercentage >= 80) correctAnswers++;

                    // Track by subject/topic
                    const subjectName = record.bookId?.subject || 'Unknown';
                    if (!topicPerformance[subjectName]) {
                        topicPerformance[subjectName] = {
                            attempted: 0,
                            correct: 0,
                            totalScore: 0,
                            maxScore: 0
                        };
                    }
                    topicPerformance[subjectName].attempted++;
                    topicPerformance[subjectName].totalScore += qna.score || 0;
                    topicPerformance[subjectName].maxScore += qna.questionMarks || 0;
                    if (scorePercentage >= 80) topicPerformance[subjectName].correct++;

                    // Difficulty analysis
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
            const subjectAnalysis = Object.entries(topicPerformance).map(([subjectName, data]) => ({
                subject: subjectName,
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
                    completionRate: qnaRecords.length > 0 ? parseFloat(((qnaRecords.filter(r => {
                        const { qnaDetails } = getLastSessionData(r);
                        return qnaDetails.filter(q => q.status === 1).length > 0;
                    }).length / qnaRecords.length) * 100).toFixed(2)) : 0
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
        // PERFORMANCE TRENDS - Enhanced with Book/Chapter/Subject-wise trends
        // ================================================================
        if (includeTrends) {
            // Subject-wise trends
            const subjectTrends = {};
            
            // Book-wise trends
            const bookTrends = {};
            
            // Chapter-wise session trends (NEW: session-wise data per chapter)
            const chapterSessionTrends = {};

            // Process QnA records for subject/book trends
            qnaRecords.forEach(record => {
                const { qnaDetails, session } = getLastSessionData(record);
                const answeredQuestions = qnaDetails.filter(q => q.status === 1);
                
                if (answeredQuestions.length === 0 || !record.bookId || !record.chapterId) return;

                const subjectName = record.bookId.subject || 'Unknown';
                const bookId = record.bookId._id.toString();
                const bookTitle = record.bookId.title || 'Unknown Book';
                const chapterId = record.chapterId._id.toString();
                const chapterTitle = record.chapterId.title || 'Unknown Chapter';
                
                const marksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                const marksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);
                const scorePercentage = marksAvailable > 0 ? (marksEarned / marksAvailable) * 100 : 0;

                // Subject-wise aggregation
                if (!subjectTrends[subjectName]) {
                    subjectTrends[subjectName] = {
                        subject: subjectName,
                        marksEarned: 0,
                        marksAvailable: 0,
                        questionsAnswered: 0,
                        quizzes: 0,
                        quizTimeMs: 0,
                        learningTimeMs: 0
                    };
                }
                subjectTrends[subjectName].marksEarned += marksEarned;
                subjectTrends[subjectName].marksAvailable += marksAvailable;
                subjectTrends[subjectName].questionsAnswered += answeredQuestions.length;
                subjectTrends[subjectName].quizzes++;

                // Book-wise aggregation
                if (!bookTrends[bookId]) {
                    bookTrends[bookId] = {
                        bookId: bookId,
                        bookTitle: bookTitle,
                        subject: subjectName,
                        marksEarned: 0,
                        marksAvailable: 0,
                        questionsAnswered: 0,
                        quizzes: 0,
                        quizTimeMs: 0,
                        learningTimeMs: 0
                    };
                }
                bookTrends[bookId].marksEarned += marksEarned;
                bookTrends[bookId].marksAvailable += marksAvailable;
                bookTrends[bookId].questionsAnswered += answeredQuestions.length;
                bookTrends[bookId].quizzes++;
            });

            // Get quiz time from Chat collection's LAST SESSION totalTime field
            // Process ALL chats, not just those with matching qnaRecords
            if (userChats) {
                for (const chat of userChats) {
                    if (!chat.chapterId || !chat.sessions || chat.sessions.length === 0) continue;
                    
                    const lastSession = getChatLastSession(chat);
                    if (!lastSession || !lastSession.totalTime) continue;
                    
                    const sessionDate = lastSession.endTime || lastSession.updatedAt || lastSession.createdAt;
                    if (!isDateInRange(sessionDate, dateStart, dateEnd)) continue;

                    const chapterIdStr = chat.chapterId._id.toString();
                    
                    // Find the chapter's book and subject from qnaRecords OR chat.populated chapterId
                    let chapterBookId = null;
                    let chapterSubject = null;
                    
                    // Try to find from qnaRecords first
                    for (const record of qnaRecords) {
                        if (record.chapterId && record.chapterId._id.toString() === chapterIdStr) {
                            chapterBookId = record.bookId?._id.toString();
                            chapterSubject = record.bookId?.subject;
                            break;
                        }
                    }
                    
                    // If not found, try to get from populated chapterId (if available)
                    if (!chapterSubject && chat.chapterId && chat.chapterId.bookId) {
                        try {
                            const chapter = await Chapter.findById(chapterIdStr).populate('bookId');
                            if (chapter && chapter.bookId) {
                                chapterBookId = chapter.bookId._id.toString();
                                chapterSubject = chapter.bookId.subject;
                            }
                        } catch (err) {
                            // Ignore error, continue without subject/book info
                        }
                    }

                    // Add to subject trends (create if doesn't exist)
                    if (chapterSubject) {
                        if (!subjectTrends[chapterSubject]) {
                            subjectTrends[chapterSubject] = {
                                subject: chapterSubject,
                                marksEarned: 0,
                                marksAvailable: 0,
                                questionsAnswered: 0,
                                quizzes: 0,
                                quizTimeMs: 0,
                                learningTimeMs: 0
                            };
                        }
                        subjectTrends[chapterSubject].quizTimeMs += lastSession.totalTime;
                    }

                    // Add to book trends (create if doesn't exist)
                    if (chapterBookId) {
                        if (!bookTrends[chapterBookId]) {
                            // Get book title
                            let bookTitle = 'Unknown Book';
                            try {
                                const book = await Book.findById(chapterBookId);
                                if (book) bookTitle = book.title;
                            } catch (err) {
                                // Ignore
                            }
                            
                            bookTrends[chapterBookId] = {
                                bookId: chapterBookId,
                                bookTitle: bookTitle,
                                subject: chapterSubject || 'Unknown',
                                marksEarned: 0,
                                marksAvailable: 0,
                                questionsAnswered: 0,
                                quizzes: 0,
                                quizTimeMs: 0,
                                learningTimeMs: 0
                            };
                        }
                        bookTrends[chapterBookId].quizTimeMs += lastSession.totalTime;
                    }
                }
            }

            // Process Chat sessions for chapter-wise session trends
            // Get ALL sessions (not just last) for each chapter
            if (userChats) {
                for (const chat of userChats) {
                    if (!chat.chapterId || !chat.sessions || chat.sessions.length === 0) continue;
                    
                    const chapterIdStr = chat.chapterId._id.toString();
                    
                    // Find chapter info from qnaRecords or populated chapterId
                    let chapterBookId = null;
                    let chapterSubject = null;
                    let chapterTitle = chat.chapterId.title || 'Unknown Chapter';
                    
                    // Try to find from qnaRecords first
                    for (const record of qnaRecords) {
                        if (record.chapterId && record.chapterId._id.toString() === chapterIdStr) {
                            chapterBookId = record.bookId?._id.toString();
                            chapterSubject = record.bookId?.subject;
                            chapterTitle = record.chapterId?.title || chapterTitle;
                            break;
                        }
                    }
                    
                    // If not found, try to get from populated chapterId
                    if (!chapterSubject && chat.chapterId && chat.chapterId.bookId) {
                        try {
                            const chapter = await Chapter.findById(chapterIdStr).populate('bookId');
                            if (chapter) {
                                chapterTitle = chapter.title || chapterTitle;
                                if (chapter.bookId) {
                                    chapterBookId = chapter.bookId._id.toString();
                                    chapterSubject = chapter.bookId.subject;
                                }
                            }
                        } catch (err) {
                            // Ignore error
                        }
                    }

                    // Initialize chapter if not exists
                    if (!chapterSessionTrends[chapterIdStr]) {
                        chapterSessionTrends[chapterIdStr] = {
                            chapterId: chapterIdStr,
                            chapterTitle: chapterTitle,
                            bookId: chapterBookId,
                            subject: chapterSubject,
                            sessions: []
                        };
                    }

                    // Process each session in this chat
                    for (const session of chat.sessions) {
                        // Skip if no totalTime (session not completed)
                        if (!session.totalTime && session.sessionStatus !== 'closed') continue;
                        
                        const sessionDate = session.endTime || session.updatedAt || session.createdAt;
                        if (!isDateInRange(sessionDate, dateStart, dateEnd)) continue;

                        // Get score - prefer session.scorePercentage, fallback to QnALists calculation
                        let sessionScore = 0;
                        
                        // First try: use session's scorePercentage if available
                        if (session.scorePercentage !== undefined && session.scorePercentage !== null) {
                            sessionScore = session.scorePercentage;
                        } else {
                            // Fallback: calculate from QnALists
                            let sessionMarksEarned = 0;
                            let sessionMarksAvailable = 0;
                            
                            // Find matching QnALists record and session
                            for (const qnaRecord of qnaRecords) {
                                if (qnaRecord.chapterId && qnaRecord.chapterId._id.toString() === chapterIdStr) {
                                    const matchingSession = qnaRecord.sessions?.find(s => s.sessionId === session.sessionId);
                                    if (matchingSession) {
                                        const answeredQuestions = matchingSession.qnaDetails?.filter(q => q.status === 1) || [];
                                        sessionMarksEarned = answeredQuestions.reduce((sum, q) => sum + (q.score || 0), 0);
                                        sessionMarksAvailable = answeredQuestions.reduce((sum, q) => sum + (q.questionMarks || 0), 0);
                                        sessionScore = sessionMarksAvailable > 0 ? (sessionMarksEarned / sessionMarksAvailable) * 100 : 0;
                                        break;
                                    }
                                }
                            }
                        }

                        // Use totalTime from session (convert ms to hours)
                        const totalTimeMs = session.totalTime || 0;
                        const totalHours = parseFloat((totalTimeMs / (60 * 60 * 1000)).toFixed(2));

                        chapterSessionTrends[chapterIdStr].sessions.push({
                            sessionId: session.sessionId,
                            sessionStatus: session.sessionStatus,
                            score: parseFloat(sessionScore.toFixed(2)),
                            totalHours: totalHours,
                            startTime: session.startTime,
                            endTime: session.endTime,
                            createdAt: session.createdAt,
                            updatedAt: session.updatedAt
                        });
                    }
                }
            }

            // Get learning time from Session collection
            try {
                const learningQuery = { 
                    userId: userId,
                    status: "closed",
                    sessionType: "Learning",
                    timeTaken: { $ne: null }
                };
                
                if (dateStart || dateEnd) {
                    learningQuery.updatedAt = {};
                    if (dateStart) learningQuery.updatedAt.$gte = dateStart;
                    if (dateEnd) learningQuery.updatedAt.$lte = dateEnd;
                }
                
                const learningSessions = await Session.find(learningQuery);
                
                // Distribute learning time
                learningSessions.forEach(session => {
                    const timeMs = (session.timeTaken || 0) * 60 * 1000; // Convert minutes to ms
                    
                    if (session.subject && subjectTrends[session.subject]) {
                        subjectTrends[session.subject].learningTimeMs += timeMs;
                    } else {
                        // Distribute evenly across all subjects
                        const subjectCount = Object.keys(subjectTrends).length;
                        if (subjectCount > 0) {
                            const timePerSubject = timeMs / subjectCount;
                            Object.keys(subjectTrends).forEach(subj => {
                                subjectTrends[subj].learningTimeMs += timePerSubject;
                            });
                        }
                    }
                });
            } catch (err) {
                console.error("Error fetching learning sessions for trends:", err);
            }

            // Format subject-wise trends
            const formatSubjectTrends = () => {
                return Object.values(subjectTrends).map(data => ({
                    subject: data.subject,
                    score: data.marksAvailable > 0 ? parseFloat(((data.marksEarned / data.marksAvailable) * 100).toFixed(2)) : 0,
                    totalQuizHours: parseFloat((data.quizTimeMs / (60 * 60 * 1000)).toFixed(2)),
                    totalLearningHours: parseFloat((data.learningTimeMs / (60 * 60 * 1000)).toFixed(2)),
                    marksEarned: parseFloat(data.marksEarned.toFixed(2)),
                    marksAvailable: parseFloat(data.marksAvailable.toFixed(2)),
                    questionsAnswered: data.questionsAnswered,
                    quizzes: data.quizzes
                })).sort((a, b) => b.score - a.score);
            };

            // Format book-wise trends (filterable by subject)
            const formatBookTrends = (filterSubject = null) => {
                let books = Object.values(bookTrends);
                
                // Filter by subject if provided
                if (filterSubject) {
                    books = books.filter(b => b.subject === filterSubject);
                }
                
                return books.map(data => ({
                    bookId: data.bookId,
                    bookTitle: data.bookTitle,
                    subject: data.subject,
                    score: data.marksAvailable > 0 ? parseFloat(((data.marksEarned / data.marksAvailable) * 100).toFixed(2)) : 0,
                    totalQuizHours: parseFloat((data.quizTimeMs / (60 * 60 * 1000)).toFixed(2)),
                    totalLearningHours: parseFloat((data.learningTimeMs / (60 * 60 * 1000)).toFixed(2)),
                    marksEarned: parseFloat(data.marksEarned.toFixed(2)),
                    marksAvailable: parseFloat(data.marksAvailable.toFixed(2)),
                    questionsAnswered: data.questionsAnswered,
                    quizzes: data.quizzes
                })).sort((a, b) => b.score - a.score);
            };

            // Format chapter-wise trends (session-wise, filterable by chapterId only)
            const formatChapterTrends = (filterChapterId = null) => {
                let chapters = Object.values(chapterSessionTrends);
                
                // Filter by chapterId if provided
                if (filterChapterId) {
                    chapters = chapters.filter(c => c.chapterId === filterChapterId);
                }
                
                return chapters.map(data => ({
                    chapterId: data.chapterId,
                    chapterTitle: data.chapterTitle,
                    bookId: data.bookId,
                    subject: data.subject,
                    sessions: data.sessions
                        .sort((a, b) => new Date(b.createdAt || b.startTime) - new Date(a.createdAt || a.startTime))
                        .map(session => ({
                            sessionId: session.sessionId,
                            sessionStatus: session.sessionStatus,
                            score: session.score,
                            totalHours: session.totalHours,
                            startTime: session.startTime,
                            endTime: session.endTime,
                            createdAt: session.createdAt,
                            updatedAt: session.updatedAt
                        }))
                })).sort((a, b) => {
                    // Sort by latest session date
                    const aLatest = a.sessions[0]?.createdAt || a.sessions[0]?.startTime;
                    const bLatest = b.sessions[0]?.createdAt || b.sessions[0]?.startTime;
                    return new Date(bLatest || 0) - new Date(aLatest || 0);
                });
            };

            response.data.trends = {
                subjectWise: formatSubjectTrends(),
                bookWise: formatBookTrends(subject), // Filter by subject query param if provided
                chapterWise: formatChapterTrends(chapterId), // Filter by chapterId query param if provided
                filters: {
                    appliedSubject: subject || null,
                    appliedChapter: chapterId || null,
                    note: "Book-wise trends can be filtered by subject. Chapter-wise trends show session-wise data and can be filtered by chapterId only."
                }
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
        message: "Unified Scores API is working! (Session-based)",
        note: "Stats are now based on the LAST SESSION only",
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
            "GET /api/unified-scores/USER_ID?include=detailed&timeframe=month - Detailed stats for last month",
            "GET /api/unified-scores/USER_ID?include=basic&timeframe=week - Stats for last week",
            "GET /api/unified-scores/USER_ID?include=basic&timeframe=year - Stats for last year",
            "GET /api/unified-scores/USER_ID?include=all&startDate=2025-01-01&endDate=2025-12-31 - Custom date range",
            "GET /api/unified-scores/USER_ID?include=scoreboard&timeframe=month - Scoreboard for last month"
        ],
        dateFilters: {
            timeframe: "week, month, quarter, year",
            customDates: "startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)",
            note: "Date filters apply to QnA records, Chat sessions, and Learning sessions"
        }
    });
});

module.exports = router;
