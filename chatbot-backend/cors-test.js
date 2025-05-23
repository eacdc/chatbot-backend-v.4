// Simple CORS test script
const express = require('express');
const cors = require('cors');
const app = express();

// Basic CORS setup - allow all origins
app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'user-id', 'x-requested-with', 'Access-Control-Allow-Origin']
}));

// Add CORS headers to all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, user-id');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'CORS test successful!' });
});

// Test endpoint that mimics the generate-qna endpoint
app.post('/api/chapters/generate-qna', (req, res) => {
  console.log('Received request to test generate-qna endpoint');
  // Simulate a short delay
  setTimeout(() => {
    res.json({ 
      success: true, 
      message: 'Test response from generate-qna endpoint',
      analyzedQuestions: [
        {
          subtopic: 'Test Subtopic',
          question: 'This is a test question?',
          difficultyLevel: 'Medium',
          question_marks: 3,
          tentativeAnswer: 'This is a test answer',
          questionId: `QID-${Date.now()}`
        }
      ]
    });
  }, 500);
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`CORS test server running on port ${PORT}`);
  console.log(`Test URL: http://localhost:${PORT}/test`);
  console.log(`Test generate-qna URL: http://localhost:${PORT}/api/chapters/generate-qna`);
}); 