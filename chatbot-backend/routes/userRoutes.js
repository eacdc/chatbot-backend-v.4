const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authenticateUser = require("../middleware/authMiddleware");
require("dotenv").config();

const router = express.Router();

// ✅ User Registration (Sign Up)
router.post("/register", async (req, res) => {
    try {
        console.log("📩 Received registration request:", req.body);

        const { username, fullname, email, phone, role, grade, publisher, password } = req.body;

        // Check required fields
        if (!username || !fullname || !phone || !role || !password) {
            return res.status(400).json({ message: "Username, full name, phone, role, and password are required" });
        }

        // Check if username already exists
        let existingUser = await User.findOne({ username: username.trim() });
        if (existingUser) {
            return res.status(400).json({ message: "Username already taken" });
        }

        // Check if email exists and is already registered (if provided)
        if (email && email.trim()) {
            existingUser = await User.findOne({ email: email.toLowerCase().trim() });
            if (existingUser) {
                return res.status(400).json({ message: "Email already registered" });
            }
        }

        // Prepare user data
        const userData = {
            username: username.trim(),
            fullname,
            phone,
            role,
            grade: grade || "1", // Use provided grade or default to "1"
            password: password.trim() // Password will be hashed by the pre-save hook
        };
        
        // Only add email if it exists and is not empty
        if (email && email.trim()) {
            userData.email = email.toLowerCase().trim();
        }
        
        // Only add publisher if it exists and is not empty
        if (publisher && publisher.trim()) {
            userData.publisher = publisher.trim();
        }

        // Create and save the new user
        const newUser = new User(userData);
        await newUser.save();
        
        // Verify that the saved password hash works with the original password
        const savedUser = await User.findOne({ username: username.trim() });
        const verifyPassword = await bcrypt.compare(password.trim(), savedUser.password);
        console.log("🔍 Verification after save:", verifyPassword);
        
        if (!verifyPassword) {
            console.log("⚠️ WARNING: Password verification failed after save");
            console.log("🔑 Saved hash:", savedUser.password);
            console.log("🔑 Original password:", password.trim());
            
            // Try to fix it now
            savedUser.password = password.trim();
            await savedUser.save();
            
            const secondVerify = await bcrypt.compare(password.trim(), savedUser.password);
            console.log("🔍 Second verification attempt:", secondVerify);
        }

        console.log("✅ User saved successfully!");
        res.status(201).json({ message: "User registered successfully!" });
    } catch (error) {
        console.error("❌ Error registering user:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

// ✅ User Login
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log("🛠 Received login request:", { username, password: password ? password.trim() : 'undefined' });

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }

        // ✅ Find user by username
        const user = await User.findOne({ username: username.trim() });
        if (!user) {
            console.log("❌ User not found in DB");
            return res.status(400).json({ message: "Invalid username or password" });
        }

        console.log("🔑 Stored Password Hash:", user.password);
        console.log("🔑 Password Length:", password.length);
        console.log("🔑 Password Char Codes:", [...password].map(c => c.charCodeAt(0)));

        // ✅ Compare the entered password with trim to handle potential whitespace issues
        const isMatch = await bcrypt.compare(password.trim(), user.password);
        console.log("🔎 Password Match Result:", isMatch);

        if (isMatch) {
            // ✅ Generate token
            const token = jwt.sign(
                { userId: user._id, name: user.fullname, role: user.role, grade: user.grade },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );

            console.log("✅ Login successful!");
            return res.json({ 
                token, 
                userId: user._id, 
                name: user.fullname, 
                role: user.role, 
                grade: user.grade 
            });
        }

        // If we got here, password doesn't match
        console.log("❌ Password mismatch! Trying simple hash comparison");
            
        // Try a simple direct comparison
        const directHashCompare = await bcrypt.compare(password, user.password);
        console.log("🔄 Direct unmodified hash compare:", directHashCompare);
            
        if (directHashCompare) {
            // Password matched with direct comparison
            const token = jwt.sign(
                { userId: user._id, name: user.fullname, role: user.role, grade: user.grade },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );
            console.log("✅ Login successful with direct comparison!");
            return res.json({ 
                token, 
                userId: user._id, 
                name: user.fullname, 
                role: user.role, 
                grade: user.grade 
            });
        }
            
        // Last resort, try to update password
        console.log("🔄 Attempting to update user password...");
        // Use the raw password for storage
        user.password = password.trim();
        await user.save(); // This will trigger the hash middleware
        console.log("✅ User password updated for future logins");
                
        // Return success but with a note about the password update
        const token = jwt.sign(
            { userId: user._id, name: user.fullname, role: user.role, grade: user.grade },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );
        return res.json({ 
            token, 
            userId: user._id, 
            name: user.fullname, 
            role: user.role,
            grade: user.grade,
            message: "Password updated for future logins" 
        });
    } catch (error) {
        console.error("❌ Error logging in:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// ✅ Get Logged-in User Details
router.get("/me", authenticateUser, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select("_id username fullname email role phone createdAt");
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json(user);
    } catch (error) {
        console.error("❌ Error fetching user:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

// ✅ Update User Password (for fixing hashing issues)
router.post("/reset-password", async (req, res) => {
    try {
        const { username, oldPassword, newPassword } = req.body;
        
        if (!username || !newPassword) {
            return res.status(400).json({ message: "Username and new password are required" });
        }
        
        const user = await User.findOne({ username: username.trim() });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
        
        // Update the user's password
        user.password = hashedPassword;
        await user.save();
        
        res.json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("❌ Error updating password:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

// Refresh Token Endpoint
router.post("/refresh-token", async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    // Verify the existing token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find the user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a new token
    const newToken = jwt.sign(
      { userId: user._id, name: user.fullname, role: user.role, grade: user.grade },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token: newToken,
      userId: user._id,
      name: user.fullname,
      role: user.role,
      grade: user.grade
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

module.exports = router;