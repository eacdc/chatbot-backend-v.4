const express = require("express");
const Book = require("../models/Book");
const Chapter = require("../models/Chapter"); // Import Chapter model
const Subscription = require("../models/Subscription"); // Import Subscription model
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authenticateAdmin = require("../middleware/adminAuthMiddleware");
const authenticateUser = require("../middleware/authMiddleware"); // Add user authentication
const cloudinary = require("cloudinary").v2;

// Validate Cloudinary configuration
const isCloudinaryConfigured = () => {
  return process.env.CLOUDINARY_CLOUD_NAME && 
         process.env.CLOUDINARY_API_KEY && 
         process.env.CLOUDINARY_API_SECRET;
};

// Configure Cloudinary if credentials are available
if (isCloudinaryConfigured()) {
  cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET 
  });
  console.log('Cloudinary configured successfully');
} else {
  console.warn('Cloudinary credentials missing. Image uploads will fail!');
}

// Configure multer storage for image uploads
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    // Accept image files only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  }
});

// ================================================================
// NEW SEARCH AND COLLECTION APIS
// ================================================================

// Search books API
router.get("/search", async (req, res) => {
  try {
    const { 
      q, 
      limit = 20, 
      page = 1,
      subject,
      grade,
      publisher,
      sortBy = 'title',
      sortOrder = 'asc'
    } = req.query;

    console.log(`🔍 Book search request:`, {
      query: q,
      limit,
      page,
      subject,
      grade,
      publisher,
      sortBy,
      sortOrder
    });

    if (!q || q.trim().length < 2) {
      console.log(`❌ Search query too short: "${q}"`);
      return res.status(400).json({ 
        success: false, 
        error: "Search query must be at least 2 characters long" 
      });
    }

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build search filter
    const searchFilter = {
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { subject: { $regex: q, $options: 'i' } },
        { publisher: { $regex: q, $options: 'i' } },
        { language: { $regex: q, $options: 'i' } }
      ]
    };

    // Add additional filters
    if (subject) {
      searchFilter.subject = subject;
      console.log(`🎯 Subject filter: ${subject}`);
    }
    if (grade) {
      searchFilter.grade = grade;
      console.log(`📚 Grade filter: ${grade}`);
    }
    if (publisher) {
      searchFilter.publisher = publisher;
      console.log(`🏢 Publisher filter: ${publisher}`);
    }

    // Build sort object
    const sortObj = {};
    const validSortFields = ['title', 'subject', 'grade', 'publisher', 'createdAt'];
    if (validSortFields.includes(sortBy)) {
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
      console.log(`🔄 Sort by: ${sortBy} ${sortOrder}`);
    } else {
      sortObj['title'] = 1;
      console.log(`🔄 Using default sort: title asc`);
    }

    console.log(`🔍 Search filter:`, searchFilter);

    // Execute search
    const [books, totalCount] = await Promise.all([
      Book.find(searchFilter)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      Book.countDocuments(searchFilter)
    ]);

    console.log(`✅ Found ${books.length} books out of ${totalCount} total matches`);

    // Generate search suggestions
    const suggestions = await generateSearchSuggestions(q);

    const response = {
      success: true,
      data: {
        books: books.map(book => ({
          ...book.toObject(),
          isInCollection: false // Will be updated by frontend if user is logged in
        })),
        totalResults: totalCount,
        searchQuery: q,
        suggestions
      },
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
        totalItems: totalCount,
        limit: limitNum,
        hasNext: pageNum < Math.ceil(totalCount / limitNum),
        hasPrev: pageNum > 1
      }
    };

    console.log(`✅ Returning search response with ${books.length} books`);
    res.json(response);

  } catch (error) {
    console.error("❌ Search error:", error);
    console.error("❌ Search error stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      error: "Search failed", 
      details: error.message 
    });
  }
});

