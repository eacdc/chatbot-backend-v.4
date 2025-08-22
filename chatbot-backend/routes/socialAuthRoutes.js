const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authenticateUser = require("../middleware/authMiddleware");
require("dotenv").config();

const router = express.Router();

// Debug middleware for social auth routes
router.use((req, res, next) => {
  console.log('🔐 Social auth route accessed:', req.method, req.path);
  next();
});

// Google OAuth routes
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

router.get('/google/callback', 
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    async (req, res) => {
        try {
            console.log('🔐 Google OAuth callback received:', req.user);
            
            if (!req.user) {
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed`);
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: req.user._id, 
                    name: req.user.fullname, 
                    role: req.user.role, 
                    grade: req.user.grade,
                    authProvider: req.user.authProvider
                },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            // Redirect to frontend with token
            const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth-callback?token=${token}&provider=google`;
            res.redirect(redirectUrl);

        } catch (error) {
            console.error('❌ Google OAuth callback error:', error);
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed`);
        }
    }
);

// Facebook OAuth routes
router.get('/facebook', passport.authenticate('facebook', {
    scope: ['email', 'public_profile']
}));

router.get('/facebook/callback', 
    passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
    async (req, res) => {
        try {
            console.log('🔐 Facebook OAuth callback received:', req.user);
            
            if (!req.user) {
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=facebook_auth_failed`);
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: req.user._id, 
                    name: req.user.fullname, 
                    role: req.user.role, 
                    grade: req.user.grade,
                    authProvider: req.user.authProvider
                },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            // Redirect to frontend with token
            const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth-callback?token=${token}&provider=facebook`;
            res.redirect(redirectUrl);

        } catch (error) {
            console.error('❌ Facebook OAuth callback error:', error);
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=facebook_auth_failed`);
        }
    }
);

// Link social account to existing user (requires authentication)
router.post('/link-google', authenticateUser, async (req, res) => {
    try {
        const { googleId, email, fullname } = req.body;
        
        if (!googleId || !email) {
            return res.status(400).json({ message: "Google ID and email are required" });
        }

        // Check if Google account is already linked to another user
        const existingGoogleUser = await User.findOne({ googleId });
        if (existingGoogleUser) {
            return res.status(409).json({ message: "This Google account is already linked to another user" });
        }

        // Update current user with Google info
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            {
                googleId,
                email: email.toLowerCase().trim(),
                fullname: fullname || req.user.name,
                isEmailVerified: true,
                authProvider: 'google'
            },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ 
            message: "Google account linked successfully",
            user: {
                _id: user._id,
                username: user.username,
                fullname: user.fullname,
                email: user.email,
                authProvider: user.authProvider
            }
        });

    } catch (error) {
        console.error('❌ Link Google account error:', error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

router.post('/link-facebook', authenticateUser, async (req, res) => {
    try {
        const { facebookId, email, fullname } = req.body;
        
        if (!facebookId || !email) {
            return res.status(400).json({ message: "Facebook ID and email are required" });
        }

        // Check if Facebook account is already linked to another user
        const existingFacebookUser = await User.findOne({ facebookId });
        if (existingFacebookUser) {
            return res.status(409).json({ message: "This Facebook account is already linked to another user" });
        }

        // Update current user with Facebook info
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            {
                facebookId,
                email: email.toLowerCase().trim(),
                fullname: fullname || req.user.name,
                isEmailVerified: true,
                authProvider: 'facebook'
            },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ 
            message: "Facebook account linked successfully",
            user: {
                _id: user._id,
                username: user.username,
                fullname: user.fullname,
                email: user.email,
                authProvider: user.authProvider
            }
        });

    } catch (error) {
        console.error('❌ Link Facebook account error:', error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

// Unlink social account
router.post('/unlink-google', authenticateUser, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            {
                $unset: { googleId: "" },
                authProvider: 'email'
            },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "Google account unlinked successfully" });

    } catch (error) {
        console.error('❌ Unlink Google account error:', error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

router.post('/unlink-facebook', authenticateUser, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            {
                $unset: { facebookId: "" },
                authProvider: 'email'
            },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "Facebook account unlinked successfully" });

    } catch (error) {
        console.error('❌ Unlink Facebook account error:', error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

// Get user's linked social accounts
router.get('/linked-accounts', authenticateUser, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('googleId facebookId authProvider');
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            googleLinked: !!user.googleId,
            facebookLinked: !!user.facebookId,
            authProvider: user.authProvider
        });

    } catch (error) {
        console.error('❌ Get linked accounts error:', error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});

module.exports = router;
