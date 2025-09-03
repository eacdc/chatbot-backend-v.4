const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const User = require("../models/User");
const OTP = require("../models/OTP");
const PasswordResetOTP = require("../models/PasswordResetOTP");
const { sendOTPEmail, sendPasswordResetOTPEmail } = require("../services/emailService");
const authenticateUser = require("../middleware/authMiddleware");
require("dotenv").config();

const router = express.Router();

// Validate Cloudinary configuration
const isCloudinaryConfigured = () => {
  return process.env.CLOUDINARY_CLOUD_NAME && 
         process.env.CLOUDINARY_API_KEY && 
         process.env.CLOUDINARY_API_SECRET;
};

// Configure Cloudinary if credentials are available
if (isCloudinaryConfigured()) {
  cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET 
  });
  console.log('Cloudinary configured successfully for user uploads');
} else {
  console.warn('Cloudinary credentials missing. Profile picture uploads will fail!');
}

// Configure multer storage for profile picture uploads
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    // Accept image files only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  }
});

// ✅ Check Username Availability (Real-time validation)
router.post("/check-username", async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username || !username.trim()) {
            return res.status(400).json({ message: "Username is required" });
        }

        // Check if username already exists
        const existingUser = await User.findOne({ username: username.trim() });
        
        if (existingUser) {
            return res.status(409).json({ 
                available: false,
                message: "Username already taken" 
            });
        } else {
            return res.status(200).json({ 
                available: true,
                message: "Username is available" 
            });
        }
    } catch (error) {
        console.error("❌ Error checking username:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// ✅ Generate and Send OTP for Registration
router.post("/send-otp", async (req, res) => {
    try {
        console.log("📩 Received OTP request:", req.body);
        
        const { username, fullname, email, phone, role, grade, publisher, password, authMethod } = req.body;

        // Check required fields based on authentication method
        if (authMethod === 'social') {
            // For social auth, we don't need password
            if (!username || !fullname || !email || !phone || !role) {
                return res.status(400).json({ 
                    message: "Username, full name, email, phone, and role are required for social authentication" 
                });
            }
        } else {
            // For email OTP, password is required
        if (!username || !fullname || !email || !phone || !role || !password) {
            return res.status(400).json({ 
                message: "Username, full name, email, phone, role, and password are required" 
            });
            }
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

        // Generate real OTP for email verification
        const otp = crypto.randomInt(100000, 999999).toString();
        
        console.log(`🔧 OTP Mode: REAL - OTP: ${otp}`);
        
        // Prepare user data to store temporarily
        const userData = {
            username: username.trim(),
            fullname: fullname.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            role: role.trim(),
            grade: grade || "1",
            publisher: publisher ? publisher.trim() : undefined,
            password: authMethod === 'social' ? undefined : password.trim(),
            authProvider: authMethod === 'social' ? 'email' : 'email',
            isEmailVerified: authMethod === 'social' ? true : false
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
                email: email.toLowerCase().trim(),
                developmentMode: false
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

        // Generate new real OTP for resend
        const newOTP = crypto.randomInt(100000, 999999).toString();
        
        console.log(`🔧 Resend OTP Mode: REAL - OTP: ${newOTP}`);
        
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
                email: email.toLowerCase().trim(),
                developmentMode: false
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

// ✅ Social Authentication Registration
router.post("/register-social", async (req, res) => {
    try {
        console.log("🔐 Received social registration request:", req.body);
        
        const { username, fullname, email, phone, role, grade, publisher, authProvider, socialId } = req.body;

        // Check required fields
        if (!username || !fullname || !email || !phone || !role || !authProvider || !socialId) {
            return res.status(400).json({ 
                message: "Username, full name, email, phone, role, auth provider, and social ID are required" 
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

        // Check if social ID is already linked to another account
        if (authProvider === 'google') {
            existingUser = await User.findOne({ googleId: socialId });
        } else if (authProvider === 'facebook') {
            existingUser = await User.findOne({ facebookId: socialId });
        }
        
        if (existingUser) {
            return res.status(400).json({ message: "This social account is already linked to another user" });
        }

        // Create new user
        const userData = {
            username: username.trim(),
            fullname: fullname.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            role: role.trim(),
            grade: grade || "1",
            publisher: publisher ? publisher.trim() : undefined,
            authProvider: authProvider,
            isEmailVerified: true
        };

        // Add social ID based on provider
        if (authProvider === 'google') {
            userData.googleId = socialId;
        } else if (authProvider === 'facebook') {
            userData.facebookId = socialId;
        }

        const newUser = new User(userData);
        await newUser.save();
        
        console.log("✅ Social user registered successfully!");
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: newUser._id, 
                name: newUser.fullname, 
                role: newUser.role, 
                grade: newUser.grade,
                authProvider: newUser.authProvider
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({ 
            message: "Registration completed successfully!",
            token,
            userId: newUser._id,
            name: newUser.fullname,
            role: newUser.role,
            grade: newUser.grade,
            authProvider: newUser.authProvider
        });

    } catch (error) {
        console.error("❌ Error in social registration:", error);
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

        // Allow JD publisher users to login from any URL
        if (user.publisher === 'JD') {
            console.log("🌐 JD publisher detected - allowing login from any URL");
            console.log("✅ JD publisher verified, continuing with login");
        }
        // Check if request is from JD frontend and if user's publisher is JD
        else if (hostname === 'chatbot-frontend-v-4-jd-1.onrender.com' || 
            hostname === 'testyourlearning.com' || 
            requestOrigin.includes('chatbot-frontend-v-4-jd-1.onrender.com') ||
            requestOrigin.includes('testyourlearning.com')) {
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
        else if (hostname === 'chatbot-backend-v-4.onrender.com' || requestOrigin.includes('chatbot-backend-v-4.onrender.com')) {
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
                { expiresIn: "7d" }
            );

            console.log("✅ Login successful!");
            console.log("✅ Generated token length:", token.length);
            console.log("✅ Token first 20 chars:", token.substring(0, 20) + "...");
            console.log("✅ Token last 20 chars:", "..." + token.substring(token.length - 20));
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
                { expiresIn: "7d" }
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
            { expiresIn: "7d" }
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
        const user = await User.findById(req.user.userId).select("_id username fullname email role phone grade publisher profilePicture createdAt");
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json(user);
    } catch (error) {
        console.error("❌ Error fetching user:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

// ✅ Update User Profile
router.put("/profile", authenticateUser, async (req, res) => {
    try {
        const { fullname, email, phone, grade, publisher } = req.body;
        console.log("📝 Profile update request:", { fullname, email, phone, grade, publisher });

        // Find the user
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Prepare update object with only allowed fields
        const updateData = {};
        
        // Validate and update fullname
        if (fullname !== undefined) {
            if (!fullname || fullname.trim().length < 2) {
                return res.status(400).json({ message: "Full name must be at least 2 characters long" });
            }
            updateData.fullname = fullname.trim();
        }

        // Validate and update email
        if (email !== undefined) {
            if (email && email.trim()) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email.trim())) {
                    return res.status(400).json({ message: "Please provide a valid email address" });
                }
                
                // Check if email is already taken by another user
                const existingUser = await User.findOne({ 
                    email: email.toLowerCase().trim(),
                    _id: { $ne: req.user.userId } 
                });
                if (existingUser) {
                    return res.status(409).json({ message: "Email already registered by another user" });
                }
                
                updateData.email = email.toLowerCase().trim();
            } else {
                // Allow clearing email (set to undefined)
                updateData.email = undefined;
            }
        }

        // Validate and update phone
        if (phone !== undefined) {
            if (!phone || phone.trim().length < 10) {
                return res.status(400).json({ message: "Phone number must be at least 10 characters long" });
            }
            updateData.phone = phone.trim();
        }

        // Validate and update grade
        if (grade !== undefined) {
            if (!grade || grade.trim().length === 0) {
                return res.status(400).json({ message: "Grade is required" });
            }
            updateData.grade = grade.trim();
        }

        // Validate and update publisher
        if (publisher !== undefined) {
            // Publisher can be empty or a valid string
            updateData.publisher = publisher ? publisher.trim() : undefined;
        }

        // Check if there's anything to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: "No valid fields provided for update" });
        }

        console.log("📝 Update data:", updateData);

        // Update the user
        const updatedUser = await User.findByIdAndUpdate(
            req.user.userId,
            updateData,
            { new: true, runValidators: true }
        ).select("_id username fullname email role phone grade publisher profilePicture createdAt");

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        console.log("✅ Profile updated successfully");
        res.json({
            message: "Profile updated successfully",
            user: updatedUser
        });

    } catch (error) {
        console.error("❌ Error updating profile:", error);
        
        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ message: errors.join(', ') });
        }
        
        // Handle duplicate key errors
        if (error.code === 11000) {
            if (error.keyPattern && error.keyPattern.email) {
                return res.status(409).json({ message: "Email already registered" });
            }
        }
        
        res.status(500).json({ message: error.message || "Server error" });
    }
});

// ✅ Change Password (authenticated users only)
router.post("/change-password", authenticateUser, async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        
        // Validate input
        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ message: "Old password, new password, and confirmation password are required" });
        }
        
        // Check if new passwords match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: "New passwords do not match" });
        }
        
        // Validate password strength
        if (newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }
        
        // Find the user
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Verify old password
        const isMatch = await bcrypt.compare(oldPassword.trim(), user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }
        
        // Update the user's password
        user.password = newPassword.trim(); // The pre-save hook will hash the password
        await user.save();
        
        console.log("✅ Password changed successfully for user:", user.username);
        res.json({ message: "Password changed successfully" });
    } catch (error) {
        console.error("❌ Error changing password:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

// ✅ Update User Password (for fixing hashing issues) - DEPRECATED: Use /change-password instead
router.post("/update-password", async (req, res) => {
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
      { expiresIn: "7d" }
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

// ✅ Check Username Availability (Real-time validation)
router.post("/check-username", async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username || !username.trim()) {
            return res.status(400).json({ message: "Username is required" });
        }

        // Check if username already exists
        const existingUser = await User.findOne({ username: username.trim() });
        
        if (existingUser) {
            return res.status(409).json({ 
                available: false,
                message: "Username already taken" 
            });
        } else {
            return res.status(200).json({ 
                available: true,
                message: "Username is available" 
            });
        }
    } catch (error) {
        console.error("❌ Error checking username:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// ✅ Upload Profile Picture
router.post("/upload-profile-picture", authenticateUser, upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file provided" });
        }

        console.log('Profile Picture Upload - File Details:', {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            userId: req.user.userId
        });

        if (!isCloudinaryConfigured()) {
            return res.status(500).json({ 
                error: 'Image upload service unavailable', 
                details: 'Cloudinary configuration is missing' 
            });
        }

        // Create a buffer from the file
        const buffer = req.file.buffer;
        const tempFilePath = path.join(__dirname, `../temp-profile-${req.user.userId}-${Date.now()}.jpg`);
        
        try {
            // Write buffer to temporary file
            fs.writeFileSync(tempFilePath, buffer);
            console.log('Profile Picture Upload - Temporary file created:', tempFilePath);
            
            // Upload to Cloudinary
            console.log('Profile Picture Upload - Starting Cloudinary upload...');
            const result = await cloudinary.uploader.upload(tempFilePath, {
                folder: "profile-pictures",
                resource_type: "image",
                public_id: `profile_${req.user.userId}`, // Use user ID as public_id for easy overwriting
                overwrite: true, // Allow overwriting existing profile pictures
                transformation: [
                    { width: 300, height: 300, crop: "fill", quality: "auto" }
                ],
                timeout: 60000 // 60 second timeout
            });
            
            // Delete the temporary file
            fs.unlinkSync(tempFilePath);
            console.log('Profile Picture Upload - Temporary file deleted');
            
            if (!result || !result.secure_url) {
                throw new Error('Cloudinary upload failed to return a valid URL');
            }
            
            console.log('Profile Picture Upload - Cloudinary upload successful:', {
                url: result.secure_url,
                public_id: result.public_id
            });
            
            // Update user's profile picture URL in database
            const updatedUser = await User.findByIdAndUpdate(
                req.user.userId,
                { profilePicture: result.secure_url },
                { new: true, runValidators: true }
            ).select("_id username fullname email role phone grade publisher profilePicture createdAt");
            
            if (!updatedUser) {
                return res.status(404).json({ error: "User not found" });
            }
            
            console.log('Profile Picture Upload - Database updated successfully');
            
            res.status(200).json({ 
                message: "Profile picture uploaded successfully", 
                profilePicture: result.secure_url,
                user: updatedUser
            });
            
        } catch (uploadError) {
            // Clean up temp file if it exists
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
            console.error('Profile Picture Upload - Error:', uploadError);
            throw uploadError;
        }
    } catch (error) {
        console.error("Profile Picture Upload - Error:", error);
        res.status(500).json({ 
            error: "Failed to upload profile picture", 
            details: error.message 
        });
    }
});

// ✅ Delete Profile Picture
router.delete("/delete-profile-picture", authenticateUser, async (req, res) => {
    try {
        // Find the user
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // If user has a profile picture, try to delete it from Cloudinary
        if (user.profilePicture && isCloudinaryConfigured()) {
            try {
                const publicId = `profile-pictures/profile_${req.user.userId}`;
                await cloudinary.uploader.destroy(publicId);
                console.log('Profile Picture Delete - Cloudinary image deleted:', publicId);
            } catch (cloudinaryError) {
                console.error('Profile Picture Delete - Cloudinary error:', cloudinaryError);
                // Continue even if Cloudinary deletion fails
            }
        }

        // Remove profile picture URL from database
        const updatedUser = await User.findByIdAndUpdate(
            req.user.userId,
            { $unset: { profilePicture: "" } },
            { new: true, runValidators: true }
        ).select("_id username fullname email role phone grade publisher profilePicture createdAt");

        console.log('Profile Picture Delete - Database updated successfully');
        
        res.status(200).json({ 
            message: "Profile picture deleted successfully",
            user: updatedUser
        });
        
    } catch (error) {
        console.error("Profile Picture Delete - Error:", error);
        res.status(500).json({ 
            error: "Failed to delete profile picture", 
            details: error.message 
        });
    }
});

// ✅ Send Password Reset OTP
router.post("/forgot-password", async (req, res) => {
    try {
        console.log("🔐 Received password reset request:", req.body);
        
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({ message: "Please provide a valid email address" });
        }

        // Check if user exists with this email
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(404).json({ 
                message: "No account found with this email address. Please check your email or register a new account." 
            });
        }

        // Generate OTP for password reset
        const otp = crypto.randomInt(100000, 999999).toString();
        
        console.log(`🔧 Password Reset OTP: ${otp}`);
        
        // Remove any existing password reset OTP for this email
        await PasswordResetOTP.deleteMany({ email: email.toLowerCase().trim() });

        // Store password reset OTP
        const newPasswordResetOTP = new PasswordResetOTP({
            email: email.toLowerCase().trim(),
            otp: otp
        });
        
        await newPasswordResetOTP.save();
        console.log("✅ Password reset OTP saved to database");

        // Send password reset OTP email
        const emailResult = await sendPasswordResetOTPEmail(
            email.toLowerCase().trim(), 
            otp, 
            user.fullname
        );
        
        if (emailResult.success) {
            console.log("✅ Password reset OTP email sent successfully");
            res.status(200).json({ 
                message: "Password reset OTP sent to your email address. Please check your inbox and enter the code to reset your password.",
                email: email.toLowerCase().trim()
            });
        } else {
            console.error("❌ Failed to send password reset OTP email:", emailResult.error);
            // Delete the OTP record if email failed
            await PasswordResetOTP.deleteOne({ email: email.toLowerCase().trim() });
            res.status(500).json({ 
                message: "Failed to send password reset OTP email. Please check your email address and try again." 
            });
        }

    } catch (error) {
        console.error("❌ Error in forgot-password:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

// ✅ Verify Password Reset OTP and Reset Password
router.post("/reset-password", async (req, res) => {
    try {
        console.log("🔍 Received password reset verification request:", req.body);
        
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: "Email, OTP, and new password are required" });
        }

        // Validate password strength
        if (newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }

        // Find password reset OTP record
        const otpRecord = await PasswordResetOTP.findOne({ 
            email: email.toLowerCase().trim(),
            otp: otp.trim()
        });

        if (!otpRecord) {
            return res.status(400).json({ 
                message: "Invalid or expired OTP. Please request a new password reset OTP." 
            });
        }

        // Check if OTP is expired (additional check, though MongoDB TTL should handle this)
        const now = new Date();
        const otpAge = (now - otpRecord.createdAt) / 1000 / 60; // age in minutes
        if (otpAge > 10) {
            await PasswordResetOTP.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({ 
                message: "OTP has expired. Please request a new password reset OTP." 
            });
        }

        // Find user and update password
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            await PasswordResetOTP.deleteOne({ _id: otpRecord._id });
            return res.status(404).json({ message: "User not found" });
        }

        // Hash the new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword.trim(), saltRounds);

        // Update user's password
        user.password = hashedPassword;
        await user.save();
        
        // Clean up OTP record
        await PasswordResetOTP.deleteOne({ _id: otpRecord._id });
        
        console.log("✅ Password reset successfully!");
        res.status(200).json({ 
            message: "Password reset successfully! You can now login with your new password." 
        });

    } catch (error) {
        console.error("❌ Error in reset-password:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

// ✅ Resend Password Reset OTP
router.post("/resend-password-reset-otp", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Check if user exists
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(404).json({ 
                message: "No account found with this email address." 
            });
        }

        // Find existing password reset OTP record
        const otpRecord = await PasswordResetOTP.findOne({ email: email.toLowerCase().trim() });
        if (!otpRecord) {
            return res.status(400).json({ 
                message: "No pending password reset found for this email. Please request a new password reset." 
            });
        }

        // Generate new OTP for resend
        const newOTP = crypto.randomInt(100000, 999999).toString();
        
        console.log(`🔧 Resend Password Reset OTP: ${newOTP}`);
        
        // Update OTP record
        otpRecord.otp = newOTP;
        otpRecord.createdAt = new Date(); // Reset expiration timer
        await otpRecord.save();

        // Send new password reset OTP email
        const emailResult = await sendPasswordResetOTPEmail(
            email.toLowerCase().trim(), 
            newOTP, 
            user.fullname
        );
        
        if (emailResult.success) {
            console.log("✅ Password reset OTP resent successfully");
            res.status(200).json({ 
                message: "New password reset OTP sent to your email address.",
                email: email.toLowerCase().trim()
            });
        } else {
            console.error("❌ Failed to resend password reset OTP email:", emailResult.error);
            res.status(500).json({ 
                message: "Failed to send password reset OTP email. Please try again." 
            });
        }

    } catch (error) {
        console.error("❌ Error in resend-password-reset-otp:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

module.exports = router;