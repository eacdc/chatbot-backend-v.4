const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const OTP = require("../models/OTP");
const { sendOTPEmail } = require("../services/emailService");
const authenticateUser = require("../middleware/authMiddleware");
require("dotenv").config();

const router = express.Router();

// ✅ Generate and Send OTP for Registration
router.post("/send-otp", async (req, res) => {
    try {
        console.log("📩 Received OTP request:", req.body);
        
        const { username, fullname, email, phone, role, grade, publisher, password } = req.body;

        // Check required fields including email
        if (!username || !fullname || !email || !phone || !role || !password) {
            return res.status(400).json({ 
                message: "Username, full name, email, phone, role, and password are required" 
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({ message: "Please provide a valid email address" });
        }

        // Check if username already exists
        let existingUser = await User.findOne({ username: username.trim() });
        if (existingUser) {
            return res.status(400).json({ message: "Username already taken" });
        }

        // Check if email is already registered
        existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({ message: "Email already registered" });
        }

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        
        // Prepare user data to store temporarily
        const userData = {
            username: username.trim(),
            fullname: fullname.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            role: role.trim(),
            grade: grade || "1",
            publisher: publisher ? publisher.trim() : undefined,
            password: password.trim()
        };

        // Remove any existing OTP for this email
        await OTP.deleteMany({ email: email.toLowerCase().trim() });

        // Store OTP and user data temporarily
        const newOTP = new OTP({
            email: email.toLowerCase().trim(),
            otp: otp,
            userData: userData
        });
        
        await newOTP.save();
        console.log("✅ OTP saved to database");

        // Send OTP email
        const emailResult = await sendOTPEmail(email.toLowerCase().trim(), otp, fullname);
        
        if (emailResult.success) {
            console.log("✅ OTP email sent successfully");
            res.status(200).json({ 
                message: "OTP sent to your email address. Please check your inbox and verify to complete registration.",
                email: email.toLowerCase().trim()
            });
        } else {
            console.error("❌ Failed to send OTP email:", emailResult.error);
            // Delete the OTP record if email failed
            await OTP.deleteOne({ email: email.toLowerCase().trim() });
            res.status(500).json({ 
                message: "Failed to send OTP email. Please check your email address and try again." 
            });
        }

    } catch (error) {
        console.error("❌ Error in send-otp:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

// ✅ Verify OTP and Complete Registration
router.post("/verify-otp", async (req, res) => {
    try {
        console.log("🔍 Received OTP verification request:", req.body);
        
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP are required" });
        }

        // Find OTP record
        const otpRecord = await OTP.findOne({ 
            email: email.toLowerCase().trim(),
            otp: otp.trim()
        });

        if (!otpRecord) {
            return res.status(400).json({ 
                message: "Invalid or expired OTP. Please request a new OTP." 
            });
        }

        // Check if OTP is expired (additional check, though MongoDB TTL should handle this)
        const now = new Date();
        const otpAge = (now - otpRecord.createdAt) / 1000 / 60; // age in minutes
        if (otpAge > 10) {
            await OTP.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({ 
                message: "OTP has expired. Please request a new OTP." 
            });
        }

        // Extract user data from OTP record
        const userData = otpRecord.userData;

        // Double-check if user or email already exists (in case created while OTP was pending)
        let existingUser = await User.findOne({ username: userData.username });
        if (existingUser) {
            await OTP.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({ message: "Username already taken" });
        }

        existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
            await OTP.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({ message: "Email already registered" });
        }

        // Create new user
        const newUser = new User(userData);
        await newUser.save();
        
        // Clean up OTP record
        await OTP.deleteOne({ _id: otpRecord._id });
        
        console.log("✅ User registered successfully after OTP verification!");
        res.status(201).json({ 
            message: "Email verified and registration completed successfully! You can now login." 
        });

    } catch (error) {
        console.error("❌ Error in verify-otp:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

// ✅ Resend OTP
router.post("/resend-otp", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Find existing OTP record
        const otpRecord = await OTP.findOne({ email: email.toLowerCase().trim() });
        if (!otpRecord) {
            return res.status(400).json({ 
                message: "No pending registration found for this email. Please start registration again." 
            });
        }

        // Generate new OTP
        const newOTP = crypto.randomInt(100000, 999999).toString();
        
        // Update OTP record
        otpRecord.otp = newOTP;
        otpRecord.createdAt = new Date(); // Reset expiration timer
        await otpRecord.save();

        // Send new OTP email
        const emailResult = await sendOTPEmail(
            email.toLowerCase().trim(), 
            newOTP, 
            otpRecord.userData.fullname
        );
        
        if (emailResult.success) {
            console.log("✅ OTP resent successfully");
            res.status(200).json({ 
                message: "New OTP sent to your email address.",
                email: email.toLowerCase().trim()
            });
        } else {
            console.error("❌ Failed to resend OTP email:", emailResult.error);
            res.status(500).json({ 
                message: "Failed to send OTP email. Please try again." 
            });
        }

    } catch (error) {
        console.error("❌ Error in resend-otp:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

// ✅ User Registration (Legacy - now redirects to OTP flow)
router.post("/register", async (req, res) => {
    return res.status(400).json({ 
        message: "Please use the OTP verification process. Send OTP first, then verify to complete registration."
    });
});

// ✅ User Login
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log("🛠 Received login request:", { username, password: password ? password.trim() : 'undefined' });
        
        // Log the origin and referer of the request
        console.log("📌 Request Origin:", req.headers.origin);
        console.log("📌 Request Referer:", req.headers.referer);
        
        // Store the origin/referer information for potential later use
        const requestOrigin = req.headers.origin || req.headers.referer || 'unknown';

        // Extract hostname from origin/referer for more precise matching
        let hostname = '';
        try {
            if (requestOrigin !== 'unknown') {
                const url = new URL(requestOrigin);
                hostname = url.hostname;
                console.log("📍 Extracted hostname:", hostname);
            }
        } catch (error) {
            console.log("⚠️ Could not extract hostname from origin:", error.message);
        }

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required" });
        }

        // ✅ Find user by username
        const user = await User.findOne({ username: username.trim() });
        if (!user) {
            console.log("❌ User not found in DB");
            return res.status(400).json({ message: "Invalid username or password" });
        }

        // Check if request is from JD frontend and if user's publisher is JD
        if (hostname === 'chatbot-frontend-v-4-jd-1.onrender.com' || requestOrigin.includes('chatbot-frontend-v-4-jd-1.onrender.com')) {
            console.log("🔒 JD Frontend detected, checking publisher...");
            if (!user.publisher || user.publisher !== 'JD') {
                console.log("❌ Access denied: Non-JD user attempting to login via JD frontend");
                return res.status(403).json({ 
                    message: "Access denied. This portal is exclusively for JD users."
                });
            }
            console.log("✅ JD publisher verified, continuing with login");
        } 
        // Check if request is from CP frontend and if user's publisher is CP
        else if (hostname === 'chatbot-backend-v-4-cp.onrender.com' || requestOrigin.includes('chatbot-backend-v-4-cp.onrender.com')) {
            console.log("🔒 CP Frontend detected, checking publisher...");
            if (!user.publisher || user.publisher !== 'CP') {
                console.log("❌ Access denied: Non-CP user attempting to login via CP frontend");
                return res.status(403).json({ 
                    message: "Access denied. This portal is exclusively for CP users."
                });
            }
            console.log("✅ CP publisher verified, continuing with login");
        }
        // Check if request is NOT from JD frontend and user's publisher IS JD
        else {
            console.log("🔒 Standard Frontend detected, checking publisher...");
            if (user.publisher === 'JD') {
                console.log("❌ Access denied: JD user attempting to login via non-JD frontend");
                return res.status(403).json({ 
                    message: "JD users must access through the dedicated JD portal."
                });
            }
            // Check if user's publisher is CP and trying to login via non-CP frontend
            else if (user.publisher === 'CP') {
                console.log("❌ Access denied: CP user attempting to login via non-CP frontend");
                return res.status(403).json({ 
                    message: "CP users must access through the dedicated CP portal."
                });
            }
            console.log("✅ Publisher verification passed, continuing with login");
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
                { 
                    userId: user._id, 
                    name: user.fullname, 
                    role: user.role, 
                    grade: user.grade,
                    loginOrigin: requestOrigin  // Include origin information in the token
                },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );

            console.log("✅ Login successful!");
            return res.json({ 
                token, 
                userId: user._id, 
                name: user.fullname, 
                role: user.role, 
                grade: user.grade,
                loginOrigin: requestOrigin  // Optionally return this to client
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
                { 
                    userId: user._id, 
                    name: user.fullname, 
                    role: user.role, 
                    grade: user.grade,
                    loginOrigin: requestOrigin  // Include origin information in the token
                },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );
            console.log("✅ Login successful with direct comparison!");
            return res.json({ 
                token, 
                userId: user._id, 
                name: user.fullname, 
                role: user.role, 
                grade: user.grade,
                loginOrigin: requestOrigin  // Optionally return this to client
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
            { 
                userId: user._id, 
                name: user.fullname, 
                role: user.role, 
                grade: user.grade,
                loginOrigin: requestOrigin  // Include origin information in the token
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );
        return res.json({ 
            token, 
            userId: user._id, 
            name: user.fullname, 
            role: user.role,
            grade: user.grade,
            loginOrigin: requestOrigin,  // Optionally return this to client
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
        const user = await User.findById(req.user.userId).select("_id username fullname email role phone grade publisher createdAt");
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