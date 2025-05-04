const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Chapter = require("../models/Chapter");
const Book = require("../models/Book");
const authenticateAdmin = require("../middleware/adminAuthMiddleware");
const { processQuestionBatch } = require('../scripts/processQuestionBatch');
require("dotenv").config();

const router = express.Router();

// Admin Registration (Pending Approval)
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword,
      status: "pending", // 🚀 Pending approval
    });

    await newAdmin.save();
    res.status(201).json({ message: "Admin registered. Awaiting approval." });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Approve/Reject Admin (Super Admin Only)
router.put("/approve/:adminId", async (req, res) => {
  const { adminId } = req.params;
  const { status } = req.body; // "approved" or "rejected"

  try {
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    admin.status = status;
    await admin.save();

    res.json({ message: `Admin ${status} successfully.` });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Admin Login (Only Approved Admins Can Login)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    if (admin.status !== "approved") {
      return res.status(403).json({ message: "Admin approval pending." });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const payload = {
      adminId: admin._id,
      name: admin.name,
      email: admin.email,
      role: "admin"
    };

    // Sign token with same JWT_SECRET as user auth
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "1d" }, // Token expires in 1 day
      (err, token) => {
        if (err) throw err;
        res.json({
          message: "Login successful",
          token,
          adminId: admin._id
        });
      }
    );
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Process batch questions for a chapter
router.post("/chapters/:chapterId/process-questions", authenticateAdmin, async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { batchText } = req.body;

    if (!batchText) {
      return res.status(400).json({ error: "Question batch text is required" });
    }

    console.log(`Processing question batch for chapter ${chapterId}`);
    
    // Find the chapter
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    // Parse the batch text to ensure it's in the correct format
    // Each line should be a valid JSON object
    const lines = batchText.split(/\r?\n/).filter(line => line.trim());
    const questions = [];
    let errorCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      try {
        const line = lines[i];
        // Parse the JSON object
        const questionObj = JSON.parse(line);
        
        // Validate the required fields
        if (questionObj.Q !== undefined && questionObj.question) {
          // Add default values for missing fields and generate a unique questionId
          questions.push({
            questionId: questionObj.questionId || `QID-${chapter._id}-${i}-${Date.now()}`,
            Q: questionObj.Q,
            question: questionObj.question,
            question_answered: questionObj.question_answered || false,
            question_marks: questionObj.question_marks || 1,
            marks_gained: questionObj.marks_gained || 0
          });
        } else {
          console.log(`Line ${i+1}: Missing required fields (Q or question)`);
          errorCount++;
        }
      } catch (error) {
        console.error(`Error parsing line ${i+1}:`, error.message);
        errorCount++;
      }
    }
    
    if (questions.length === 0) {
      return res.status(400).json({ 
        error: "No valid questions found in batch",
        totalLines: lines.length,
        errorCount
      });
    }
    
    // Update the chapter with the processed questions
    chapter.questionPrompt = questions;
    await chapter.save();
    
    res.json({
      success: true,
      message: `Processed ${questions.length} questions (${errorCount} errors)`,
      totalQuestions: questions.length,
      errorCount,
      questions
    });
    
  } catch (error) {
    console.error("Error processing batch questions:", error);
    res.status(500).json({ error: "Error processing batch questions", message: error.message });
  }
});

// Get all questions for a chapter
router.get("/chapters/:chapterId/questions", authenticateAdmin, async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ error: "Chapter not found" });
    }
    
    // Return the questions array or empty array if not defined
    const questions = chapter.questionPrompt || [];
    
    res.json({
      chapterId,
      chapterTitle: chapter.title,
      totalQuestions: questions.length,
      questions
    });
    
  } catch (error) {
    console.error("Error fetching chapter questions:", error);
    res.status(500).json({ error: "Error fetching questions", message: error.message });
  }
});

// Generate sample JSON format for frontend reference
router.get("/question-format", authenticateAdmin, (req, res) => {
  const sampleFormat = [
    {
      "Q": 1,
      "question": "Sample multiple choice question (a) Option 1 (b) Option 2 (c) Option 3 (d) Option 4",
      "question_answered": false,
      "question_marks": 2,
      "marks_gained": 0
    },
    {
      "Q": 2,
      "question": "Sample short answer question",
      "question_answered": false,
      "question_marks": 3,
      "marks_gained": 0
    }
  ];
  
  res.json({
    format: sampleFormat,
    instructions: "Each question should be a JSON object on a separate line. Required fields are 'Q' and 'question'."
  });
});

module.exports = router;
