const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Ensure correct User model path
require("dotenv").config();

const authenticateUser = async (req, res, next) => {
  try {
    // Extract token from headers
    const token = req.header("Authorization")?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided, authorization denied" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log("🔑 Decoded token:", decoded);

    // FIXED: Changed decoded.id to decoded.userId to match token creation
    const user = await User.findById(decoded.userId);
    
    console.log("👤 User from DB lookup:", user ? "Found" : "Not Found");
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Attach the decoded token info to the request
    req.user = decoded;
    
    // Optionally, if you need all user details:
    // req.userDetails = user;
    
    next();
  } catch (err) {
    console.error("🛑 Auth middleware error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

module.exports = authenticateUser;