// Search suggestions API
router.get("/search-suggestions", async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        data: {
          suggestions: [],
          recentSearches: [],
          popularSearches: []
        }
      });
    }

    const suggestions = await generateSearchSuggestions(q, parseInt(limit));
    
    // Get popular searches (mock data - could be stored in database)
    const popularSearches = [
      { query: "mathematics", searchCount: 156 },
      { query: "science", searchCount: 89 },
      { query: "english", searchCount: 78 }
    ];

    res.json({
      success: true,
      data: {
        suggestions,
        recentSearches: [], // Could be implemented with user session storage
        popularSearches
      }
    });

  } catch (error) {
    console.error("Search suggestions error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to get search suggestions" 
    });
  }
});

// Helper function to generate search suggestions
async function generateSearchSuggestions(query, limit = 5) {
  try {
    const suggestions = [];
    
    // Title suggestions
    const titleMatches = await Book.find({
      title: { $regex: query, $options: 'i' }
    }).limit(limit).select('title');
    
    titleMatches.forEach(book => {
      suggestions.push({
        text: book.title,
        type: 'title',
        resultCount: 1
      });
    });

    // Subject suggestions
    const subjectMatches = await Book.distinct('subject', {
      subject: { $regex: query, $options: 'i' }
    });
    
    subjectMatches.slice(0, limit).forEach(subject => {
      suggestions.push({
        text: subject,
        type: 'subject',
        resultCount: 1
      });
    });

    // Publisher suggestions
    const publisherMatches = await Book.distinct('publisher', {
      publisher: { $regex: query, $options: 'i' }
    });
    
    publisherMatches.slice(0, limit).forEach(publisher => {
      suggestions.push({
        text: publisher,
        type: 'publisher',
        resultCount: 1
      });
    });

    return suggestions.slice(0, limit);
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return [];
  }
}

// ================================================================
// EXISTING ROUTES (PRESERVED)
// ================================================================

// Create a new book
router.post("/", async (req, res) => {
  try {
    const newBook = new Book(req.body);
    const savedBook = await newBook.save();
    res.status(201).json(savedBook);
  } catch (err) {
    res.status(500).json({ error: "Failed to add book" });
  }
});

// Upload book cover image
router.post("/upload-cover", authenticateAdmin, upload.single('coverImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    console.log('Upload Request - File Details:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      buffer: req.file.buffer ? 'Present' : 'Missing'
    });

    // Check Cloudinary configuration
    const cloudinaryConfig = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    };
    
    console.log('Upload Request - Environment Check:', {
      NODE_ENV: process.env.NODE_ENV,
      CLOUDINARY_CLOUD_NAME: cloudinaryConfig.cloud_name ? 'Present' : 'Missing',
      CLOUDINARY_API_KEY: cloudinaryConfig.api_key ? 'Present' : 'Missing',
      CLOUDINARY_API_SECRET: cloudinaryConfig.api_secret ? 'Present' : 'Missing'
    });

    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary configuration is missing. Cannot upload images.');
    }

    // Create a buffer from the file
    const buffer = req.file.buffer;
    const tempFilePath = path.join(__dirname, `../temp-${Date.now()}.jpg`);
    
    try {
      // Write buffer to temporary file
      fs.writeFileSync(tempFilePath, buffer);
      console.log('Upload Request - Temporary file created:', tempFilePath);
      
      // Upload to Cloudinary
      console.log('Upload Request - Starting Cloudinary upload...');
      const result = await cloudinary.uploader.upload(tempFilePath, {
        folder: "book-covers",
        resource_type: "image",
        timeout: 60000 // 60 second timeout
      });
      
      // Delete the temporary file
      fs.unlinkSync(tempFilePath);
      console.log('Upload Request - Temporary file deleted');
      
      if (!result || !result.secure_url) {
        throw new Error('Cloudinary upload failed to return a valid URL');
      }
      
      console.log('Upload Request - Cloudinary upload successful:', {
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        size: result.bytes
      });
      
      res.status(200).json({ 
        message: "Image uploaded successfully", 
        imageUrl: result.secure_url,
        storage: 'cloudinary'
      });
    } catch (uploadError) {
      // Clean up temp file if it exists
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      console.error('Upload Request - Cloudinary upload error:', {
        error: uploadError.message,
        stack: uploadError.stack
      });
      throw uploadError;
    }
  } catch (err) {
    console.error("Upload Request - Error:", {
      message: err.message,
      stack: err.stack
    });
    res.status(500).json({ 
      error: "Failed to upload image", 
      details: err.message,
      solution: "Please ensure Cloudinary is properly configured"
    });
  }
});

