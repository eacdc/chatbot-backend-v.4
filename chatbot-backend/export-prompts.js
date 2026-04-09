// Script to export all documents from the "prompts" collection into a JSON file.
// Usage (from chatbot-backend folder):
//   node export-prompts.js

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env variables so we can reuse the same Mongo URI as the app
dotenv.config();

// Reuse existing Mongoose model
const Prompt = require('./models/Prompt');

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || `mongodb+srv://ea:Jul020796@chatbot-cluster.mapqyp9.mongodb.net/?retryWrites=true&w=majority&appName=chatbot-cluster`;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI is not set in environment variables.');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected.');

    console.log('Fetching all prompts...');
    const prompts = await Prompt.find({}).lean();
    console.log(`Fetched ${prompts.length} prompts.`);

    // Prepare output folder and file name
    const exportDir = path.join(__dirname, 'prompt-exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(exportDir, `prompts-${timestamp}.json`);

    // Write pretty-printed JSON for readability
    fs.writeFileSync(filePath, JSON.stringify(prompts, null, 2), 'utf8');

    console.log(`Export complete. File saved at: ${filePath}`);
  } catch (err) {
    console.error('Error exporting prompts:', err);
  } finally {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  }
}

main();

