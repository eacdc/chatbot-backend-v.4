const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/authMiddleware");

console.log("📊 StatsRoutes: File loaded successfully");
console.log("📊 StatsRoutes: Express router created");
console.log("📊 StatsRoutes: AuthenticateUser middleware imported");

// Test route to verify stats routes are working
router.get("/test", (req, res) => {
    console.log("📊 StatsRoutes: Test route called");
    res.json({ 
        success: true, 
        message: "Stats route is working" 
    });
});

// User stats endpoint with detailed logging
router.get("/user/:userId", authenticateUser, async (req, res) => {
    console.log("📊 StatsRoutes: User stats endpoint called");
    console.log("📊 StatsRoutes: Starting user stats request");
    
    try {
        const { userId } = req.params;
        console.log(`📊 StatsRoutes: Processing stats for user: ${userId}`);
        console.log("📊 StatsRoutes: User ID extracted from params successfully");

        console.log("📊 StatsRoutes: Creating response object");
        const response = {
                success: true,
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
        };

        console.log("📊 StatsRoutes: Response object created successfully");
        console.log("📊 StatsRoutes: Sending response to client");
        res.json(response);
        console.log("📊 StatsRoutes: Response sent successfully");

    } catch (error) {
        console.error("📊 StatsRoutes: ERROR occurred:", error);
        console.error("📊 StatsRoutes: Error message:", error.message);
        console.error("📊 StatsRoutes: Error stack:", error.stack);
        res.status(500).json({ 
            success: false, 
            error: "Failed to fetch statistics", 
            details: error.message 
        });
    }
});

console.log("📊 StatsRoutes: All routes defined successfully");
console.log("📊 StatsRoutes: About to export router");

module.exports = router;

console.log("📊 StatsRoutes: Router exported successfully");
