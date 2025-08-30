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

// Root route for social auth
router.get('/', (req, res) => {
  res.json({
    message: "Social Authentication API",
    availableEndpoints: {
      "GET /available-providers": "Check OAuth provider availability",
      "GET /debug-urls": "Debug environment variables and URLs",
      "GET /google": "Initiate Google OAuth",
      "GET /google/callback": "Google OAuth callback (automatic)",
      "POST /test-google-login": "Test Google login (simulated)",
      "POST /link-google": "Link Google account to existing user",
      "POST /unlink-google": "Unlink Google account",
      "GET /linked-accounts": "Get user's linked accounts",
      "GET /test-auth": "Test authentication page"
    },
    status: "active"
  });
});

// Helper function to check if OAuth strategy is available
const isStrategyAvailable = (strategyName) => {
  return !!(passport._strategies && passport._strategies[strategyName]);
};

// Google OAuth routes
router.get('/google', (req, res, next) => {
  if (!isStrategyAvailable('google')) {
    return res.status(503).json({ 
      message: "Google OAuth is not configured. Please contact administrator." 
    });
  }
  
  // Debug: Log environment variables
  console.log('🔧 Environment variables check:');
  console.log('- FRONTEND_URL:', process.env.FRONTEND_URL || 'Not set (using localhost:3000)');
  console.log('- BACKEND_URL:', process.env.BACKEND_URL || 'Not set (using localhost:5000)');
  
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', (req, res, next) => {
  if (!isStrategyAvailable('google')) {
    return res.status(503).json({ 
      success: false,
      message: "Google OAuth is not configured. Please contact administrator." 
    });
  }
  passport.authenticate('google', { session: false, failureRedirect: '/login' })(req, res, next);
}, async (req, res) => {
    try {
        console.log('🔐 Google OAuth callback received:', req.user);
        
        if (!req.user) {
            console.log('❌ No user found in callback');
            return res.status(401).json({
                success: false,
                message: "Google authentication failed"
            });
        }

        console.log('🔑 Generating JWT token...');
        console.log('🔑 JWT_SECRET available:', !!process.env.JWT_SECRET);

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

        console.log('✅ JWT token generated successfully');
        console.log('🔗 Token length:', token.length);

        // Return JSON response with user details and token
        res.status(200).json({
            success: true,
            message: "Google authentication successful",
            token: token,
            user: {
                _id: req.user._id,
                username: req.user.username,
                fullname: req.user.fullname,
                email: req.user.email,
                phone: req.user.phone,
                role: req.user.role,
                grade: req.user.grade,
                publisher: req.user.publisher,
                authProvider: req.user.authProvider,
                isEmailVerified: req.user.isEmailVerified,
                googleId: req.user.googleId,
                facebookId: req.user.facebookId,
                createdAt: req.user.createdAt,
                updatedAt: req.user.updatedAt
            },
            authInfo: {
                provider: 'google',
                tokenExpiresIn: '7d',
                tokenType: 'Bearer'
            }
        });

    } catch (error) {
        console.error('❌ Google OAuth callback error:', error);
        res.status(500).json({
            success: false,
            message: "Server error during Google authentication",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Facebook OAuth routes
router.get('/facebook', (req, res, next) => {
  if (!isStrategyAvailable('facebook')) {
    return res.status(503).json({ 
      message: "Facebook OAuth is not configured. Please contact administrator." 
    });
  }
  passport.authenticate('facebook', { scope: ['email', 'public_profile'] })(req, res, next);
});

router.get('/facebook/callback', (req, res, next) => {
  if (!isStrategyAvailable('facebook')) {
    return res.status(503).json({ 
      success: false,
      message: "Facebook OAuth is not configured. Please contact administrator." 
    });
  }
  passport.authenticate('facebook', { session: false, failureRedirect: '/login' })(req, res, next);
}, async (req, res) => {
    try {
        console.log('🔐 Facebook OAuth callback received:', req.user);
        
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Facebook authentication failed"
            });
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

        // Return JSON response with user details and token
        res.status(200).json({
            success: true,
            message: "Facebook authentication successful",
            token: token,
            user: {
                _id: req.user._id,
                username: req.user.username,
                fullname: req.user.fullname,
                email: req.user.email,
                phone: req.user.phone,
                role: req.user.role,
                grade: req.user.grade,
                publisher: req.user.publisher,
                authProvider: req.user.authProvider,
                isEmailVerified: req.user.isEmailVerified,
                googleId: req.user.googleId,
                facebookId: req.user.facebookId,
                createdAt: req.user.createdAt,
                updatedAt: req.user.updatedAt
            },
            authInfo: {
                provider: 'facebook',
                tokenExpiresIn: '7d',
                tokenType: 'Bearer'
            }
        });

    } catch (error) {
        console.error('❌ Facebook OAuth callback error:', error);
        res.status(500).json({
            success: false,
            message: "Server error during Facebook authentication",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

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

// Get available OAuth providers
router.get('/available-providers', (req, res) => {
    const availableProviders = {
        google: isStrategyAvailable('google'),
        facebook: isStrategyAvailable('facebook')
    };
    
    res.json({
        availableProviders,
        message: "OAuth provider availability status"
    });
});

// Debug route to check environment variables and URLs
router.get('/debug-urls', (req, res) => {
    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    if (frontendUrl.endsWith('/')) {
        frontendUrl = frontendUrl.slice(0, -1);
    }
    
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    
    const debugInfo = {
        environment: process.env.NODE_ENV || 'development',
        urls: {
            frontend: frontendUrl,
            backend: backendUrl,
            authCallback: `${frontendUrl}/auth-callback`,
            googleCallback: `${backendUrl}/api/social-auth/google/callback`
        },
        oauth: {
            googleConfigured: isStrategyAvailable('google'),
            facebookConfigured: isStrategyAvailable('facebook')
        }
    };
    
    res.json(debugInfo);
});

// Serve test authentication page
router.get('/test-auth', (req, res) => {
    res.sendFile('public/test-auth.html', { root: process.cwd() });
});

// Test endpoint for Postman - simulates Google OAuth login with exact response format
router.post('/test-google-login', async (req, res) => {
    try {
        const { email, fullname, googleId } = req.body;
        
        if (!email || !fullname || !googleId) {
            return res.status(400).json({ 
                success: false,
                message: "Email, fullname, and googleId are required for testing" 
            });
        }

        console.log('🧪 Test Google login with:', { email, fullname, googleId });

        // Check if user exists with this Google ID
        let user = await User.findOne({ googleId });
        
        if (!user) {
            // Check if user exists with this email
            user = await User.findOne({ email: email.toLowerCase().trim() });
            
            if (user) {
                // Link Google account to existing user
                user.googleId = googleId;
                user.authProvider = 'google';
                user.isEmailVerified = true;
                await user.save();
                console.log('✅ Linked Google account to existing user');
            } else {
                // Create new user
                const username = email.split('@')[0] + '_' + Date.now();
                user = new User({
                    username,
                    fullname,
                    email: email.toLowerCase().trim(),
                    googleId,
                    authProvider: 'google',
                    isEmailVerified: true,
                    role: 'student',
                    grade: '1',
                    phone: '1234567890'
                });
                await user.save();
                console.log('✅ Created new user with Google account');
            }
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id, 
                name: user.fullname, 
                role: user.role, 
                grade: user.grade,
                authProvider: user.authProvider
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        console.log('✅ JWT token generated for test user');

        // Return exact same format as the real OAuth callback
        res.status(200).json({
            success: true,
            message: "Google authentication successful",
            token: token,
            user: {
                _id: user._id,
                username: user.username,
                fullname: user.fullname,
                email: user.email,
                phone: user.phone,
                role: user.role,
                grade: user.grade,
                authProvider: user.authProvider,
                isEmailVerified: user.isEmailVerified,
                googleId: user.googleId,
                createdAt: user.createdAt
            },
            authInfo: {
                provider: 'google',
                tokenExpiresIn: '7d',
                tokenType: 'Bearer'
            }
        });

    } catch (error) {
        console.error('❌ Test Google login error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message || "Server error" 
        });
    }
});

module.exports = router;