import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './AuthCallback.css';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const token = searchParams.get('token');
        const provider = searchParams.get('provider');
        const errorParam = searchParams.get('error');

        // Check for OAuth errors
        if (errorParam) {
          setStatus('error');
          setError(getErrorMessage(errorParam));
          return;
        }

        // Check if we have a valid token
        if (!token) {
          setStatus('error');
          setError('Authentication failed. No token received.');
          return;
        }

        // Store the token and set authentication status
        localStorage.setItem('token', token);
        localStorage.setItem('isAuthenticated', 'true');
        
        // Store auth provider info
        if (provider) {
          localStorage.setItem('authProvider', provider);
        }

        // Try to decode the token to get user info
        try {
          const tokenPayload = JSON.parse(atob(token.split('.')[1]));
          if (tokenPayload.userId) {
            localStorage.setItem('userId', tokenPayload.userId);
          }
          if (tokenPayload.name) {
            localStorage.setItem('userName', tokenPayload.name);
          }
          if (tokenPayload.role) {
            localStorage.setItem('userRole', tokenPayload.role);
          }
          if (tokenPayload.grade) {
            localStorage.setItem('userGrade', tokenPayload.grade);
          }
        } catch (decodeError) {
          console.warn('Could not decode token payload:', decodeError);
        }

        // Update status
        setStatus('success');

        // Redirect after a short delay to show success message
        setTimeout(() => {
          // Redirect to chat page (main application)
          navigate('/chat', { replace: true });
        }, 1500);

      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setError('An unexpected error occurred during authentication.');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  const getErrorMessage = (errorCode) => {
    const errorMessages = {
      'google_auth_failed': 'Google authentication failed. Please try again.',
      'facebook_auth_failed': 'Facebook authentication failed. Please try again.',
      'google_not_configured': 'Google authentication is not configured.',
      'facebook_not_configured': 'Facebook authentication is not configured.',
      'access_denied': 'Authentication was cancelled.',
      'invalid_request': 'Invalid authentication request.',
      'server_error': 'Server error during authentication.',
      'temporarily_unavailable': 'Authentication service temporarily unavailable.'
    };

    return errorMessages[errorCode] || 'Authentication failed. Please try again.';
  };

  const handleRetry = () => {
    setStatus('processing');
    setError(null);
    // Redirect back to login page
    navigate('/login');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  if (status === 'processing') {
    return (
      <div className="auth-callback-container">
        <div className="auth-callback-card">
          <div className="auth-callback-spinner">
            <div className="spinner"></div>
          </div>
          <h2>Processing Authentication</h2>
          <p>Please wait while we complete your login...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="auth-callback-container">
        <div className="auth-callback-card success">
          <div className="auth-callback-icon success">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </div>
          <h2>Authentication Successful!</h2>
          <p>You have been successfully logged in. Redirecting to chat...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="auth-callback-container">
        <div className="auth-callback-card error">
          <div className="auth-callback-icon error">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h2>Authentication Failed</h2>
          <p className="error-message">{error}</p>
          <div className="auth-callback-actions">
            <button onClick={handleRetry} className="btn btn-primary">
              Try Again
            </button>
            <button onClick={handleGoHome} className="btn btn-secondary">
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;
