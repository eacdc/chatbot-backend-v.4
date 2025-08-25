import React, { useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import ChatbotLayout from "./components/ChatbotLayout"; // ✅ Keeping ChatbotLayout
import Chat from "./components/Chat";
import Login from "./components/Login";
import Signup from "./components/Signup";
import ForgotPassword from "./components/ForgotPassword";
import AdminRegister from "./components/AdminRegister";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import AddBook from "./components/AddBook";  // Create this later
import AddChapter from "./components/AddChapter";  // Create this later
import Collections from "./components/Collections"; // Import the Collections page
import AdminCollections from "./components/AdminCollections"; // Import the AdminCollections page
import Profile from "./components/Profile"; // Import the Profile page
import AuthCallback from "./components/AuthCallback"; // Import the AuthCallback component
import { setupActivityTracking } from "./utils/auth"; // Import auth utilities
import { ThemeProvider } from "./ThemeContext"; // Import ThemeProvider
import "./App.css";

// Custom component for admin routes protection
const ProtectedAdminRoute = ({ element }) => {
  const adminToken = localStorage.getItem("adminToken");
  return adminToken ? element : <Navigate to="/admin-login" />;
};

function App() {
  // Check if user is authenticated directly from localStorage
  const userIsAuthenticated = !!localStorage.getItem("token");

  // Handle redirects from 404.html and check for auth cookies
  useEffect(() => {
    const redirectPath = sessionStorage.getItem('redirectPath');
    if (redirectPath) {
      sessionStorage.removeItem('redirectPath');
      window.history.replaceState(null, '', redirectPath);
    }
    
    // Check for authentication cookies (for social login)
    const checkForAuthCookies = () => {
      const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
      };
      
      const authToken = getCookie('auth_token');
      const authProvider = getCookie('auth_provider');
      const userId = getCookie('user_id');
      
      console.log('Checking for auth cookies:', { authToken: !!authToken, authProvider, userId });
      
      if (authToken && !localStorage.getItem('token')) {
        console.log('Found auth token in cookies, storing in localStorage');
        localStorage.setItem('token', authToken);
        localStorage.setItem('isAuthenticated', 'true');
        
        if (authProvider) {
          localStorage.setItem('authProvider', authProvider);
        }
        
        if (userId) {
          localStorage.setItem('userId', userId);
        }
        
        // Clear the cookies after transferring to localStorage
        document.cookie = 'auth_token=; Max-Age=-99999999;';
        document.cookie = 'auth_provider=; Max-Age=-99999999;';
        document.cookie = 'user_id=; Max-Age=-99999999;';
        
        // Force a refresh to update authentication state
        window.location.reload();
      }
    };
    
    // Run the cookie check
    checkForAuthCookies();
    
    // Set up session timeout tracking
    if (userIsAuthenticated) {
      const cleanupTracking = setupActivityTracking();
      
      // Clean up on component unmount
      return () => {
        if (cleanupTracking) cleanupTracking();
      };
    }
  }, [userIsAuthenticated]);

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin-register" element={<AdminRegister />} />
          <Route path="/auth-callback" element={<AuthCallback />} /> {/* Add OAuth callback route */}
          
          {/* Protected Admin Routes */}
          <Route path="/admin/dashboard" element={<ProtectedAdminRoute element={<AdminDashboard />} />} />
          <Route path="/admin/add-book" element={<ProtectedAdminRoute element={<AddBook />} />} />
          <Route path="/admin/add-chapter" element={<ProtectedAdminRoute element={<AddChapter />} />} />
          <Route path="/admin/collections" element={<ProtectedAdminRoute element={<AdminCollections />} />} />
          
          {/* Protected User Routes */}
          <Route path="/collections" element={
            userIsAuthenticated ? <Collections /> : <Navigate to="/login" />
          } />
          <Route path="/profile" element={
            userIsAuthenticated ? <Profile /> : <Navigate to="/login" />
          } />

          {/* Protected Chat Route with ChatbotLayout */}
          <Route
            path="/chat"
            element={
              userIsAuthenticated ? (
                <ChatbotLayout>
                  <Chat />
                </ChatbotLayout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />

          {/* Redirect '/' to Chat if logged in, otherwise go to Login */}
          <Route path="/" element={<Navigate to={userIsAuthenticated ? "/chat" : "/login"} />} />

          {/* Catch-all route for 404s */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
