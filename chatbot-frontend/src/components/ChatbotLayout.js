import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserEdit, FaSignOutAlt, FaBook, FaChevronDown, FaChevronRight, FaPlus, FaMicrophone, FaStop, FaTimes } from "react-icons/fa";
import axios from "axios";
import { API_ENDPOINTS } from "../config";
import { updateLastActivity, isAuthenticated } from "../utils/auth"; // Import auth utilities
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CHAT_BACKGROUND, CHAT_CONFIG } from "../config/chatConfig"; // Import chat configuration

export default function ChatbotLayout({ children }) {
  const [subscribedBooks, setSubscribedBooks] = useState([]);
  const [expandedBook, setExpandedBook] = useState(null);
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [bookChapters, setBookChapters] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeChapter, setActiveChapter] = useState(null);
  const [currentChapterTitle, setCurrentChapterTitle] = useState("");
  const chatEndRef = useRef(null);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [notification, setNotification] = useState({ show: false, type: "", message: "" });

  const getUserId = () => localStorage.getItem("userId");
  const getToken = () => localStorage.getItem("token");

  // Update activity timestamp on component mount
  useEffect(() => {
    // Check if user is authenticated and update activity timestamp
    if (isAuthenticated()) {
      updateLastActivity();
    } else {
      // Redirect to login if not authenticated
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const fetchUserSubscriptions = async () => {
      const userId = getUserId();
      const token = getToken();
      
      if (!userId || !token) {
        navigate("/login");
        return;
      }
      
      try {
        setLoading(true);
        const response = await axios.get(API_ENDPOINTS.GET_SUBSCRIPTIONS, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        console.log("Subscriptions data:", response.data);
        setSubscribedBooks(response.data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching subscriptions:", error);
        // Don't redirect on error, just show empty state
        setSubscribedBooks([]);
        setLoading(false);
        
        // If there's an authorization error, redirect to login
        if (error.response && error.response.status === 401) {
          console.log("Unauthorized - redirecting to login");
          navigate("/login");
        }
      }
    };
    
    fetchUserSubscriptions();
  }, [navigate]);

  // Fetch chat history for a specific chapter
  const fetchChapterChatHistory = async (chapterId) => {
    const userId = getUserId();
    const token = getToken();
    
    if (!userId || !token) {
      navigate("/login");
      return;
    }
    
    try {
      setLoading(true);
      console.log(`Fetching chat history for chapter: ${chapterId}`);
      
      const response = await axios.get(API_ENDPOINTS.GET_CHAPTER_HISTORY.replace(':chapterId', chapterId), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'user-id': userId
        }
      });
      
      console.log("Chapter Chat History Response:", response.data);
      
      if (Array.isArray(response.data)) {
        setChatHistory(response.data);
        console.log(`Loaded ${response.data.length} messages for chapter`);
      } else {
        console.warn("Unexpected data format from server:", response.data);
        setChatHistory([]);
      }
      
    } catch (error) {
      console.error("Error fetching chapter chat history:", error);
      setChatHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // General chat history (used when no chapter is selected)
  useEffect(() => {
    const fetchGeneralChatHistory = async () => {
      if (activeChapter) return;
      
      const userId = getUserId();
      if (!userId) {
        navigate("/login");
        return;
      }
      try {
        const response = await axios.get(API_ENDPOINTS.GET_CHAT_HISTORY.replace(':userId', userId));
        console.log("General Chat History Response:", response.data);
        setChatHistory(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Error fetching chat history:", error);
        setChatHistory([]);
      }
    };
    
    if (!activeChapter) {
      fetchGeneralChatHistory();
    }
  }, [navigate, activeChapter]);

  const fetchBookChapters = async (bookId) => {
    const token = getToken();
    
    if (!token) {
      navigate("/login");
      return;
    }
    
    try {
      const response = await axios.get(API_ENDPOINTS.GET_BOOK_CHAPTERS.replace(':bookId', bookId), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log("Chapters for book:", response.data);
      setBookChapters({
        ...bookChapters,
        [bookId]: response.data
      });
    } catch (error) {
      console.error(`Error fetching chapters for book ${bookId}:`, error);
      setBookChapters({
        ...bookChapters,
        [bookId]: []
      });
    }
  };

  const toggleBookExpansion = (bookId) => {
    if (expandedBook === bookId) {
      setExpandedBook(null);
    } else {
      setExpandedBook(bookId);
      if (!bookChapters[bookId]) {
        fetchBookChapters(bookId);
      }
    }
  };

  // Handle chapter selection
  const handleChapterSelect = async (chapter) => {
    setActiveChapter(chapter._id);
    setCurrentChapterTitle(chapter.title);
    
    // Fetch chat history for this chapter
    await fetchChapterChatHistory(chapter._id);
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    try {
      const userId = getUserId();
      const token = getToken();
      
      if (!userId || !token) {
        navigate("/login");
        return;
      }
      
      // Add user message to chat history immediately for better UX
      const newMessage = { role: "user", content: message };
      setChatHistory([...chatHistory, newMessage]);
      setMessage("");
      
      const response = await axios.post(`${API_ENDPOINTS.CHAT}/send`, {
        message: message,
        userId: getUserId(),
        ...(activeChapter && { chapterId: activeChapter }),
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Add AI response to chat history
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
        content: "Failed to send message. Please try again." 
      }]);
    }
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      // Check if the browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support audio recording");
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        // Release the microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      
      // Provide more specific error messages based on the error type
      let errorMessage = "Could not access microphone. ";
      
      if (error.name === "NotFoundError") {
        errorMessage += "No microphone was found on your device. Please connect a microphone and try again.";
      } else if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorMessage += "Microphone access was denied. Please allow microphone access in your browser settings.";
      } else if (error.name === "AbortError") {
        errorMessage += "The recording was aborted. Please try again.";
      } else if (error.name === "NotReadableError") {
        errorMessage += "Your microphone is busy or not readable. Please close other applications that might be using it.";
      } else if (error.name === "OverconstrainedError") {
        errorMessage += "The requested microphone could not be used with the requested constraints.";
      } else {
        errorMessage += error.message || "Please check your device and browser permissions.";
      }
      
      setChatHistory([...chatHistory, { 
        role: "system", 
        content: errorMessage
      }]);
    }
  };

  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const sendAudioMessage = async () => {
    if (!audioBlob) return;
    
    const userId = getUserId();
    const token = getToken();
    if (!userId || !token) return;
    
    // Create message indicating audio is being processed
    const newChat = [...chatHistory, { 
      role: "user", 
      content: "🎤 Processing audio message..." 
    }];
    setChatHistory(newChat);
    
    try {
      // Create form data to send the audio file for transcription
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      // Use our secure backend endpoint for transcription
      const transcriptionResponse = await axios.post(
        API_ENDPOINTS.TRANSCRIBE_AUDIO,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      // Get the transcribed text
      const transcribedText = transcriptionResponse.data.text;
      
      // Update chat with transcribed text
      const updatedChat = [...newChat.slice(0, -1), { 
        role: "user", 
        content: transcribedText 
      }];
      setChatHistory(updatedChat);
      
      // Now send the transcribed text to the chat API
      const response = await axios.post(`${API_ENDPOINTS.CHAT}/send`, {
        message: transcribedText,
        userId: getUserId(),
        ...(activeChapter && { chapterId: activeChapter }),
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Add AI response to chat history
      if (response.data && response.data.response) {
        setChatHistory([...updatedChat, { 
          role: "assistant", 
          content: response.data.response 
        }]);
      }
    } catch (error) {
      console.error("Error processing audio message:", error);
      
      // Check if it's a transcription error or a chat API error
      const errorMessage = error.response?.data?.error || "Failed to process audio message. Please try again.";
      setChatHistory([...newChat, { 
        role: "system", 
        content: errorMessage
      }]);
    }
    
    // Reset audio state
    setAudioBlob(null);
  };

  // Clear active chapter
  const clearActiveChapter = async () => {
    setActiveChapter(null);
    setCurrentChapterTitle("");
    
    // Fetch general chat history
    const userId = getUserId();
    if (!userId) return;
    
    try {
      const response = await axios.get(API_ENDPOINTS.GET_CHAT_HISTORY.replace(':userId', userId));
      setChatHistory(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      setChatHistory([]);
    }
  };

  useEffect(() => {
    // Scroll to bottom when chat history changes
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

  const handleLogout = () => setShowLogoutPopup(true);

  const confirmLogout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("token");
    setShowLogoutPopup(false);
    navigate("/login");
  };

  // Unsubscribe from a book
  const handleUnsubscribe = async (bookId, event) => {
    // Prevent the click from triggering the book expansion
    event.stopPropagation();
    
    try {
      const token = getToken();
      if (!token) {
        navigate("/login");
        return;
      }
      
      await axios.delete(
        API_ENDPOINTS.UNSUBSCRIBE_BOOK.replace(':bookId', bookId),
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      // Remove the book from state
      setSubscribedBooks(subscribedBooks.filter(book => book.bookId !== bookId));
      
      // Remove book chapters from state if they exist
      if (bookChapters[bookId]) {
        const updatedChapters = { ...bookChapters };
        delete updatedChapters[bookId];
        setBookChapters(updatedChapters);
      }
      
      // Clear active chapter if it belongs to the unsubscribed book
      if (expandedBook === bookId) {
        setExpandedBook(null);
        if (activeChapter) {
          const chapterBelongsToBook = bookChapters[bookId]?.some(
            chapter => chapter._id === activeChapter
          );
          
          if (chapterBelongsToBook) {
            clearActiveChapter();
          }
        }
      }
      
      setNotification({
        show: true,
        type: "success",
        message: "Successfully unsubscribed from the book"
      });
      
    } catch (error) {
      console.error("Error unsubscribing:", error);
      setNotification({
        show: true,
        type: "error",
        message: "Failed to unsubscribe: " + (error.response?.data?.error || error.message)
      });
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <div className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-3 sm:p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
            <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
          </svg>
          <span className="text-xl font-bold tracking-wide">BookChat</span>
        </div>
        {/* Mobile menu toggle button */}
        <button 
          className="lg:hidden flex items-center justify-center p-2 rounded-md text-white hover:bg-blue-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar overlay for mobile - only shows when sidebar is open */}
        {isSidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-10"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          ></div>
        )}
        
        {/* Sidebar */}
        <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transform transition-transform duration-300 ease-in-out lg:w-72 w-3/4 max-w-sm bg-gray-800 text-white fixed lg:relative z-20 h-full lg:h-auto overflow-y-auto shadow-lg flex flex-col`}>
          <div className="p-4 flex-1">
            <div className="flex justify-between items-center lg:hidden mb-4">
              <h2 className="text-lg font-semibold">My Library</h2>
              <button 
                className="p-2 rounded-full text-white hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <h2 className="text-lg font-semibold mb-4 hidden lg:block">My Library</h2>
            
            {loading ? (
              <div className="py-10 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : subscribedBooks.length > 0 ? (
              <div className="space-y-2 mb-6">
                {subscribedBooks.map((sub) => (
                  <div key={sub._id} className="bg-gray-700 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-600 transition-colors duration-200" onClick={() => toggleBookExpansion(sub.bookId)}>
                      <span className="font-medium truncate flex-1">{sub.bookTitle}</span>
                      <div className="flex items-center">
                        <button
                          className="mr-2 text-gray-400 hover:text-red-500 focus:outline-none"
                          onClick={(e) => handleUnsubscribe(sub.bookId, e)}
                          title="Unsubscribe"
                        >
                          <FaTimes className="h-4 w-4" />
                        </button>
                        <span className="text-gray-300 transform transition-transform duration-200">
                          {expandedBook === sub.bookId ? 
                            <FaChevronDown className="h-4 w-4" /> : 
                            <FaChevronRight className="h-4 w-4" />
                          }
                        </span>
                      </div>
                    </div>
                    
                    {expandedBook === sub.bookId && (
                      <div className="border-t border-gray-600">
                        {bookChapters[sub.bookId] ? (
                          bookChapters[sub.bookId].length > 0 ? (
                            <div className="max-h-64 overflow-y-auto">
                              {bookChapters[sub.bookId].map((chapter) => (
                                <div 
                                  key={chapter._id} 
                                  className={`p-2 pl-6 cursor-pointer transition-colors duration-200 text-sm ${
                                    activeChapter === chapter._id 
                                      ? "bg-blue-600 text-white" 
                                      : "text-gray-300 hover:bg-gray-600 hover:text-white"
                                  }`}
                                  onClick={() => {
                                    handleChapterSelect(chapter);
                                    setIsSidebarOpen(false);
                                  }}
                                >
                                  {chapter.title}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 text-sm text-gray-400">No chapters available</div>
                          )
                        ) : (
                          <div className="p-3 flex justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-700 rounded-lg p-4 text-center">
                <p className="text-gray-300 mb-4">No books in your library</p>
                <button 
                  className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                  onClick={() => {
                    navigate("/collections");
                    setIsSidebarOpen(false);
                  }}
                >
                  <FaPlus className="mr-2 h-4 w-4" /> Add Books
                </button>
              </div>
            )}
            
            {/* For mobile only - showing controls in the main sidebar area */}
            <div className="pt-4 mt-6 border-t border-gray-700 lg:hidden">
              <nav className="space-y-2">
                <button 
                  className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={() => {
                    navigate("/profile");
                    setIsSidebarOpen(false);
                  }}
                >
                  <FaUserEdit className="h-5 w-5 text-gray-400" /> 
                  <span>Profile</span>
                </button>
                <button
                  className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={() => {
                    navigate("/collections");
                    setIsSidebarOpen(false);
                  }}
                >
                  <FaBook className="h-5 w-5 text-gray-400" /> 
                  <span>Collections</span>
                </button>
                <button
                  className="w-full flex items-center gap-2 p-3 rounded-lg bg-red-600 hover:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                  onClick={handleLogout}
                >
                  <FaSignOutAlt className="h-5 w-5" /> 
                  <span>Logout</span>
                </button>
              </nav>
            </div>
          </div>
          
          {/* For desktop only - controls fixed at the bottom */}
          <div className="hidden lg:block border-t border-gray-700 mt-auto">
            <nav className="p-4 space-y-2">
              <button 
                className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => navigate("/profile")}
              >
                <FaUserEdit className="h-5 w-5 text-gray-400" /> 
                <span>Profile</span>
              </button>
              <button
                className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => {
                  navigate("/collections");
                  setIsSidebarOpen(false);
                }}
              >
                <FaBook className="h-5 w-5 text-gray-400" /> 
                <span>Collections</span>
              </button>
              <button
                className="w-full flex items-center gap-2 p-3 rounded-lg bg-red-600 hover:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                onClick={handleLogout}
              >
                <FaSignOutAlt className="h-5 w-5" /> 
                <span>Logout</span>
              </button>
            </nav>
          </div>
        </div>
        
        {/* Chat Area */}
        <div 
          className="flex flex-col flex-1 overflow-hidden ml-0 lg:ml-72 transition-all duration-300 ease-in-out"
          style={{ 
            backgroundImage: `url(${CHAT_BACKGROUND})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
            height: '100%',
            width: '100%'
          }}
        >
          {/* Current chapter indicator */}
          {activeChapter && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-3 shadow-sm flex justify-between items-center">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-blue-200">Active Chapter</span>
                <h3 className="text-sm sm:text-base font-medium">{currentChapterTitle}</h3>
              </div>
              <button 
                className="text-xs bg-indigo-800 hover:bg-indigo-900 px-3 py-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white"
                onClick={clearActiveChapter}
              >
                Exit Chapter
              </button>
            </div>
          )}
          
          {/* Messages Container - No background image here anymore */}
          <div 
            className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" 
            style={{ scrollBehavior: 'smooth' }}
          >
            {Array.isArray(chatHistory) && chatHistory.length > 0 ? (
              <div className="space-y-4">
                {chatHistory.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] sm:max-w-[75%] rounded-lg shadow-md p-3 ${
                      msg.role === "user" 
                        ? "bg-blue-600 text-white rounded-tr-none" 
                        : msg.role === "system" 
                          ? "bg-yellow-100 text-yellow-800 rounded-tl-none border border-yellow-200" 
                          : "bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200"
                    } text-sm sm:text-base markdown-content`}
                    >
                      {msg.role === "user" ? (
                        msg.content
                      ) : (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          className={msg.role === "system" ? "markdown-system" : "markdown-assistant"}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-700 bg-white bg-opacity-90 backdrop-blur-sm rounded-xl p-8 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-center text-xl font-medium">Start a conversation!</p>
                <p className="text-center text-base mt-3">
                  {activeChapter ? "Ask questions about this chapter" : "Select a chapter or ask a general question"}
                </p>
              </div>
            )}
          </div>
          
          {/* Message Input */}
          <div className="border-t border-gray-300 bg-white bg-opacity-90 backdrop-blur-sm p-3 sm:p-4 shadow-lg">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={activeChapter ? "Ask about this chapter..." : "Type a message..."}
                  className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  disabled={isRecording || !activeChapter}
                />
                <button 
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-500 p-2 rounded-full focus:outline-none"
                  onClick={handleSendMessage}
                  disabled={isRecording || !message.trim() || !activeChapter}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </div>
              
              {/* Audio recording button */}
              {!isRecording ? (
                <button 
                  className={`${audioBlob ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-3 rounded-lg shadow-sm flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto ${!activeChapter ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={audioBlob ? sendAudioMessage : startRecording}
                  disabled={!activeChapter}
                >
                  {audioBlob ? (
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                      Send Audio
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <FaMicrophone className="mr-2" /> 
                      Voice
                    </span>
                  )}
                </button>
              ) : (
                <button 
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg shadow-sm flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  onClick={stopRecording}
                >
                  <FaStop className="mr-2" /> 
                  Stop Recording
                </button>
              )}
            </div>
            {!activeChapter && (
              <p className="mt-2 text-xs text-center text-red-500">
                Please select a chapter to start a conversation
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Logout Confirmation Dialog */}
      {showLogoutPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Logout</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex justify-end space-x-3">
              <button
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200"
                onClick={() => setShowLogoutPopup(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 border border-transparent rounded-lg text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                onClick={confirmLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification popup */}
      {notification.show && (
        <div className="fixed top-5 right-5 z-50 max-w-sm w-full bg-white rounded-xl shadow-lg p-4 border border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex">
              <div className={`flex-shrink-0 h-6 w-6 mr-3 ${
                notification.type === "success" ? "text-green-500" : 
                notification.type === "info" ? "text-blue-500" : "text-red-500"
              }`}>
                {notification.type === "success" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : notification.type === "info" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {notification.type === "success" ? "Success" : 
                   notification.type === "info" ? "Information" : "Error"}
                </p>
                <p className="mt-1 text-gray-600">{notification.message}</p>
              </div>
            </div>
            <button 
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
              onClick={() => setNotification({ ...notification, show: false })}
            >
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}