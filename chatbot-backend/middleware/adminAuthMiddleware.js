const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin"); // Import Admin model
require("dotenv").config();

const authenticateAdmin = async (req, res, next) => {
  try {
    // Extract token from headers
    const token = req.header("Authorization")?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided, authorization denied" });
    }

    // Verify token - use the same JWT_SECRET as for user tokens
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log("🔑 Decoded admin token:", decoded);

    // Find admin by id
    const admin = await Admin.findById(decoded.adminId || decoded.id);
    
    console.log("👤 Admin from DB lookup:", admin ? "Found" : "Not Found");
    
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Check if admin status is approved
    if (admin.status !== "approved") {
      return res.status(403).json({ error: "Admin not approved" });
    }

    // Attach the decoded token info to the request
    req.admin = decoded;
    
    next();
  } catch (err) {
    console.error("🛑 Admin Auth middleware error:", err.message);
    res.status(401).json({ error: "Invalid or expired admin token" });
  }
};

module.exports = authenticateAdmin; 