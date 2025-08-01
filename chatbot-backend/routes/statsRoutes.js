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
    const { userId } = req.params;
    
    console.log("📊 StatsRoutes: UserId from params:", userId);
    
    try {
        // For now, return mock data
        const mockStats = {
            totalBooks: 5,
            completedBooks: 2,
            inProgressBooks: 2,
            notStartedBooks: 1,
            totalTimeSpent: 1200, // minutes
            averageScore: 85.5,
            streakDays: 7,
            lastActivityDate: new Date(),
            progressOverTime: [
                { date: "2024-01-01", score: 75 },
                { date: "2024-01-02", score: 80 },
                { date: "2024-01-03", score: 85 }
            ]
        };
        
        console.log("📊 StatsRoutes: Returning mock stats:", mockStats);
        
        res.json({
            success: true,
            data: mockStats
        });
    } catch (error) {
        console.error("📊 StatsRoutes: Error getting user stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get user stats"
        });
    }
});

console.log("📊 StatsRoutes: All routes configured successfully");
module.exports = router;
