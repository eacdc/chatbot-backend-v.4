const express = require("express");
const Subscription = require("../models/Subscription");
const Book = require("../models/Book");
const User = require("../models/User");
const Chat = require("../models/Chat");
const QnALists = require("../models/QnALists");
const router = express.Router();
const authenticateUser = require("../middleware/authMiddleware"); // Middleware to get logged-in user

// ================================================================
// ENHANCED COLLECTION MANAGEMENT APIS
// ================================================================

// Advanced Search, Sort, and Filter Books API for User Collections
router.get("/collection", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      search,
      subject,
      grade,
      author,
      status,
      progress,
      lastAccessed,
      sortBy = 'title',
      sortOrder = 'asc',
      page = 1,
      limit = 20
    } = req.query;

    console.log(`📚 Fetching collection for user: ${userId}`);
    console.log(`📊 Query parameters:`, {
      search,
      subject,
      grade,
      author,
      status,
      progress,
      lastAccessed,
      sortBy,
      sortOrder,
      page,
      limit
    });

    // Get user's subscriptions
    const subscriptions = await Subscription.find({ userId })
      .populate('bookId', 'title subject grade publisher language bookCoverImgLink createdAt')
      .sort({ subscribedAt: -1 });

    console.log(`📚 Found ${subscriptions.length} subscriptions for user ${userId}`);

    if (subscriptions.length === 0) {
      console.log(`📚 No subscriptions found for user ${userId}`);
      return res.json({
        success: true,
        data: {
          books: [],
          appliedFilters: {},
          availableFilters: {
            subjects: [],
            grades: [],
            authors: [],
            statuses: []
          },
          summary: {
            totalBooks: 0,
            completedBooks: 0,
            inProgressBooks: 0,
            notStartedBooks: 0,
            averageProgress: 0,
            totalTimeSpent: 0
          }
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalItems: 0,
          limit: parseInt(limit),
          hasNext: false,
          hasPrev: false
        }
      });
    }

    // Get user progress data for each book
    const bookIds = subscriptions.map(sub => sub.bookId?._id).filter(id => id);
    console.log(`📚 Processing ${bookIds.length} book IDs for progress calculation`);

    const [userChats, userQnARecords] = await Promise.all([
      Chat.find({ userId, chapterId: { $exists: true } })
        .populate('chapterId', 'title bookId'),
      QnALists.find({ studentId: userId, bookId: { $in: bookIds } })
        .populate('chapterId', 'title bookId')
    ]);

    console.log(`📚 Found ${userChats.length} chat records and ${userQnARecords.length} Q&A records`);

    // Process books with user progress
    const processedBooks = await Promise.all(subscriptions.map(async (subscription) => {
      const book = subscription.bookId;
      if (!book) {
        console.log(`⚠️ Warning: Subscription ${subscription._id} has no associated book`);
        return null;
      }

      // Get chapters for this book
      const Chapter = require("../models/Chapter");
      const chapters = await Chapter.find({ bookId: book._id });

      // Calculate progress metrics
      const bookChats = userChats.filter(chat => 
        chat.chapterId && chat.chapterId.bookId && 
        chat.chapterId.bookId.toString() === book._id.toString()
      );
      
      const bookQnARecords = userQnARecords.filter(qna => 
        qna.bookId && qna.bookId.toString() === book._id.toString()
      );

      // Calculate completion status
      const completedChapters = new Set();
      const chaptersInProgress = new Set();
      let totalTimeSpent = 0;
      let totalScore = 0;
      let totalMaxScore = 0;

      // Process QnA records for completion status
      bookQnARecords.forEach(qna => {
        if (qna.chapterId && qna.qnaDetails && qna.qnaDetails.length > 0) {
          const answeredQuestions = qna.qnaDetails.filter(q => q.status === 1);
          if (answeredQuestions.length > 0) {
            chaptersInProgress.add(qna.chapterId._id.toString());
            
            // Calculate if chapter is completed (all questions answered)
            const chapterQuestions = qna.qnaDetails.length;
            if (answeredQuestions.length === chapterQuestions) {
              completedChapters.add(qna.chapterId._id.toString());
            }
            
            // Calculate scores
            answeredQuestions.forEach(q => {
              totalScore += q.score || 0;
              totalMaxScore += q.questionMarks || 1;
            });
          }
        }
      });

      // Calculate time spent from chat history
      bookChats.forEach(chat => {
        if (chat.messages && chat.messages.length > 0) {
          const firstMessage = chat.messages[0];
          const lastMessage = chat.messages[chat.messages.length - 1];
          if (firstMessage.timestamp && lastMessage.timestamp) {
            const sessionTime = (new Date(lastMessage.timestamp) - new Date(firstMessage.timestamp)) / (1000 * 60); // minutes
            totalTimeSpent += Math.max(sessionTime, 0);
          }
        }
      });

      const totalChapters = chapters.length;
      const progressPercentage = totalChapters > 0 ? (completedChapters.size / totalChapters) * 100 : 0;
      const averageScore = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

      // Determine status
      let status;
      if (completedChapters.size === totalChapters && totalChapters > 0) {
        status = 'completed';
      } else if (chaptersInProgress.size > 0) {
        status = 'in_progress';
      } else {
        status = 'not_started';
      }

      return {
        bookId: book._id,
        title: book.title,
        subject: book.subject,
        grade: book.grade,
        author: book.publisher, // Using publisher as author for now
        description: book.description || book.title, // Use title as fallback for description
        coverImage: book.bookCoverImgLink,
        totalChapters,
        addedToCollection: subscription.subscribedAt,
        lastAccessed: bookChats.length > 0 ? 
          new Date(Math.max(...bookChats.map(chat => new Date(chat.lastActive || chat.updatedAt).getTime()))).toISOString() : 
          subscription.subscribedAt,
        userProgress: {
          chaptersCompleted: completedChapters.size,
          chaptersInProgress: chaptersInProgress.size,
          progressPercentage: Math.round(progressPercentage * 10) / 10,
          totalTimeSpent: Math.round(totalTimeSpent),
          averageScore: Math.round(averageScore * 10) / 10,
          status
        },
        recentActivity: {
          lastChapterAccessed: bookChats.length > 0 ? 
            bookChats[bookChats.length - 1].chapterId?.title : null,
          lastScore: bookQnARecords.length > 0 ? averageScore : null,
          lastQuizDate: bookQnARecords.length > 0 ? 
            new Date(Math.max(...bookQnARecords.map(qna => new Date(qna.updatedAt).getTime()))).toISOString() : null
        }
      };
    }));

    // Filter out null entries
    let filteredBooks = processedBooks.filter(book => book !== null);
    console.log(`📚 Processed ${filteredBooks.length} books successfully`);

    // Apply search filter - search only in book titles
    if (search) {
      const searchLower = search.toLowerCase();
      const originalCount = filteredBooks.length;
      
      // Search only in book titles
      filteredBooks = filteredBooks.filter(book => 
        book.title.toLowerCase().includes(searchLower)
      );
      
      console.log(`🔍 Search filter applied to book titles only: ${originalCount} → ${filteredBooks.length} books`);
    }

    // Apply filters
    if (subject) {
      const subjects = subject.split(',');
      const originalCount = filteredBooks.length;
      filteredBooks = filteredBooks.filter(book => subjects.includes(book.subject));
      console.log(`🎯 Subject filter applied: ${originalCount} → ${filteredBooks.length} books`);
    }

    if (grade) {
      const grades = grade.split(',');
      const originalCount = filteredBooks.length;
      filteredBooks = filteredBooks.filter(book => grades.includes(book.grade));
      console.log(`📚 Grade filter applied: ${originalCount} → ${filteredBooks.length} books`);
    }

    if (author) {
      const originalCount = filteredBooks.length;
      filteredBooks = filteredBooks.filter(book => book.author === author);
      console.log(`✍️ Author filter applied: ${originalCount} → ${filteredBooks.length} books`);
    }

    if (status) {
      const originalCount = filteredBooks.length;
      filteredBooks = filteredBooks.filter(book => book.userProgress.status === status);
      console.log(`📊 Status filter applied: ${originalCount} → ${filteredBooks.length} books`);
    }

    if (progress) {
      const [min, max] = progress.split('-').map(Number);
      const originalCount = filteredBooks.length;
      filteredBooks = filteredBooks.filter(book => 
        book.userProgress.progressPercentage >= min && 
        book.userProgress.progressPercentage <= max
      );
      console.log(`📈 Progress filter applied: ${originalCount} → ${filteredBooks.length} books`);
    }

    if (lastAccessed) {
      const now = new Date();
      let filterDate;
      const originalCount = filteredBooks.length;
      
      switch (lastAccessed) {
        case 'today':
          filterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'this_week':
          filterDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'this_month':
          filterDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'older':
          filterDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          filteredBooks = filteredBooks.filter(book => new Date(book.lastAccessed) < filterDate);
          break;
        default:
          filterDate = null;
      }
      
      if (filterDate && lastAccessed !== 'older') {
        filteredBooks = filteredBooks.filter(book => new Date(book.lastAccessed) >= filterDate);
      }
      console.log(`📅 LastAccessed filter applied: ${originalCount} → ${filteredBooks.length} books`);
    }

    // Sort books
    const validSortFields = ['title', 'subject', 'grade', 'progress', 'lastAccessed', 'createdAt', 'chaptersCompleted'];
    if (validSortFields.includes(sortBy)) {
      filteredBooks.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'progress':
            aValue = a.userProgress.progressPercentage;
            bValue = b.userProgress.progressPercentage;
            break;
          case 'lastAccessed':
            aValue = new Date(a.lastAccessed);
            bValue = new Date(b.lastAccessed);
            break;
          case 'chaptersCompleted':
            aValue = a.userProgress.chaptersCompleted;
            bValue = b.userProgress.chaptersCompleted;
            break;
          case 'createdAt':
            aValue = new Date(a.addedToCollection);
            bValue = new Date(b.addedToCollection);
            break;
          default:
            aValue = a[sortBy];
            bValue = b[sortBy];
        }
        
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
      console.log(`🔄 Books sorted by ${sortBy} in ${sortOrder} order`);
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const totalItems = filteredBooks.length;
    const totalPages = Math.ceil(totalItems / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedBooks = filteredBooks.slice(startIndex, endIndex);

    console.log(`📄 Pagination: Page ${pageNum}/${totalPages}, showing ${paginatedBooks.length} of ${totalItems} books`);

    // Generate available filters
    const availableFilters = {
      subjects: [...new Set(processedBooks.map(book => book.subject))].map(subject => ({
        name: subject,
        count: processedBooks.filter(book => book.subject === subject).length
      })),
      grades: [...new Set(processedBooks.map(book => book.grade))].map(grade => ({
        name: grade,
        count: processedBooks.filter(book => book.grade === grade).length
      })),
      authors: [...new Set(processedBooks.map(book => book.author))].map(author => ({
        name: author,
        count: processedBooks.filter(book => book.author === author).length
      })),
      statuses: [
        { name: 'not_started', count: processedBooks.filter(book => book.userProgress.status === 'not_started').length },
        { name: 'in_progress', count: processedBooks.filter(book => book.userProgress.status === 'in_progress').length },
        { name: 'completed', count: processedBooks.filter(book => book.userProgress.status === 'completed').length }
      ]
    };

    // Calculate summary
    const summary = {
      totalBooks: processedBooks.length,
      completedBooks: processedBooks.filter(book => book.userProgress.status === 'completed').length,
      inProgressBooks: processedBooks.filter(book => book.userProgress.status === 'in_progress').length,
      notStartedBooks: processedBooks.filter(book => book.userProgress.status === 'not_started').length,
      averageProgress: processedBooks.length > 0 ? 
        processedBooks.reduce((sum, book) => sum + book.userProgress.progressPercentage, 0) / processedBooks.length : 0,
      totalTimeSpent: processedBooks.reduce((sum, book) => sum + book.userProgress.totalTimeSpent, 0)
    };

    console.log(`📊 Summary: ${summary.totalBooks} total, ${summary.completedBooks} completed, ${summary.inProgressBooks} in progress, ${summary.notStartedBooks} not started`);

    const response = {
      success: true,
      data: {
        books: paginatedBooks,
        appliedFilters: {
          search,
          subject: subject ? subject.split(',') : [],
          grade: grade ? grade.split(',') : [],
          author,
          status,
          progress,
          lastAccessed,
          sortBy,
          sortOrder
        },
        availableFilters,
        summary: {
          ...summary,
          averageProgress: Math.round(summary.averageProgress * 10) / 10
        }
      },
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems,
        limit: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    };

    console.log(`✅ Returning collection response with ${paginatedBooks.length} books`);
    res.json(response);

  } catch (error) {
    console.error("❌ Error fetching user collection:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch user collection", 
      details: error.message 
    });
  }
});

