const express = require("express");
const Book = require("../models/Book");
const Chapter = require("../models/Chapter"); // Import Chapter model
const router = express.Router();

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
