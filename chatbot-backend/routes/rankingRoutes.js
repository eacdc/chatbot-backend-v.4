const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/authMiddleware");
const PointsTable = require("../models/PointsTable");

// Get user's ranking with neighbors (5 above and 5 below)
router.get("/my-ranking", authenticateUser, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const result = await PointsTable.getUserRanking(userId, 5);
        
        if (!result.success) {
            return res.status(404).json({
                success: false,
                message: result.message
            });
        }
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error("Error fetching user ranking:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching ranking",
            error: error.message
        });
    }
});

// Get full leaderboard (optional - for admin or public view)
router.get("/leaderboard", async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const skip = parseInt(req.query.skip) || 0;
        
        const leaderboard = await PointsTable.find({})
            .sort({ rank: 1 })
            .limit(limit)
            .skip(skip)
            .populate('userId', 'username fullname')
            .select('rank userId username fullname points quizTimeHours totalMarksEarned');
        
        const totalUsers = await PointsTable.countDocuments();
        
        res.json({
            success: true,
            data: {
                leaderboard: leaderboard.map(entry => ({
                    rank: entry.rank,
                    userId: entry.userId._id,
                    username: entry.username,
                    fullname: entry.fullname,
                    points: entry.points,
                    quizTimeHours: entry.quizTimeHours,
                    totalMarksEarned: entry.totalMarksEarned
                })),
                totalUsers: totalUsers,
                limit: limit,
                skip: skip
            }
        });
        
    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching leaderboard",
            error: error.message
        });
    }
});

// Manual refresh endpoint (for admin/testing)
router.post("/refresh", authenticateUser, async (req, res) => {
    try {
        // Check if user is admin (you may want to add admin check here)
        const result = await PointsTable.refreshRankings();
        
        res.json({
            success: true,
            message: "Rankings refreshed successfully",
            data: result
        });
        
    } catch (error) {
        console.error("Error refreshing rankings:", error);
        res.status(500).json({
            success: false,
            message: "Error refreshing rankings",
            error: error.message
        });
    }
});

module.exports = router;