// Get Collection Summary
router.get("/collection/summary", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user's subscriptions
    const subscriptions = await Subscription.find({ userId })
      .populate('bookId', 'subject grade');

    if (subscriptions.length === 0) {
      return res.json({
        success: true,
        data: {
          totalBooks: 0,
          byStatus: { completed: 0, inProgress: 0, notStarted: 0 },
          bySubject: {},
          byGrade: {},
          totalTimeSpent: 0,
          averageProgress: 0,
          lastActivity: null
        }
      });
    }

    // Get user progress data
    const bookIds = subscriptions.map(sub => sub.bookId._id);
    const [userChats, userQnARecords] = await Promise.all([
      Chat.find({ userId, chapterId: { $exists: true } })
        .populate('chapterId', 'bookId'),
      QnALists.find({ studentId: userId, bookId: { $in: bookIds } })
    ]);

    const statusCounts = { completed: 0, inProgress: 0, notStarted: 0 };
    const subjectCounts = {};
    const gradeCounts = {};
    let totalTimeSpent = 0;
    let totalProgress = 0;
    let lastActivity = null;

    // Process each subscription
    for (const subscription of subscriptions) {
      const book = subscription.bookId;
      if (!book) continue;

      // Count by subject and grade
      subjectCounts[book.subject] = (subjectCounts[book.subject] || 0) + 1;
      gradeCounts[book.grade] = (gradeCounts[book.grade] || 0) + 1;

      // Get chapters for this book
      const Chapter = require("../models/Chapter");
      const chapters = await Chapter.find({ bookId: book._id });

      // Calculate progress
      const bookQnARecords = userQnARecords.filter(qna => 
        qna.bookId && qna.bookId.toString() === book._id.toString()
      );

      const completedChapters = new Set();
      const chaptersInProgress = new Set();

      bookQnARecords.forEach(qna => {
        if (qna.chapterId && qna.qnaDetails && qna.qnaDetails.length > 0) {
          const answeredQuestions = qna.qnaDetails.filter(q => q.status === 1);
          if (answeredQuestions.length > 0) {
            chaptersInProgress.add(qna.chapterId.toString());
            
            if (answeredQuestions.length === qna.qnaDetails.length) {
              completedChapters.add(qna.chapterId.toString());
            }
          }
        }
      });

      // Determine status
      if (completedChapters.size === chapters.length && chapters.length > 0) {
        statusCounts.completed++;
      } else if (chaptersInProgress.size > 0) {
        statusCounts.inProgress++;
      } else {
        statusCounts.notStarted++;
      }

      // Calculate progress percentage
      const progressPercentage = chapters.length > 0 ? (completedChapters.size / chapters.length) * 100 : 0;
      totalProgress += progressPercentage;

      // Check for last activity
      const bookChats = userChats.filter(chat => 
        chat.chapterId && chat.chapterId.bookId && 
        chat.chapterId.bookId.toString() === book._id.toString()
      );
      
      if (bookChats.length > 0) {
        const bookLastActivity = Math.max(...bookChats.map(chat => new Date(chat.lastActive || chat.updatedAt)));
        if (!lastActivity || bookLastActivity > lastActivity) {
          lastActivity = bookLastActivity;
        }
      }
    }

    const averageProgress = subscriptions.length > 0 ? totalProgress / subscriptions.length : 0;

    res.json({
      success: true,
      data: {
        totalBooks: subscriptions.length,
        byStatus: statusCounts,
        bySubject: subjectCounts,
        byGrade: gradeCounts,
        totalTimeSpent: Math.round(totalTimeSpent),
        averageProgress: Math.round(averageProgress * 10) / 10,
        lastActivity
      }
    });

  } catch (error) {
    console.error("Error fetching collection summary:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch collection summary" 
    });
  }
});

