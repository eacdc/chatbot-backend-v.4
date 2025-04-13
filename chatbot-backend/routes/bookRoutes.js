const express = require("express");
const Book = require("../models/Book");
const Chapter = require("../models/Chapter"); // Import Chapter model
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authenticateAdmin = require("../middleware/adminAuthMiddleware");

// Configure multer storage for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads/bookcovers");
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp
    const uniqueFilename = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    // Accept image files only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  }
});

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

    // Get filename and sanitize it
    const filename = req.file.filename;
    
    // Create URL for the uploaded file
    // For production environments, use HTTPS and the actual domain
    const isProduction = process.env.NODE_ENV === 'production' || process.env.IS_PRODUCTION === 'true';
    let baseUrl;
    
    if (isProduction) {
      // Use the production URL (must be HTTPS)
      baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://chatbot-backend-v-4-1.onrender.com';
    } else {
      // Use local development URL
      baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    }
    
    const relativePath = `/uploads/bookcovers/${filename}`;
    const imageUrl = `${baseUrl}${relativePath}`;

    console.log('Environment:', isProduction ? 'Production' : 'Development');
    console.log('Uploaded image URL:', imageUrl); // Log the URL for debugging
    
    res.status(200).json({ 
      message: "Image uploaded successfully", 
      imageUrl: imageUrl,
      filename: filename
    });
  } catch (err) {
    console.error("Error uploading image:", err);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// Get all books with optional grade filter
router.get("/", async (req, res) => {
  try {
    const { grade } = req.query;
    
    // If grade is provided, filter books by grade
    const filter = grade ? { grade } : {};
    
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

module.exports = router;
