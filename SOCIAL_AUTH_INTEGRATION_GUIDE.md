# Social Authentication Integration Guide

This guide explains how to integrate Google and Facebook OAuth authentication into your existing chatbot application alongside the current email OTP verification system.

## 🚀 What's Been Implemented

### Backend Changes
1. **Updated User Model** - Added support for social authentication fields
2. **New Social Auth Routes** - Complete OAuth flow for Google and Facebook
3. **Passport Configuration** - OAuth strategies for both providers
4. **Enhanced Registration** - Support for both email OTP and social auth
5. **Account Linking** - Ability to link/unlink social accounts

### Frontend Components
1. **SocialAuthButtons** - Reusable component for social login buttons
2. **AuthCallback** - Handles OAuth callbacks and token storage
3. **Modern UI** - Responsive design with accessibility features

## 📋 Prerequisites

Before implementing social authentication, you need to:

1. **Set up Google OAuth**:
   - Create a project in [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs

2. **Set up Facebook OAuth**:
   - Create an app in [Facebook Developers](https://developers.facebook.com/)
   - Add Facebook Login product
   - Configure OAuth redirect URIs

3. **Environment Variables**:
   ```env
   # Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   
   # Facebook OAuth
   FACEBOOK_APP_ID=your_facebook_app_id
   FACEBOOK_APP_SECRET=your_facebook_app_secret
   
   # URLs
   BACKEND_URL=http://localhost:5000
   FRONTEND_URL=http://localhost:3000
   SESSION_SECRET=your_session_secret
   ```

## 🔧 Integration Steps

### Step 1: Update Your Registration Form

Add social authentication options to your existing registration form:

```jsx
import React, { useState } from 'react';
import SocialAuthButtons from './components/SocialAuthButtons';

const RegistrationForm = () => {
  const [authMethod, setAuthMethod] = useState('email');
  const [formData, setFormData] = useState({
    username: '',
    fullname: '',
    email: '',
    phone: '',
    role: 'student',
    grade: '1',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (authMethod === 'email') {
      // Use existing OTP flow
      const response = await fetch('/api/users/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, authMethod: 'email' })
      });
      // Handle OTP response...
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Existing form fields */}
      
      {/* Authentication Method Selection */}
      <div className="auth-method-selection">
        <h3>Choose Authentication Method</h3>
        
        <div className="auth-options">
          <label>
            <input
              type="radio"
              value="email"
              checked={authMethod === 'email'}
              onChange={(e) => setAuthMethod(e.target.value)}
            />
            Email OTP Verification
          </label>
          
          <label>
            <input
              type="radio"
              value="social"
              checked={authMethod === 'social'}
              onChange={(e) => setAuthMethod(e.target.value)}
            />
            Social Authentication
          </label>
        </div>
      </div>

      {/* Conditional Form Fields */}
      {authMethod === 'email' ? (
        <>
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
          />
          <button type="submit">Send OTP</button>
        </>
      ) : (
        <SocialAuthButtons mode="register" />
      )}
    </form>
  );
};
```

### Step 2: Add OAuth Callback Route

Add the callback route to your React Router configuration:

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthCallback from './components/AuthCallback';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Existing routes */}
        <Route path="/auth-callback" element={<AuthCallback />} />
        <Route path="/register" element={<RegistrationForm />} />
        <Route path="/login" element={<LoginForm />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### Step 3: Update Login Form

Add social login options to your existing login form:

```jsx
import React from 'react';
import SocialAuthButtons from './components/SocialAuthButtons';

const LoginForm = () => {
  return (
    <div className="login-container">
      {/* Existing email/password login form */}
      
      {/* Social login options */}
      <SocialAuthButtons mode="login" />
    </div>
  );
};
```

### Step 4: Handle Authentication State

Update your authentication context to handle social auth:

```jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token
    const token = localStorage.getItem('token');
    const authProvider = localStorage.getItem('authProvider');
    
    if (token) {
      // Verify token and set user
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (token) => {
    try {
      const response = await fetch('/api/users/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser({ ...userData, authProvider });
      } else {
        // Token invalid, clear storage
        localStorage.removeItem('token');
        localStorage.removeItem('authProvider');
      }
    } catch (error) {
      console.error('Token verification failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('authProvider');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

## 🎨 Styling Integration

### Custom CSS Variables

Add these CSS variables to your main stylesheet for consistent theming:

```css
:root {
  --google-blue: #4285f4;
  --google-red: #ea4335;
  --google-yellow: #fbbc05;
  --google-green: #34a853;
  --facebook-blue: #1877f2;
  --social-border-radius: 8px;
  --social-transition: all 0.2s ease;
}
```

### Responsive Design

The social auth components are fully responsive and include:
- Mobile-first design
- Touch-friendly button sizes
- Proper spacing for different screen sizes
- Dark mode support
- High contrast mode support
- Reduced motion support for accessibility

## 🔒 Security Considerations

### 1. Token Storage
- Store JWT tokens securely (consider httpOnly cookies for production)
- Implement token refresh mechanism
- Clear tokens on logout

### 2. CORS Configuration
- Ensure proper CORS settings for your domains
- Validate origin headers

### 3. Rate Limiting
- Implement rate limiting for OAuth endpoints
- Monitor for suspicious activity

### 4. HTTPS in Production
- Always use HTTPS in production
- Update OAuth redirect URIs accordingly

## 🧪 Testing

### 1. Development Testing
```bash
# Start backend server
cd chatbot-backend
npm start

# Start frontend
cd chatbot-frontend
npm start

# Test OAuth flows
# Visit: http://localhost:5000/api/social-auth/google
# Visit: http://localhost:5000/api/social-auth/facebook
```

### 2. Test Scenarios
- [ ] New user registration with Google
- [ ] New user registration with Facebook
- [ ] Existing user login with social auth
- [ ] Account linking/unlinking
- [ ] Error handling (cancelled auth, network issues)
- [ ] Token refresh and validation

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid Redirect URI"**
   - Check OAuth console settings
   - Ensure exact match with callback URLs

2. **CORS Errors**
   - Verify CORS configuration in `app.js`
   - Check allowed origins

3. **Session Issues**
   - Verify `SESSION_SECRET` is set
   - Check session configuration

4. **Database Errors**
   - Ensure User model has been updated
   - Check MongoDB connection

### Debug Logs

Look for these log messages in your server console:
- `🔐 Google profile received:` - Google OAuth data
- `🔐 Facebook profile received:` - Facebook OAuth data
- `✅ New Google user created:` - New user creation
- `✅ New Facebook user created:` - New user creation

## 📱 Mobile Considerations

### Progressive Web App (PWA)
- Social auth works well with PWA
- Consider deep linking for mobile apps
- Test on various mobile browsers

### Native App Integration
- For React Native, use `react-native-google-signin`
- For Facebook, use `react-native-fbsdk`

## 🚀 Production Deployment

### 1. Environment Setup
```env
# Production environment variables
GOOGLE_CLIENT_ID=your_production_google_client_id
GOOGLE_CLIENT_SECRET=your_production_google_client_secret
FACEBOOK_APP_ID=your_production_facebook_app_id
FACEBOOK_APP_SECRET=your_production_facebook_app_secret
BACKEND_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
SESSION_SECRET=your_strong_session_secret
```

### 2. OAuth Console Updates
- Update redirect URIs in Google/Facebook consoles
- Add production domains to allowed origins
- Configure app settings for production

### 3. Monitoring
- Set up logging for OAuth flows
- Monitor authentication success/failure rates
- Track user registration methods

## 📊 Analytics Integration

Track social authentication usage:

```javascript
// Google Analytics
gtag('event', 'login', {
  method: 'google' // or 'facebook', 'email'
});

// Custom analytics
analytics.track('User Registered', {
  method: 'google',
  timestamp: new Date().toISOString()
});
```

## 🔄 Migration Strategy

### For Existing Users
1. **Backward Compatibility**: Existing email OTP users continue to work
2. **Account Linking**: Users can link social accounts later
3. **Gradual Migration**: Encourage social auth for new registrations

### Data Migration
```javascript
// Example: Link existing user with social account
const linkSocialAccount = async (userId, socialId, provider) => {
  const response = await fetch(`/api/social-auth/link-${provider}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      [`${provider}Id`]: socialId,
      email: userEmail,
      fullname: userFullname
    })
  });
};
```

## 📚 Additional Resources

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login/)
- [Passport.js Documentation](http://www.passportjs.org/)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/rfc6819)

## 🤝 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review server logs for error messages
3. Verify OAuth console configurations
4. Test with different browsers/devices

The social authentication system is designed to work seamlessly alongside your existing email OTP verification, providing users with multiple secure authentication options while maintaining backward compatibility.
