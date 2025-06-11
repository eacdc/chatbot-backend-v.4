const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Ensure correct User model path
require("dotenv").config();

const authenticateUser = async (req, res, next) => {
  try {
    console.log("🔑 Auth middleware - checking request:", req.method, req.url);
    console.log("🔑 Auth headers:", req.headers.authorization ? "Present" : "Missing");
    
    // Extract token from headers
    const token = req.header("Authorization")?.split(" ")[1];

    if (!token) {
      console.log("🔑 No token provided");
      return res.status(401).json({ error: "No token provided, authorization denied" });
    }

    console.log("🔑 Token received (first 20 chars):", token.substring(0, 20) + "...");

    // Check if JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error("🔑 JWT_SECRET not found in environment variables");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log("🔑 Decoded token:", decoded);

    // FIXED: Changed decoded.id to decoded.userId to match token creation
    try {
      const user = await User.findById(decoded.userId);
      console.log("👤 User from DB lookup:", user ? `Found: ${user.username}` : "Not Found");
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Attach the decoded token info to the request
      req.user = decoded;
      
      // Optionally, if you need all user details:
      // req.userDetails = user;
      
      console.log("🔑 Auth successful, proceeding to next middleware");
      next();
    } catch (dbError) {
      console.error("👤 Database error during user lookup:", dbError);
      return res.status(500).json({ error: "Database error during authentication" });
    }
  } catch (err) {
    console.error("🛑 Auth middleware error:", err.message);
    console.error("🛑 Error type:", err.name);
    if (err.name === 'JsonWebTokenError') {
      console.error("🛑 Invalid JWT token");
      res.status(401).json({ error: "Invalid token format" });
    } else if (err.name === 'TokenExpiredError') {
      console.error("🛑 JWT token expired");
      res.status(401).json({ error: "Token expired" });
    } else {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  }
};

module.exports = authenticateUser;