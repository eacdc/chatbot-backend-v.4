import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * This component handles authentication redirects and prevents 
 * users from accessing login pages after authentication
 */
const AuthRedirectHandler = () => {
  const navigate = useNavigate();
  const [showError, setShowError] = useState(false);
  
  useEffect(() => {
    const isUserAuthenticated = localStorage.getItem('isAuthenticated') === 'true' && localStorage.getItem('token');
    const isAdminAuthenticated = localStorage.getItem('adminToken') && localStorage.getItem('adminId');
    
    // Get current path
    const currentPath = window.location.pathname;
    
    // Check if we're on a login page
    const isLoginPage = currentPath === '/login' || currentPath === '/admin-login';
    
    if (isLoginPage) {
      if (isUserAuthenticated) {
        // User is authenticated but trying to access login page
        setShowError(true);
        
        // After showing error briefly, redirect to chat
        setTimeout(() => {
          window.history.replaceState(null, '', '/chat');
          navigate('/chat', { replace: true });
        }, 2000);
        
      } else if (isAdminAuthenticated && currentPath === '/admin-login') {
        // Admin is authenticated but trying to access admin login page
        setShowError(true);
        
        // After showing error briefly, redirect to admin dashboard
        setTimeout(() => {
          window.history.replaceState(null, '', '/admin/dashboard');
          navigate('/admin/dashboard', { replace: true });
        }, 2000);
      }
    }
  }, [navigate]);
  
  if (!showError) return null;
  
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <div className="text-red-600 mb-4 flex justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
          Access Denied
        </h2>
        <p className="text-gray-600 text-center mb-6">
          You're already logged in. You cannot access the login page while authenticated. Redirecting you now...
        </p>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    </div>
  );
};

export default AuthRedirectHandler; 