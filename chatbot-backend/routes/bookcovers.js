const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

// GET /api/bookcovers - Get list of book covers
router.get("/", (req, res) => {
  try {
    const bookCoversDir = path.join(__dirname, '../uploads/bookcovers');
    
    if (!fs.existsSync(bookCoversDir)) {
      return res.status(200).json([]);
    }
    
    const files = fs.readdirSync(bookCoversDir)
      .filter(file => file.match(/\.(jpg|jpeg|png|gif)$/i))
      .map(file => ({
        filename: file,
        url: `/uploads/bookcovers/${file}`
      }));
      
    res.status(200).json(files);
  } catch (error) {
    console.error("Error getting book covers:", error);
    res.status(500).json({ error: "Failed to get book covers" });
  }
});

// Test endpoint to make sure router is loaded properly
router.get("/test", (req, res) => {
  res.json({ message: "Bookcovers router is working!" });
});

module.exports = router; 