import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import './SocialAuthButtons.css';

const SocialAuthButtons = ({ 
  onSuccess, 
  onError, 
  mode = 'login', // 'login' or 'register'
  className = '' 
}) => {
  const [loading, setLoading] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('🔍 SocialAuthButtons component mounted');
    console.log('🔍 API_URL:', API_URL);
    console.log('🔍 Mode:', mode);
    console.log('🔍 ClassName:', className);
  }, [mode, className]);

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      console.log('🔐 Initiating Google OAuth...');
      console.log('🔐 Redirect URL:', `${API_URL}/api/social-auth/google`);
      
      // Redirect to Google OAuth
      window.location.href = `${API_URL}/api/social-auth/google`;
    } catch (error) {
      console.error('Google auth error:', error);
      setLoading(false);
      onError && onError('Failed to initiate Google authentication');
    }
  };

  const handleFacebookAuth = async () => {
    try {
      setLoading(true);
      console.log('🔐 Initiating Facebook OAuth...');
      console.log('🔐 Redirect URL:', `${API_URL}/api/social-auth/facebook`);
      
      // Redirect to Facebook OAuth
      window.location.href = `${API_URL}/api/social-auth/facebook`;
    } catch (error) {
      console.error('Facebook auth error:', error);
      setLoading(false);
      onError && onError('Failed to initiate Facebook authentication');
    }
  };

  console.log('🔍 Rendering SocialAuthButtons component');

  return (
    <div className={`social-auth-container ${className}`} style={{ border: '2px solid red', padding: '10px', margin: '10px 0' }}>
      <div style={{ color: 'red', fontSize: '12px', marginBottom: '10px' }}>
        DEBUG: SocialAuthButtons Component is rendering
      </div>
      
      <div className="social-auth-divider">
        <span>or {mode === 'login' ? 'login' : 'register'} with</span>
      </div>
      
      <div className="social-auth-buttons">
        <button 
          className={`social-auth-btn google-btn ${loading ? 'loading' : ''}`}
          onClick={handleGoogleAuth}
          disabled={loading}
          type="button"
          style={{ border: '2px solid blue', backgroundColor: '#f0f8ff' }}
        >
          <svg className="social-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>{loading ? 'Redirecting...' : 'Continue with Google'}</span>
        </button>

        <button 
          className={`social-auth-btn facebook-btn ${loading ? 'loading' : ''}`}
          onClick={handleFacebookAuth}
          disabled={loading}
          type="button"
          style={{ border: '2px solid green', backgroundColor: '#f0fff0' }}
        >
          <svg className="social-icon" viewBox="0 0 24 24">
            <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <span>{loading ? 'Redirecting...' : 'Continue with Facebook'}</span>
        </button>
      </div>

      <div className="social-auth-disclaimer">
        <small>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </small>
      </div>
    </div>
  );
};

export default SocialAuthButtons;
