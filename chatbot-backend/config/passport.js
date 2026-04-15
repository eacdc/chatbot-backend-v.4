const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');
require('dotenv').config();

// Google OAuth Strategy - Only initialize if credentials are available
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/social-auth/google/callback`
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            console.log('🔐 Google profile verified:', {
                id: profile.id,
                displayName: profile.displayName,
                email
            });

            if (!email) {
                return done(new Error('Google account has no email address'), null);
            }

            // Only verify the Google identity and return the email.
            // User lookup and login happen in the route callback so that
            // the user can select a username and authenticate with a password.
            return done(null, {
                email: email.toLowerCase().trim(),
                googleId: profile.id,
                fullname: profile.displayName,
                profilePicture: profile.photos?.[0]?.value
            });

        } catch (error) {
            console.error('❌ Google OAuth error:', error);
            return done(error, null);
        }
    }));
    console.log('✅ Google OAuth strategy initialized');
} else {
    console.log('⚠️ Google OAuth credentials not found - Google login disabled');
}

// Facebook OAuth Strategy - Only initialize if credentials are available
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/social-auth/facebook/callback`,
        profileFields: ['id', 'displayName', 'emails', 'photos']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            console.log('🔐 Facebook profile received:', {
                id: profile.id,
                displayName: profile.displayName,
                email: profile.emails?.[0]?.value
            });

            // Check if user already exists with this Facebook ID
            let user = await User.findOne({ facebookId: profile.id });
            
            if (user) {
                console.log('✅ Existing Facebook user found:', user.username);
                return done(null, user);
            }

            // Check if user exists with the same email
            if (profile.emails && profile.emails[0]) {
                user = await User.findOne({ email: profile.emails[0].value.toLowerCase() });
                
                if (user) {
                    // Link existing user with Facebook account
                    user.facebookId = profile.id;
                    user.authProvider = 'facebook';
                    user.isEmailVerified = true;
                    await user.save();
                    console.log('✅ Existing user linked with Facebook:', user.username);
                    return done(null, user);
                }
            }

            // Create new user with Facebook data
            const email = profile.emails?.[0]?.value;
            if (!email) {
                return done(new Error('Email is required for registration'), null);
            }

            // Generate unique username
            let username = profile.displayName.replace(/\s+/g, '').toLowerCase();
            let counter = 1;
            let finalUsername = username;
            
            while (await User.findOne({ username: finalUsername })) {
                finalUsername = `${username}${counter}`;
                counter++;
            }

            const newUser = new User({
                username: finalUsername,
                fullname: profile.displayName,
                email: email.toLowerCase(),
                phone: '0000000000', // Default phone, user can update later
                role: 'student', // Default role, user can update later
                grade: '1', // Default grade, user can update later
                facebookId: profile.id,
                authProvider: 'facebook',
                isEmailVerified: true,
                profilePicture: profile.photos?.[0]?.value
            });

            await newUser.save();
            console.log('✅ New Facebook user created:', newUser.username);
            return done(null, newUser);

        } catch (error) {
            console.error('❌ Facebook OAuth error:', error);
            return done(error, null);
        }
    }));
    console.log('✅ Facebook OAuth strategy initialized');
} else {
    console.log('⚠️ Facebook OAuth credentials not found - Facebook login disabled');
}

// Serialize user for the session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;
