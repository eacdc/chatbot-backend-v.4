import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "../config";
import { updateLastActivity } from "../utils/auth";

const Chat = () => {
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  // Check authentication and load initial welcome message
  useEffect(() => {
    console.log("Chat component mounted");
    // Check authentication directly
    const token = localStorage.getItem('token');
    const isAuth = localStorage.getItem('isAuthenticated');
    
    console.log("Auth check in Chat component:", { 
      token: token ? "exists" : "missing", 
      isAuthenticated: isAuth 
    });

    // Check if user is authenticated
    if (!token) {
      console.log("No token found, redirecting to login");
      navigate("/login");
      return;
    }

    // Update activity timestamp
    updateLastActivity();
    
    // Add initial welcome message
    const welcomeMessage = {
      role: "assistant",
      content: "Welcome! 👋 How can I help you today?"
    };
    setChatHistory([welcomeMessage]);
    setLoading(false);
  }, [navigate]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    // Add user message to chat
    const userMessage = { role: "user", content: message };
    setChatHistory(prev => [...prev, userMessage]);
    
    // Clear input
    setMessage("");
    
    try {
      // Get user ID from localStorage
      const userId = localStorage.getItem("userId");
      const token = localStorage.getItem("token");
      
      if (!userId || !token) {
        navigate("/login");
        return;
      }
      
      // Send message to API
      const response = await axios.post(`${API_ENDPOINTS.CHAT}/send`, {
        message: message,
        userId: userId
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Add response to chat
      if (response.data && response.data.response) {
        setChatHistory(prev => [...prev, { 
          role: "assistant", 
          content: response.data.response 
        }]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setChatHistory(prev => [...prev, { 
        role: "system", 
        content: "Sorry, there was an error processing your request. Please try again." 
      }]);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 p-4 rounded-lg">
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {chatHistory.map((msg, index) => (
          <div 
            key={index}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div 
              className={`max-w-[70%] rounded-lg p-3 ${
                msg.role === "user" 
                  ? "bg-blue-500 text-white rounded-br-none" 
                  : msg.role === "system"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-200 text-gray-800 rounded-bl-none"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSendMessage} className="flex">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here..."
          className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-r-lg hover:bg-blue-600 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
