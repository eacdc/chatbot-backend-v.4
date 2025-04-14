const express = require("express");
const Book = require("../models/Book");
const Chapter = require("../models/Chapter"); // Import Chapter model
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authenticateAdmin = require("../middleware/adminAuthMiddleware");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo', 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

// Configure multer storage for image uploads
// Use memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

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

    console.log('Received file:', req.file.originalname, 'Size:', req.file.size);

    // Try to use Cloudinary for storage first
    let imageUrl;
    let useCloudinary = true;
    
    try {
      if (process.env.CLOUDINARY_API_KEY) {
        // Create a buffer from the file
        const buffer = req.file.buffer;
        
        // Create a temporary file for Cloudinary upload
        const tempFilePath = path.join(__dirname, `../temp-${Date.now()}.jpg`);
        fs.writeFileSync(tempFilePath, buffer);
        
        console.log(`Uploading to Cloudinary: ${tempFilePath}`);
        
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(tempFilePath, {
          folder: "book-covers",
          resource_type: "image"
        });
        
        // Delete the temporary file
        fs.unlinkSync(tempFilePath);
        
        // Get the secure URL from Cloudinary
        imageUrl = result.secure_url;
        console.log('Cloudinary upload successful, URL:', imageUrl);
      } else {
        useCloudinary = false;
        console.log('Cloudinary credentials not found, falling back to local storage');
      }
    } catch (cloudinaryError) {
      useCloudinary = false;
      console.error('Cloudinary upload failed:', cloudinaryError);
      console.log('Falling back to local storage');
    }
    
    // Fall back to local storage if Cloudinary fails or is not configured
    if (!useCloudinary) {
      // Create local directory if not exists
      const uploadDir = path.join(__dirname, "../uploads/bookcovers");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // Save file locally
      const filename = `${Date.now()}-${req.file.originalname}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, req.file.buffer);
      
      // Check if file exists after saving
      const fileExists = fs.existsSync(filePath);
      console.log(`Local file saved: ${filePath}, exists: ${fileExists}`);
      
      // Create URL for the uploaded file
      const isProduction = process.env.NODE_ENV === 'production' || process.env.IS_PRODUCTION === 'true';
      let baseUrl;
      
      if (isProduction) {
        baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://chatbot-backend-v-4-1.onrender.com';
      } else {
        baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      }
      
      const relativePath = `/uploads/bookcovers/${filename}`;
      imageUrl = `${baseUrl}${relativePath}`;
    }

    console.log('Final image URL:', imageUrl);
    
    res.status(200).json({ 
      message: "Image uploaded successfully", 
      imageUrl: imageUrl,
      storage: useCloudinary ? 'cloudinary' : 'local'
    });
  } catch (err) {
    console.error("Error uploading image:", err);
    res.status(500).json({ error: "Failed to upload image", details: err.message });
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
