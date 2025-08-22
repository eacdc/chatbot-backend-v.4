# Social Authentication Setup Guide

This guide will help you set up Google and Facebook OAuth authentication for your chatbot application.

## Environment Variables Required

Add the following environment variables to your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Facebook OAuth Configuration
FACEBOOK_APP_ID=your_facebook_app_id_here
FACEBOOK_APP_SECRET=your_facebook_app_secret_here

# Backend URL (for OAuth callbacks)
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

# Session Secret (for Passport sessions)
SESSION_SECRET=your_session_secret_here
```

## Google OAuth Setup

### 1. Create Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Choose "Web application" as the application type
6. Add authorized redirect URIs:
   - `http://localhost:5000/api/social-auth/google/callback` (for development)
   - `https://yourdomain.com/api/social-auth/google/callback` (for production)
7. Copy the Client ID and Client Secret to your `.env` file

### 2. Configure Google OAuth Scopes

The application requests the following scopes:
- `profile` - Access to basic profile information
- `email` - Access to email address

## Facebook OAuth Setup

### 1. Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or select an existing one
3. Add Facebook Login product to your app
4. Go to "Settings" → "Basic" to get your App ID and App Secret
5. Add your App Secret to your `.env` file

### 2. Configure Facebook OAuth

1. In your Facebook app, go to "Facebook Login" → "Settings"
2. Add Valid OAuth Redirect URIs:
   - `http://localhost:5000/api/social-auth/facebook/callback` (for development)
   - `https://yourdomain.com/api/social-auth/facebook/callback` (for production)
3. Configure the following permissions:
   - `email` - Access to email address
   - `public_profile` - Access to basic profile information

## API Endpoints

### Social Authentication Routes

- `GET /api/social-auth/google` - Initiate Google OAuth
- `GET /api/social-auth/google/callback` - Google OAuth callback
- `GET /api/social-auth/facebook` - Initiate Facebook OAuth
- `GET /api/social-auth/facebook/callback` - Facebook OAuth callback

### Social Account Management

- `POST /api/social-auth/link-google` - Link Google account to existing user
- `POST /api/social-auth/link-facebook` - Link Facebook account to existing user
- `POST /api/social-auth/unlink-google` - Unlink Google account
- `POST /api/social-auth/unlink-facebook` - Unlink Facebook account
- `GET /api/social-auth/linked-accounts` - Get user's linked social accounts

### Registration with Social Auth

- `POST /api/users/register-social` - Register new user with social authentication

## Frontend Integration

### 1. Add Social Login Buttons

```jsx
// Google Login Button
<button onClick={() => window.location.href = '/api/social-auth/google'}>
  Login with Google
</button>

// Facebook Login Button
<button onClick={() => window.location.href = '/api/social-auth/facebook'}>
  Login with Facebook
</button>
```

### 2. Handle OAuth Callbacks

Create a callback handler component:

```jsx
// AuthCallback.js
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const provider = searchParams.get('provider');
    
    if (token) {
      // Store the token in localStorage or your auth context
      localStorage.setItem('token', token);
      
      // Redirect to dashboard or home page
      navigate('/dashboard');
    } else {
      // Handle error
      navigate('/login?error=auth_failed');
    }
  }, [searchParams, navigate]);

  return <div>Processing authentication...</div>;
}
```

### 3. Update Registration Form

Add social authentication options to your registration form:

```jsx
// RegistrationForm.js
const [authMethod, setAuthMethod] = useState('email'); // 'email' or 'social'

// In your form JSX
<div>
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

{authMethod === 'social' && (
  <div>
    <button onClick={() => window.location.href = '/api/social-auth/google'}>
      Continue with Google
    </button>
    <button onClick={() => window.location.href = '/api/social-auth/facebook'}>
      Continue with Facebook
    </button>
  </div>
)}
```

## Security Considerations

1. **HTTPS in Production**: Always use HTTPS in production for OAuth callbacks
2. **Session Security**: Use a strong session secret
3. **Token Storage**: Store JWT tokens securely (httpOnly cookies recommended)
4. **CORS Configuration**: Ensure proper CORS settings for your domains
5. **Rate Limiting**: Implement rate limiting for OAuth endpoints

## Testing

1. Start your backend server
2. Test Google OAuth: Visit `http://localhost:5000/api/social-auth/google`
3. Test Facebook OAuth: Visit `http://localhost:5000/api/social-auth/facebook`
4. Verify callbacks work correctly
5. Test account linking/unlinking functionality

## Troubleshooting

### Common Issues

1. **Invalid Redirect URI**: Ensure your redirect URIs match exactly in Google/Facebook console
2. **CORS Errors**: Check your CORS configuration in `app.js`
3. **Session Issues**: Verify your session secret is set correctly
4. **Database Errors**: Ensure your User model has been updated with social auth fields

### Debug Logs

The application includes comprehensive logging for OAuth flows. Check your server console for:
- `🔐 Google profile received:` - Google OAuth profile data
- `🔐 Facebook profile received:` - Facebook OAuth profile data
- `✅ New Google user created:` - New user creation via Google
- `✅ New Facebook user created:` - New user creation via Facebook

## Production Deployment

1. Update environment variables with production URLs
2. Ensure HTTPS is configured
3. Update OAuth redirect URIs in Google/Facebook consoles
4. Test the complete OAuth flow in production
5. Monitor logs for any authentication issues
