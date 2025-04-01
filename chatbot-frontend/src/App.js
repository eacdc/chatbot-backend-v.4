import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import ChatbotLayout from "./components/ChatbotLayout"; // ✅ Keeping ChatbotLayout
import Chat from "./components/Chat";
import Login from "./components/Login";
import Signup from "./components/Signup";
import AdminRegister from "./components/AdminRegister";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import AddBook from "./components/AddBook";  // Create this later
import AddChapter from "./components/AddChapter";  // Create this later
import Collections from "./components/Collections"; // Import the Collections page
import "./App.css";

function App() {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true"; // ✅ Fixing key name

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin-register" element={<AdminRegister />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/add-book" element={<AddBook />} />
        <Route path="/admin/add-chapter" element={<AddChapter />} />
        <Route path="/collections" element={<Collections />} />

        {/* Protected Chat Route with ChatbotLayout */}
        <Route
          path="/chat"
          element={
            isAuthenticated ? (
              <ChatbotLayout>
                <Chat />
              </ChatbotLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Redirect '/' to Chat if logged in, otherwise go to Login */}
        <Route path="/" element={<Navigate to={isAuthenticated ? "/chat" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
