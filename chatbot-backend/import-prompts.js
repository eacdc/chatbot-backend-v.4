// Script to IMPORT all prompts from the latest JSON export into a target MongoDB.
// Usage (from chatbot-backend folder):
//   1) Set the target URI (recommended):
//        On Windows CMD:
//          set TARGET_MONGODB_URI="your-mongodb-uri-here"
//        On PowerShell:
//          $env:TARGET_MONGODB_URI="your-mongodb-uri-here"
//   2) Run:
//          node import-prompts.js
//
// The script will:
//   - Read the most recent JSON file from ./prompt-exports
//   - Upsert documents into the "prompts" collection based on prompt_type

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Prompt = require('./models/Prompt');

async function getLatestExportFile() {
  const exportDir = path.join(__dirname, 'prompt-exports');
  if (!fs.existsSync(exportDir)) {
    throw new Error(`Export directory not found: ${exportDir}`);
  }

  const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.json'));
  if (!files.length) {
    throw new Error(`No JSON files found in ${exportDir}`);
  }

  // Pick the file with the latest modification time
  const latest = files
    .map(name => {
      const fullPath = path.join(exportDir, name);
      const stat = fs.statSync(fullPath);
      return { name, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];

  return path.join(exportDir, latest.name);
}

async function main() {
  try {
    // Leave URI effectively "blank" so you can provide it explicitly
    const mongoUri =
      process.env.TARGET_MONGODB_URI ||
      'mongodb+srv://portal_app:ESU1EOvOBDOCWlAK@portal.wetssq.mongodb.net/TYL?retryWrites=true&w=majority&appName=TYL'; // <--- put target MongoDB URI here if you prefer hard-coding

    if (!mongoUri) {
      throw new Error(
        'TARGET_MONGODB_URI is not set. Set it in environment or hard-code it in import-prompts.js.'
      );
    }

    console.log('Connecting to target MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to target MongoDB.');

    const filePath = await getLatestExportFile();
    console.log(`Reading prompts from: ${filePath}`);

    const raw = fs.readFileSync(filePath, 'utf8');
    const docs = JSON.parse(raw);

    console.log(`Importing ${docs.length} prompts (upsert by prompt_type)...`);

    for (const doc of docs) {
      const { _id, ...rest } = doc;
      if (!rest.prompt_type) {
        console.warn('Skipping prompt without prompt_type:', doc);
        continue;
      }

      await Prompt.updateOne(
        { prompt_type: rest.prompt_type },
        { $set: rest },
        { upsert: true }
      );
    }

    console.log('Prompt import completed successfully.');
  } catch (err) {
    console.error('Error importing prompts:', err);
  } finally {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  }
}

main();

