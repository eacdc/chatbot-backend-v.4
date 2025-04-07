require("dotenv").config(); // ✅ Load environment variables first

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression"); // Add compression middleware

console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "Loaded" : "Not Found");

const app = express();
app.use(express.json({ limit: '100mb' })); // Increase JSON body size limit to handle very large texts
app.use(express.urlencoded({ extended: true, limit: '100mb' })); // Increase URL-encoded body size limit
app.use(compression()); // Use compression for all responses

// ✅ Improved CORS
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://chatbot-frontend-v-4.onrender.com",
      "https://chatbot-backend-v-4-1.onrender.com",
      process.env.FRONTEND_URL || "http://localhost:3000"
    ].filter(Boolean),
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "user-id", "x-requested-with"]
  })
);

// ✅ Debug Middleware (Logs API requests)
app.use((req, res, next) => {
  console.log(`📩 ${req.method} Request to ${req.url}`);
  if (Object.keys(req.body).length) console.log("Request Body:", req.body);
  next();
});

// Handle OPTIONS preflight requests
app.options('*', cors());

// ✅ Import Routes
const chatRoutes = require("./routes/chatRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const bookRoutes = require("./routes/bookRoutes");
const chapterRoutes = require("./routes/chapterRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");

// ✅ Use Routes
app.use("/api/chat", chatRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/chapters", chapterRoutes);
app.use("/api/subscriptions", subscriptionRoutes);

// Add root route handler
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Chatbot API" });
});

// Handle 404 errors
app.use((req, res) => {
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
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
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
