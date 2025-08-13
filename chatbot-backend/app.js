const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000',
  'https://www.testyourlearning.com',
  'https://testyourlearning.com',
  'https://chatbot-frontend-v4.onrender.com'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Origin not allowed by CORS:', origin);
      callback(null, true); // Allow all origins for now to debug
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "user-id", "x-requested-with"]
}));

// Add CORS headers to all responses as a backup
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  } else {
    res.header("Access-Control-Allow-Origin", "*"); // Allow all for now
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, user-id");
  res.header("Access-Control-Allow-Credentials", "true");
  
  if (req.method === 'OPTIONS') {
    // Pre-flight request, respond immediately with 200
    return res.status(200).end();
  }
  next();
});

// Handle OPTIONS preflight requests
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  });

// Import route files
const chatRoutes = require("./routes/chatRoutes");
const userRoutes = require("./routes/userRoutes");
const bookRoutes = require("./routes/bookRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const chapterRoutes = require("./routes/chapterRoutes");
const promptRoutes = require("./routes/promptRoutes");
const adminRoutes = require("./routes/adminRoutes");
const scoresRoutes = require("./routes/scores");
const statsRoutesNew = require("./routes/statsRoutesNew");

// Use routes
app.use("/api/chat", chatRoutes);
app.use("/api/users", userRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/chapters", chapterRoutes);
app.use("/api/prompts", promptRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/scores", scoresRoutes);
app.use("/api/stats", statsRoutesNew);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ 
    message: "Backend is running successfully!", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "Chatbot Backend API is running", 
    endpoints: [
      "/api/health",
      "/api/users/login",
      "/api/users/signup",
      "/api/books",
      "/api/subscriptions"
    ]
  });
});

// Serve static files if in production
if (process.env.NODE_ENV === 'production') {
  // Serve any static files
  app.use(express.static(path.join(__dirname, '../client/build')));

  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: "Server error", 
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message 
  });
});

// Set port and start server with improved connection handling
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Configure server timeouts to prevent connection resets
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds (slightly higher than keepAliveTimeout)
console.log(`Server configured with keepAliveTimeout: ${server.keepAliveTimeout}ms, headersTimeout: ${server.headersTimeout}ms`);

module.exports = app; 