// Test endpoint for image upload verification
router.post("/test-upload", authenticateAdmin, upload.single('coverImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    console.log('Test Upload - File received:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Check Cloudinary configuration
    const cloudinaryConfig = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    };
    
    console.log('Test Upload - Cloudinary Config:', {
      cloud_name: cloudinaryConfig.cloud_name ? 'Present' : 'Missing',
      api_key: cloudinaryConfig.api_key ? 'Present' : 'Missing',
      api_secret: cloudinaryConfig.api_secret ? 'Present' : 'Missing'
    });

    if (!isCloudinaryConfigured()) {
      throw new Error('Cloudinary configuration is missing. Cannot upload images.');
    }

    // Create a buffer from the file
    const buffer = req.file.buffer;
    const tempFilePath = path.join(__dirname, `../temp-test-${Date.now()}.jpg`);
    
    try {
      // Write buffer to temporary file
      fs.writeFileSync(tempFilePath, buffer);
      console.log('Test Upload - Temporary file created:', tempFilePath);
      
      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(tempFilePath, {
        folder: "test-uploads",
        resource_type: "image",
        timeout: 60000 // 60 second timeout
      });
      
      // Delete the temporary file
      fs.unlinkSync(tempFilePath);
      console.log('Test Upload - Temporary file deleted');
      
      if (!result || !result.secure_url) {
        throw new Error('Cloudinary upload failed to return a valid URL');
      }
      
      console.log('Test Upload - Cloudinary upload successful:', {
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        size: result.bytes
      });
      
      res.status(200).json({ 
        message: "Test upload successful", 
        imageUrl: result.secure_url,
        details: {
          public_id: result.public_id,
          format: result.format,
          size: result.bytes,
          width: result.width,
          height: result.height
        }
      });
    } catch (uploadError) {
      // Clean up temp file if it exists
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      throw uploadError;
    }
  } catch (err) {
    console.error("Test Upload - Error:", err);
    res.status(500).json({ 
      error: "Test upload failed", 
      details: err.message,
      solution: "Please ensure Cloudinary is properly configured"
    });
  }
});

// Get all books with optional grade and publisher filters
router.get("/", async (req, res) => {
  try {
    const { grade, publisher } = req.query;
    
    // Build filter object based on query parameters
    const filter = {};
    
    if (grade) {
      filter.grade = grade;
    }
    
    if (publisher) {
      filter.publisher = publisher;
    }
    
    const books = await Book.find(filter);
    res.json(books);
  } catch (err) {
    console.error("Error fetching books:", err);
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

// Get a single book by bookId
router.get("/:bookId", async (req, res) => {
  try {
    const book = await Book.findOne({ _id: req.params.bookId }); // Use _id for lookup
    if (!book) return res.status(404).json({ error: "Book not found" });
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: "Error fetching book" });
  }
});

// 📌 Fetch chapters for a specific book
router.get("/:bookId/chapters", async (req, res) => {
  try {
    const { bookId } = req.params;

    // Check if book exists
    const bookExists = await Book.findById(bookId);
    if (!bookExists) {
      return res.status(404).json({ error: "Book not found" });
    }

    // Fetch chapters linked to this book
    const chapters = await Chapter.find({ bookId });
    if (chapters.length === 0) {
      return res.status(404).json({ error: "No chapters found for this book" });
    }

    res.json(chapters);
  } catch (err) {
    console.error("Error fetching chapters:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete a book by MongoDB _id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBook = await Book.findByIdAndDelete(id);
    if (!deletedBook) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json({ message: 'Book deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

module.exports = router;
