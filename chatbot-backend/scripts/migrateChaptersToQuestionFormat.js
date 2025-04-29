/**
 * Migration script to add the questionPrompt array to existing chapters
 * 
 * This script looks for a JSON array in the existing prompt field and converts it to the questionPrompt array format
 * Run with: node scripts/migrateChaptersToQuestionFormat.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Chapter = require('../models/Chapter');
const Config = require('../models/Config');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function migrateChapters() {
  try {
    console.log('Starting chapter migration...');
    
    // Initialize Config model with defaults
    try {
      await Config.initDefaults();
      console.log("Config defaults initialized");
    } catch (error) {
      console.error("Error initializing config defaults:", error);
    }
    
    // Get all chapters
    const chapters = await Chapter.find({});
    console.log(`Found ${chapters.length} chapters to process`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const chapter of chapters) {
      try {
        // Check if the chapter already has questionPrompt array with items
        if (chapter.questionPrompt && chapter.questionPrompt.length > 0) {
          console.log(`Chapter ${chapter._id} already has questionPrompt array. Skipping.`);
          skipped++;
          continue;
        }
        
        // Look for a JSON array in the prompt field
        try {
          // First check if the prompt contains something that looks like a JSON array
          if (chapter.prompt && (chapter.prompt.trim().startsWith('[') && chapter.prompt.trim().endsWith(']'))) {
            const promptStr = chapter.prompt.trim();
            try {
              const parsedPrompt = JSON.parse(promptStr);
              
              // Check if it's an array of objects with the expected format
              if (Array.isArray(parsedPrompt) && 
                  parsedPrompt.length > 0 && 
                  parsedPrompt[0].Q !== undefined && 
                  parsedPrompt[0].question !== undefined) {
                
                // Set the questionPrompt array
                chapter.questionPrompt = parsedPrompt.map(item => ({
                  Q: item.Q,
                  question: item.question,
                  question_answered: item.question_answered || false,
                  question_marks: item.question_marks || 1,
                  marks_gained: item.marks_gained || 0
                }));
                
                // Save the updated chapter
                await chapter.save();
                console.log(`Migrated chapter ${chapter._id} with ${parsedPrompt.length} questions`);
                migrated++;
              } else {
                console.log(`Chapter ${chapter._id} has JSON array but not in expected format. Skipping.`);
                skipped++;
              }
            } catch (parseError) {
              console.error(`Error parsing JSON in chapter ${chapter._id}:`, parseError.message);
              errors++;
            }
          } else {
            console.log(`Chapter ${chapter._id} does not contain a JSON array. Skipping.`);
            skipped++;
          }
        } catch (promptError) {
          console.error(`Error processing prompt for chapter ${chapter._id}:`, promptError.message);
          errors++;
        }
      } catch (chapterError) {
        console.error(`Error processing chapter ${chapter._id}:`, chapterError.message);
        errors++;
      }
    }
    
    console.log('\nMigration completed:');
    console.log(`- Migrated: ${migrated} chapters`);
    console.log(`- Skipped: ${skipped} chapters (already migrated or no JSON array)`);
    console.log(`- Errors: ${errors} chapters`);
    
    // If we successfully migrated any chapters, ask user if they want to enable question mode
    if (migrated > 0) {
      console.log('\nWould you like to enable Question Mode now? (y/n)');
      
      // Simple CLI prompt for yes/no
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      process.stdin.on('data', async function (text) {
        const answer = text.trim().toLowerCase();
        
        if (answer === 'y' || answer === 'yes') {
          try {
            await Config.findOneAndUpdate(
              { key: 'questionMode' },
              { value: true },
              { new: true }
            );
            console.log('Question Mode has been enabled.');
          } catch (error) {
            console.error('Error updating question mode config:', error);
          }
        } else {
          console.log('Question Mode remains disabled. You can enable it later through the admin API.');
        }
        
        process.stdin.pause();
        mongoose.connection.close();
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    } else {
      mongoose.connection.close();
      console.log('MongoDB connection closed');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the migration
migrateChapters(); 