// ================================================================
// EXISTING ROUTES (PRESERVED)
// ================================================================

// ✅ Subscribe to a book (Ensuring user details come from authentication)
router.post("/", authenticateUser, async (req, res) => {
  try {
    const { bookId } = req.body;

    // Get logged-in user's ID from middleware
    // FIXED: Changed req.user.id to req.user.userId to match how it's set in your auth middleware
    const userId = req.user.userId;
    
    console.log("👤 User Info from Token:", req.user);
    
    // Fetch user details from database
    const user = await User.findById(userId);
    console.log("📋 User from Database:", user);
    
    if (!user) return res.status(404).json({ error: "User not found" });

    // Validate if the book exists
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: "Book not found" });

    // Check if the user is already subscribed
    const existingSubscription = await Subscription.findOne({ userId, bookId });
    if (existingSubscription) {
      return res.status(400).json({ error: "Already subscribed to this book" });
    }

    // Save new subscription with actual user details
    const newSubscription = new Subscription({
      userId,
      userName: user.fullname,
      bookId,
      bookTitle: book.title,
      publisher: book.publisher,
      subject: book.subject,
      grade: book.grade,
      bookCoverImgLink: book.bookCoverImgLink
    });

    await newSubscription.save();
    res.status(201).json({ message: "Subscribed successfully!", subscription: newSubscription });

  } catch (err) {
    console.error("Error subscribing:", err.message);
    res.status(500).json({ error: `Failed to subscribe: ${err.message}` });
  }
});

