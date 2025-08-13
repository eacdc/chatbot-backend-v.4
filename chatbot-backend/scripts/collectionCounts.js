const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://ea:Jul020796@chatbot-cluster.mapqyp9.mongodb.net/?retryWrites=true&w=majority&appName=chatbot-cluster";

const collections = [
  'books',
  'chapters',
  'chats',
  'scores',
  'qnalists',
  'subscriptions'
];

async function printCounts() {
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const db = mongoose.connection.db;
  console.log('Connected to DB:', db.databaseName);
  for (const name of collections) {
    const count = await db.collection(name).countDocuments();
    console.log(`${name}: ${count} documents`);
  }
  await mongoose.disconnect();
}

printCounts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 