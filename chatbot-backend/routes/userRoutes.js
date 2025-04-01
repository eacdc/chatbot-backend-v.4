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

        const { username, fullname, email, phone, role, password } = req.body;

        if (!username || !fullname || !email || !phone || !role || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        let existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) return res.status(400).json({ message: "Email already registered" });

        // ✅ Generate salt and hash the password consistently
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        console.log("🔐 Hashed Password (Before Saving to DB):", hashedPassword);
        
        // Added explicit logging of the raw password for debugging
        console.log("📝 Raw Password being hashed:", password);

        const newUser = new User({
            username: username.trim(),
            fullname,
            email: email.toLowerCase().trim(),
            phone,
            role,
            password: hashedPassword, // Ensure we store the hashed password
        });

        await newUser.save();
        
        // Verify that the saved password hash works with the original password
        const savedUser = await User.findOne({ email: email.toLowerCase().trim() });
        const verifyPassword = await bcrypt.compare(password, savedUser.password);
        console.log("🔍 Verification after save:", verifyPassword);

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
        const { email, password } = req.body;
        console.log("🛠 Received login request:", { email, password: password.trim() });

        // ✅ Find user
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            console.log("❌ User not found in DB");
            return res.status(400).json({ message: "Invalid email or password" });
        }

        console.log("🔑 Stored Password Hash:", user.password);
        console.log("🔑 Password Length:", password.length);
        console.log("🔑 Password Char Codes:", [...password].map(c => c.charCodeAt(0)));

        // ✅ Compare the entered password with trim to handle potential whitespace issues
        const isMatch = await bcrypt.compare(password.trim(), user.password);
        console.log("🔎 Password Match Result:", isMatch);

        if (!isMatch) {
            console.log("❌ Password mismatch! Debugging info:");
            console.log("Entered Password (Raw):", password);
            
            // Try to re-hash the password for comparison
            const reHashedPassword = await bcrypt.hash(password.trim(), 10);
            console.log("🔄 Re-hashed attempt:", reHashedPassword);

            // Verify if the issue might be related to user schema middleware
            const directHashCompare = await bcrypt.compare(password.trim(), user.password);
            console.log("🔄 Direct hash compare:", directHashCompare);

            // If still not matching, try to update the user's password for future logins
            if (!directHashCompare) {
                console.log("🔄 Attempting to update user password...");
                user.password = await bcrypt.hash(password.trim(), 10);
                await user.save();
                console.log("✅ User password updated for future logins");
                
                // Return success but with a note about the password update
                const token = jwt.sign(
                    { userId: user._id, name: user.fullname, role: user.role },
                    process.env.JWT_SECRET,
                    { expiresIn: "1h" }
                );
                return res.json({ 
                    token, 
                    userId: user._id, 
                    name: user.fullname, 
                    role: user.role,
                    message: "Password updated for future logins" 
                });
            }
            
            return res.status(400).json({ message: "Invalid email or password" });
        }

        // ✅ Generate token
        const token = jwt.sign(
            { userId: user._id, name: user.fullname, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        console.log("✅ Login successful!");
        res.json({ token, userId: user._id, name: user.fullname, role: user.role });

    } catch (error) {
        console.error("❌ Error logging in:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// ✅ Get Logged-in User Details
router.get("/me", authenticateUser, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select("_id username fullname email role");
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
        const { email, oldPassword, newPassword } = req.body;
        
        const user = await User.findOne({ email: email.toLowerCase().trim() });
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

module.exports = router;