// ✅ Get all subscriptions for the logged-in user
router.get("/my-subscriptions", authenticateUser, async (req, res) => {
  try {
    // FIXED: Changed req.user.id to req.user.userId
    const userId = req.user.userId; 
    const subscriptions = await Subscription.find({ userId });
    res.json(subscriptions);
  } catch (err) {
    console.error("Error fetching subscriptions:", err.message);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

// ✅ Get all subscriptions for any user by userId (Admin Use)
router.get("/:userId", async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ userId: req.params.userId });
    res.json(subscriptions);
  } catch (err) {
    console.error("Error fetching user subscriptions:", err.message);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

// Update existing subscriptions with book cover links
router.post("/update-covers", authenticateUser, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({});
    let updated = 0;

    for (const subscription of subscriptions) {
      // Find the associated book
      const book = await Book.findById(subscription.bookId);
      if (book && book.bookCoverImgLink) {
        // Update the subscription with the book cover link
        subscription.bookCoverImgLink = book.bookCoverImgLink;
        await subscription.save();
        updated++;
      }
    }

    res.status(200).json({ 
      message: `Updated ${updated} of ${subscriptions.length} subscriptions with book cover links` 
    });
  } catch (err) {
    console.error("Error updating subscriptions with book covers:", err.message);
    res.status(500).json({ error: `Failed to update subscriptions: ${err.message}` });
  }
});

