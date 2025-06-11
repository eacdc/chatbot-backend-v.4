const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Chapter = require('../models/Chapter');
const QnALists = require('../models/QnALists');
const Subscription = require('../models/Subscription');
const Chat = require('../models/Chat');

// Define collections to clear
const collectionsToDelete = [
    { name: 'chapters', model: Chapter },
    { name: 'qnalists', model: QnALists },
    { name: 'subscriptions', model: Subscription },
    { name: 'chats', model: Chat }
];

// Additional collections that might exist (for chat history, etc.)
const additionalCollections = ['chathistories', 'chatmessages'];

async function clearCollections() {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Get database instance
        const db = mongoose.connection.db;

        console.log('\n🧹 Starting collection clearing...\n');

        // Clear collections with models
        let totalDeleted = 0;
        for (const collection of collectionsToDelete) {
            try {
                const count = await collection.model.countDocuments();
                console.log(`📊 ${collection.name}: Found ${count} documents`);
                
                if (count > 0) {
                    const result = await collection.model.deleteMany({});
                    console.log(`🗑️ ${collection.name}: Deleted ${result.deletedCount} documents`);
                    totalDeleted += result.deletedCount;
                } else {
                    console.log(`✨ ${collection.name}: Already empty`);
                }
            } catch (error) {
                console.error(`❌ Error clearing ${collection.name}:`, error.message);
            }
        }

        // Clear additional collections without models
        for (const collectionName of additionalCollections) {
            try {
                const collection = db.collection(collectionName);
                const count = await collection.countDocuments();
                console.log(`📊 ${collectionName}: Found ${count} documents`);
                
                if (count > 0) {
                    const result = await collection.deleteMany({});
                    console.log(`🗑️ ${collectionName}: Deleted ${result.deletedCount} documents`);
                    totalDeleted += result.deletedCount;
                } else {
                    console.log(`✨ ${collectionName}: Already empty`);
                }
            } catch (error) {
                console.error(`❌ Error clearing ${collectionName}:`, error.message);
            }
        }

        console.log(`\n🎉 Collection clearing completed! Total deleted: ${totalDeleted} documents`);
        
        // Show final status
        console.log('\n📋 Final Status:');
        for (const collection of collectionsToDelete) {
            const finalCount = await collection.model.countDocuments();
            console.log(`   ${collection.name}: ${finalCount} documents remaining`);
        }
        
        for (const collectionName of additionalCollections) {
            try {
                const collection = db.collection(collectionName);
                const finalCount = await collection.countDocuments();
                console.log(`   ${collectionName}: ${finalCount} documents remaining`);
            } catch (error) {
                console.log(`   ${collectionName}: Collection may not exist`);
            }
        }

    } catch (error) {
        console.error('💥 Error during collection clearing:', error);
    } finally {
        // Close the connection
        await mongoose.connection.close();
        console.log('\n🔐 Database connection closed');
        process.exit(0);
    }
}

// Confirmation prompt
function confirmDeletion() {
    return new Promise((resolve) => {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('⚠️  WARNING: This will permanently delete ALL data from the following collections:');
        console.log('   - chapters');
        console.log('   - subscriptions'); 
        console.log('   - chats');
        console.log('   - qnalists');
        console.log('   - chathistories (if exists)');
        console.log('   - chatmessages (if exists)');
        console.log('\n🚨 This action cannot be undone!');
        
        readline.question('\nAre you sure you want to proceed? Type "YES" to confirm: ', (answer) => {
            readline.close();
            resolve(answer === 'YES');
        });
    });
}

// Main execution
async function main() {
    console.log('🧹 MongoDB Specific Collections Cleaner');
    console.log('=======================================');
    
    const confirmed = await confirmDeletion();
    
    if (confirmed) {
        console.log('\n✅ Confirmation received. Starting deletion...\n');
        await clearCollections();
    } else {
        console.log('\n❌ Operation cancelled. No data was deleted.');
        process.exit(0);
    }
}

// Handle ctrl+c gracefully
process.on('SIGINT', () => {
    console.log('\n\n⏹️ Operation cancelled by user');
    process.exit(0);
});

// Run the script
main().catch(console.error); 