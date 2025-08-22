# Deployment Guide for Social Authentication

## Overview
This guide explains how to deploy the chatbot application with social authentication (Google and Facebook OAuth) without breaking the application when credentials are not configured.

## Environment Variables Setup

### Required Environment Variables

Add these to your production environment (Render, Heroku, etc.):

```env
# JWT Secret (Required)
JWT_SECRET=your_secure_jwt_secret_here

# Session Secret (Required for Passport.js)
SESSION_SECRET=your_secure_session_secret_here

# Database URL (Required)
MONGODB_URI=your_mongodb_connection_string

# Backend URL (Required)
BACKEND_URL=https://your-backend-domain.com

# Frontend URL (Required)
FRONTEND_URL=https://your-frontend-domain.com

# Google OAuth (Optional - App will work without these)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Facebook OAuth (Optional - App will work without these)
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

## Deployment Behavior

### With OAuth Credentials
- ✅ Google and Facebook login buttons will be available
- ✅ Users can authenticate via social providers
- ✅ Email OTP authentication continues to work

### Without OAuth Credentials
- ⚠️ Google and Facebook login buttons will be disabled
- ✅ Email OTP authentication continues to work
- ✅ Application starts successfully without errors
- ✅ Users see appropriate error messages when trying to access disabled providers

## Setting Up OAuth Credentials

### For Google OAuth:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `https://your-backend-domain.com/api/social-auth/google/callback`

### For Facebook OAuth:
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Add Facebook Login product
4. Configure OAuth redirect URIs:
   - `https://your-backend-domain.com/api/social-auth/facebook/callback`

## Testing Deployment

### Check OAuth Provider Status
```bash
GET /api/social-auth/available-providers
```

Response:
```json
{
  "availableProviders": {
    "google": true,
    "facebook": false
  },
  "message": "OAuth provider availability status"
}
```

### Test Without Credentials
If you deploy without OAuth credentials:
1. Application should start successfully
2. Email OTP authentication should work
3. Social login buttons should be disabled or show appropriate messages
4. No errors should appear in logs

## Troubleshooting

### Common Issues

1. **"OAuth2Strategy requires a clientID option"**
   - ✅ **FIXED**: Application now checks for credentials before initializing strategies
   - Application will start successfully even without OAuth credentials

2. **"MemoryStore is not designed for production"**
   - This is a warning, not an error
   - Consider using Redis or another session store for production
   - Application will still work with MemoryStore

3. **Social login buttons not working**
   - Check if OAuth credentials are properly set
   - Verify redirect URIs match your domain
   - Check browser console for errors

### Log Messages to Look For

**Successful startup:**
```
✅ Google OAuth strategy initialized
✅ Facebook OAuth strategy initialized
```

**Partial setup:**
```
✅ Google OAuth strategy initialized
⚠️ Facebook OAuth credentials not found - Facebook login disabled
```

**No OAuth setup:**
```
⚠️ Google OAuth credentials not found - Google login disabled
⚠️ Facebook OAuth credentials not found - Facebook login disabled
```

## Security Considerations

1. **Environment Variables**: Never commit credentials to version control
2. **HTTPS**: Always use HTTPS in production for OAuth callbacks
3. **Session Security**: Use a strong SESSION_SECRET
4. **JWT Security**: Use a strong JWT_SECRET
5. **Domain Validation**: Ensure OAuth redirect URIs match your exact domain

## Next Steps

1. Deploy with basic environment variables (JWT_SECRET, SESSION_SECRET, etc.)
2. Test email OTP authentication
3. Add OAuth credentials when ready
4. Test social authentication
5. Monitor logs for any issues

## Support

If you encounter issues:
1. Check the application logs
2. Verify environment variables are set correctly
3. Test the `/api/social-auth/available-providers` endpoint
4. Ensure your domain is properly configured in OAuth apps