// ✅ Unsubscribe from a book
router.delete("/:bookId", authenticateUser, async (req, res) => {
  try {
    // Get logged-in user's ID from middleware
    const userId = req.user.userId;
    const { bookId } = req.params;
    
    // Find and delete the subscription
    const subscription = await Subscription.findOneAndDelete({ userId, bookId });
    
    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }
    
    res.status(200).json({ message: "Unsubscribed successfully" });
  } catch (err) {
    console.error("Error unsubscribing:", err.message);
    res.status(500).json({ error: `Failed to unsubscribe: ${err.message}` });
  }
});

// Admin endpoint to update all subscriptions with book cover links (no auth for easy updating)
router.get("/admin/update-all-covers", async (req, res) => {
  try {
    const subscriptions = await Subscription.find({});
    let updated = 0;

    for (const subscription of subscriptions) {
      // Find the associated book
      const book = await Book.findById(subscription.bookId);
      if (book && book.bookCoverImgLink) {
        // Update the subscription with the book cover link
        subscription.bookCoverImgLink = book.bookCoverImgLink;
        await subscription.save();
        updated++;
      }
    }

    res.status(200).json({ 
      message: `Updated ${updated} of ${subscriptions.length} subscriptions with book cover links`,
      subscriptions: await Subscription.find({})
    });
  } catch (err) {
    console.error("Error updating subscriptions with book covers:", err.message);
    res.status(500).json({ error: `Failed to update subscriptions: ${err.message}` });
  }
});

// Admin endpoint to update all subscriptions with publisher info
router.get("/admin/update-publishers", async (req, res) => {
  try {
    const subscriptions = await Subscription.find({});
    let updated = 0;

    for (const subscription of subscriptions) {
      // Find the associated book
      const book = await Book.findById(subscription.bookId);
      if (book && book.publisher) {
        // Update the subscription with the book's publisher
        subscription.publisher = book.publisher;
        await subscription.save();
        updated++;
      }
    }

    res.status(200).json({ 
      message: `Updated ${updated} of ${subscriptions.length} subscriptions with publisher information`,
      subscriptions: await Subscription.find({})
    });
  } catch (err) {
    console.error("Error updating subscriptions with publisher info:", err.message);
    res.status(500).json({ error: `Failed to update subscriptions: ${err.message}` });
  }
});

module.exports = router;