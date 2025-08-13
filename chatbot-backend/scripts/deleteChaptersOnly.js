const mongoose = require('mongoose');
require('dotenv').config();

async function deleteAllChapters() {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Get database instance
        const db = mongoose.connection.db;
        
        // Access the chapters collection directly
        const chaptersCollection = db.collection('chapters');

        console.log('\n🧹 Starting chapter deletion...');

        // Count chapters before deletion
        const countBefore = await chaptersCollection.countDocuments();
        console.log(`📊 Found ${countBefore} chapters`);
        
        if (countBefore > 0) {
            // Delete all chapters
            const result = await chaptersCollection.deleteMany({});
            console.log(`🗑️ Deleted ${result.deletedCount} chapters`);
            
            // Verify deletion
            const countAfter = await chaptersCollection.countDocuments();
            console.log(`✅ Chapters remaining: ${countAfter}`);
        } else {
            console.log('✨ No chapters to delete - collection is already empty');
        }

    } catch (error) {
        console.error('💥 Error during chapter deletion:', error);
    } finally {
        // Close the connection
        await mongoose.connection.close();
        console.log('\n🔐 Database connection closed');
        process.exit(0);
    }
}

// Run the script
console.log('🧹 MongoDB Chapter Deletion Script');
console.log('==================================');
console.log('⚠️  WARNING: This will permanently delete ALL chapters from the database!');
console.log('🚨 This action cannot be undone!');

// Add a small delay to allow user to cancel with Ctrl+C
console.log('\n⏳ Starting in 3 seconds (press Ctrl+C to cancel)...');
setTimeout(() => {
    deleteAllChapters().catch(console.error);
}, 3000);

// Handle ctrl+c gracefully
process.on('SIGINT', () => {
    console.log('\n\n⏹️ Operation cancelled by user');
    process.exit(0);
});