const cron = require("node-cron");
const PointsTable = require("../models/PointsTable");

// Schedule daily refresh at 2:00 AM (adjust timezone as needed)
// Cron format: minute hour day month dayOfWeek
// '0 2 * * *' = Every day at 2:00 AM
const scheduleRankingRefresh = () => {
    console.log("📅 Ranking scheduler initialized. Will refresh rankings daily at 2:00 AM.");
    
    // Run at 2:00 AM every day
    cron.schedule("0 2 * * *", async () => {
        console.log("🔄 Starting scheduled ranking refresh...");
        try {
            const result = await PointsTable.refreshRankings();
            console.log("✅ Scheduled ranking refresh completed:", result);
        } catch (error) {
            console.error("❌ Error during scheduled ranking refresh:", error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // Adjust timezone as needed
    });
    
    // Optional: Run immediately on startup for testing (comment out in production)
    // Uncomment the line below if you want to refresh rankings on server startup
    // PointsTable.refreshRankings().catch(err => console.error("Error refreshing on startup:", err));
};

module.exports = scheduleRankingRefresh;

