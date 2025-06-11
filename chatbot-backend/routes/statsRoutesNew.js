const express = require("express");
const router = express.Router();

console.log("New stats routes loaded successfully");

router.get("/test", (req, res) => {
    res.json({ 
        success: true, 
        message: "New stats route working" 
    });
});

router.get("/user/:userId", (req, res) => {
    const { userId } = req.params;
    res.json({
        success: true,
        userId: userId,
        data: {
            totalBooksAttempted: 0,
            totalChaptersAttempted: 0,
            totalQuestionsAnswered: 0,
            totalMarksEarned: 0,
            totalMarksAvailable: 0,
            overallPercentage: 0,
            bookStats: [],
            chapterStats: [],
            recentActivity: []
        }
    });
});

module.exports = router; 