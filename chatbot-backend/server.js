// Increase Node.js heap memory limit to 8GB
process.env.NODE_OPTIONS = '--max-old-space-size=8192';

// Enable garbage collection
global.gc = function() {
  try {
    if (global.gc) {
      console.log("Triggering manual garbage collection");
      const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const startTime = Date.now();
      global.gc();
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      console.log(`GC completed in ${endTime - startTime}ms. Memory before: ${startMemory.toFixed(2)}MB, after: ${endMemory.toFixed(2)}MB, freed: ${(startMemory - endMemory).toFixed(2)}MB`);
    }
  } catch (e) {
    console.error("Error during garbage collection:", e);
  }
};

// Monitor memory usage
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  console.log(`Memory usage: RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB, Heap Total: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB, Heap Used: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  
  // Force garbage collection if memory usage is too high
  if (memoryUsage.heapUsed > 6 * 1024 * 1024 * 1024) { // 6GB threshold
    console.log("Memory usage is high, forcing garbage collection");
    global.gc && global.gc();
  }
}, 60000); // Check every minute

require("dotenv").config(); // ✅ Load environment variables first

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression"); // Add compression middleware
const path = require("path");
const fs = require("fs");

console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "Loaded" : "Not Found");
console.log("Cloudinary Configuration:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? "Loaded" : "Not Found",
  api_key: process.env.CLOUDINARY_API_KEY ? "Loaded" : "Not Found",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "Loaded" : "Not Found"
});

const app = express();
app.use(express.json({ limit: '50mb' })); // Reduced from 100mb to 50mb
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Reduced from 100mb to 50mb
app.use(compression()); // Use compression for all responses

// Define allowed origins
const allowedOrigins = [
  'https://www.testyourlearning.com',
  'https://testyourlearning.com',
  'http://localhost:3000',
  'http://localhost:5000'
];

// ✅ Simplified CORS setup - allow all origins for now to debug the issue
app.use(cors({
  origin: '*', // Allow all origins temporarily to debug
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "user-id", "x-requested-with", "Access-Control-Allow-Origin"]
}));

// Add CORS headers to all responses
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Allow all origins temporarily
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, user-id, Access-Control-Allow-Origin");
  res.header("Access-Control-Allow-Credentials", "true");
  
  // Handle preflight requests immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Handle OPTIONS preflight requests
app.options('*', (req, res) => {
  res.header("Access-Control-Allow-Origin", "*"); // Allow all origins temporarily
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, user-id, Access-Control-Allow-Origin");
  res.header("Access-Control-Allow-Credentials", "true");
  res.status(200).end();
});

// ✅ Debug Middleware (Logs API requests)
app.use((req, res, next) => {
  console.log(`📩 ${req.method} Request to ${req.url}`);
  if (req.method !== 'OPTIONS' && Object.keys(req.body).length) {
    if (req.url.includes('/generate-qna')) {
      // For large text requests, just log the length instead of the full body
      const bodySize = JSON.stringify(req.body).length;
      console.log(`Request Body size: ${(bodySize / 1024).toFixed(2)}KB`);
    } else {
      console.log("Request Body:", req.body);
    }
  }
  next();
});

// Add timeout middleware for long-running requests
app.use((req, res, next) => {
  // Set a 2-minute timeout for all requests
  req.setTimeout(120000, () => {
    console.log(`Request timeout for ${req.method} ${req.url}`);
    if (!res.headersSent) {
      res.status(503).json({ error: "Request timed out" });
    }
  });
  next();
});

// ✅ Import Routes
// Add back routes one by one
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const bookRoutes = require("./routes/bookRoutes");
const chapterRoutes = require("./routes/chapterRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const promptRoutes = require("./routes/promptRoutes");
const chatRoutes = require("./routes/chatRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const statsRoutes = require("./routes/statsRoutes"); // Step 1: Re-enabled

// Optional routes - check if file exists first
let bookCoversRoutes;
try {
  bookCoversRoutes = require("./routes/bookcovers");
} catch (error) {
  console.log("Note: bookcovers routes not found, skipping");
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
const bookCoversDir = path.join(__dirname, 'uploads/bookcovers');
if (!fs.existsSync(uploadsDir)) {
  console.log('Creating uploads directory...');
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(bookCoversDir)) {
  console.log('Creating book covers directory...');
  fs.mkdirSync(bookCoversDir, { recursive: true });
}

// Serve static files from the uploads directory
app.use('/uploads', (req, res, next) => {
  console.log(`Static file request: ${req.url}`);
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Log all available directories in uploads folder
console.log('Uploads directories:');
if (fs.existsSync(uploadsDir)) {
  fs.readdirSync(uploadsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .forEach(dirent => console.log(`- ${dirent.name}`));
}

// Add routes one by one
app.use("/api/users", userRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/chapters", chapterRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/prompts", promptRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/stats", statsRoutes); // Step 1: Re-enabled

// Only add bookcovers route if it exists
if (bookCoversRoutes) {
  app.use("/api/bookcovers", bookCoversRoutes);
}

// Add root route handler back
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Chatbot API" });
});

// Add a simple health check route
app.get("/healthcheck", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

// Temporary endpoint removed - using statsRoutes now

// ✅ Fetch chapters by bookId API (Newly Added)
const Chapter = require("./models/Chapter");
app.get("/api/books/:bookId/chapters", async (req, res) => {
  try {
    const { bookId } = req.params;

    // Convert ObjectId to string before querying chapters
    const chapters = await Chapter.find({ bookId: bookId.toString() });

    if (chapters.length === 0) {
      return res.status(404).json({ error: "No chapters found for this book" });
    }

    res.json(chapters);
  } catch (error) {
    console.error("🔥 Error fetching chapters:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Handle 404 errors - MOVED AFTER all routes including static file handling
app.use((req, res) => {
  console.log(`🔴 404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ message: "Route not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// ✅ MongoDB Connection with Error Handling
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("✅ MongoDB Connected Successfully");
    
    // Initialize default configurations
    try {
      // Initialize Config defaults
      const Config = require("./models/Config");
      await Config.initDefaults();
      console.log("✅ Config defaults initialized");
      
      // Initialize Prompt defaults
      const Prompt = require("./models/Prompt");
      await Prompt.initDefaults();
      console.log("✅ Prompt defaults initialized");
    } catch (initError) {
      console.error("❌ Error initializing defaults:", initError);
    }
    
    // Start server only after successful database connection
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
      console.log(`✅ Environment: ${process.env.NODE_ENV}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ✅ Global Error Handler (Better debugging)
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.message);
  res.status(500).json({ error: "Internal Server Error" });
});

// ✅ Handle Uncaught Errors
process.on("unhandledRejection", (err) => {
  console.error("💥 Unhandled Promise Rejection:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
  process.exit(1);
});
