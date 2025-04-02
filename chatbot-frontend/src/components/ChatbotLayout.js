import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserEdit, FaSignOutAlt, FaBook, FaChevronDown, FaChevronRight, FaPlus, FaMicrophone, FaStop } from "react-icons/fa";
import axios from "axios";
import { API_ENDPOINTS } from "../config";

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

  const getUserId = () => localStorage.getItem("userId");
  const getToken = () => localStorage.getItem("token");

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
        setSubscribedBooks([]);
        setLoading(false);
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
      content: "🎤 Audio message sent" 
    }];
    setChatHistory(newChat);
    
    try {
      // Create form data to send the audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('userId', userId);
      if (activeChapter) {
        formData.append('chapterId', activeChapter);
      }
      
      // Send the audio file to the server
      const response = await axios.post(
        `${API_ENDPOINTS.CHAT}/send-audio`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      // Add the response to chat history
      setChatHistory([...newChat, { 
        role: "assistant", 
        content: response.data.response 
      }]);
    } catch (error) {
      console.error("Error sending audio message:", error);
      setChatHistory([...newChat, { 
        role: "system", 
        content: "Failed to process audio message. Please try again." 
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

  return (
    <div className="flex h-screen flex-col">
      <div className="w-full bg-blue-300 text-gray-900 p-4 flex justify-between items-center shadow-md">
        <div className="text-xl font-semibold">BookChat</div>
        {/* Removed the Collections button from here */}
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-gray-900 text-white p-4 flex flex-col overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">My Books</h2>
          {loading ? (
            <div className="text-gray-400">Loading books...</div>
          ) : subscribedBooks.length > 0 ? (
            <ul className="mb-4 overflow-y-auto">
              {subscribedBooks.map((sub) => (
                <li key={sub._id} className="mb-2">
                  <div className="flex items-center justify-between">
                    <span className="truncate flex-1">{sub.bookTitle}</span>
                    <button 
                      onClick={() => toggleBookExpansion(sub.bookId)}
                      className="p-1 hover:bg-gray-700 rounded"
                    >
                      {expandedBook === sub.bookId ? <FaChevronDown /> : <FaChevronRight />}
                    </button>
                  </div>
                  
                  {expandedBook === sub.bookId && (
                    <div className="pl-4 mt-1 border-l border-gray-700">
                      {bookChapters[sub.bookId] ? (
                        bookChapters[sub.bookId].length > 0 ? (
                          bookChapters[sub.bookId].map((chapter) => (
                            <div 
                              key={chapter._id} 
                              className={`text-sm py-1 cursor-pointer pl-2 ${
                                activeChapter === chapter._id 
                                  ? "bg-blue-700 text-white rounded" 
                                  : "hover:bg-gray-800"
                              }`}
                              onClick={() => handleChapterSelect(chapter)}
                            >
                              {chapter.title}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-400 py-1">No chapters available</div>
                        )
                      ) : (
                        <div className="text-sm text-gray-400 py-1">Loading chapters...</div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center">
              <p className="text-gray-400 mb-3">No subscribed books yet</p>
              <button 
                className="flex items-center bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md"
                onClick={() => navigate("/collections")}
              >
                <FaPlus className="mr-2" /> Add Books
              </button>
            </div>
          )}
          <div className="mt-auto flex flex-col space-y-2">
            <button className="flex items-center gap-2 bg-gray-800 p-2 rounded-md hover:bg-gray-700">
              <FaUserEdit /> Profile
            </button>
            <button
              className="flex items-center gap-2 bg-gray-800 p-2 rounded-md hover:bg-gray-700"
              onClick={() => navigate("/collections")}
            >
              <FaBook /> Collections
            </button>
            <button
              className="flex items-center gap-2 bg-red-600 p-2 rounded-md hover:bg-red-500"
              onClick={handleLogout}
            >
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>
        
        {/* Chat Area */}
        <div className="flex flex-col flex-1 bg-gray-100 overflow-hidden">
          {/* Current chapter indicator */}
          {activeChapter && (
            <div className="bg-blue-600 text-white p-2 px-4 flex justify-between items-center">
              <div>
                <span className="text-xs text-blue-200">Active Chapter:</span>
                <h3 className="font-medium">{currentChapterTitle}</h3>
              </div>
              <button 
                className="text-xs bg-blue-700 hover:bg-blue-800 px-2 py-1 rounded"
                onClick={clearActiveChapter}
              >
                Exit Chapter
              </button>
            </div>
          )}
          
          {/* Messages Container - Fixed height with scrolling */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            {Array.isArray(chatHistory) && chatHistory.length > 0 ? (
              chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`max-w-[70%] p-3 rounded-lg text-white shadow-md ${
                    msg.role === "user" 
                      ? "bg-blue-500 ml-auto text-right" 
                      : msg.role === "system" 
                        ? "bg-gray-500 mr-auto text-left" 
                        : "bg-gray-700 mr-auto text-left"
                  } mt-2`}
                >
                  {msg.content}
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center">
                {activeChapter 
                  ? "No messages yet for this chapter. Start a conversation!" 
                  : "No messages yet. Select a chapter to start a conversation."}
              </p>
            )}
            <div ref={chatEndRef} />
            {children}
          </div>
          
          {/* Message Input */}
          <div className="w-full bg-white p-3 border-t border-gray-300 flex items-center">
            <input
              type="text"
              placeholder={activeChapter ? "Ask about this chapter..." : "Type a message..."}
              className="flex-1 p-2 border rounded-lg outline-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isRecording}
            />
            
            {/* Audio recording buttons */}
            {!isRecording ? (
              <button 
                className={`ml-2 ${audioBlob ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'} text-white px-4 py-2 rounded-lg flex items-center`}
                onClick={audioBlob ? sendAudioMessage : startRecording}
              >
                {audioBlob ? (
                  <>Send Audio</>
                ) : (
                  <>
                    <FaMicrophone className="mr-1" /> 
                    Voice
                  </>
                )}
              </button>
            ) : (
              <button 
                className="ml-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center"
                onClick={stopRecording}
              >
                <FaStop className="mr-1" /> 
                Stop
              </button>
            )}
            
            {/* Text message send button */}
            <button 
              className="ml-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              onClick={handleSendMessage}
              disabled={isRecording}
            >
              Send
            </button>
          </div>
        </div>
      </div>
      
      {/* Logout Confirmation Dialog */}
      {showLogoutPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <p className="text-lg font-semibold">Are you sure you want to log out?</p>
            <div className="flex justify-end mt-4 space-x-2">
              <button className="bg-gray-300 px-4 py-2 rounded-lg hover:bg-gray-400" onClick={() => setShowLogoutPopup(false)}>
                Cancel
              </button>
              <button className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600" onClick={confirmLogout}>
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}