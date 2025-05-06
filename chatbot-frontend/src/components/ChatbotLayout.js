import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserEdit, FaSignOutAlt, FaBook, FaChevronDown, FaChevronRight, FaPlus, FaMicrophone, FaStop, FaTimes, FaBell } from "react-icons/fa";
import axios from "axios";
import { API_ENDPOINTS } from "../config";
import { updateLastActivity, isAuthenticated } from "../utils/auth"; // Import auth utilities
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import bookLogo from '../book-logo1.jpeg';
import SubscribedBooksView from "./SubscribedBooksView"; // Import the new component

export default function ChatbotLayout({ children }) {
  const [subscribedBooks, setSubscribedBooks] = useState([]);
  const [publisherBooks, setPublisherBooks] = useState([]);
  const [expandedBook, setExpandedBook] = useState(null);
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [bookChapters, setBookChapters] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeChapter, setActiveChapter] = useState(null);
  const [currentChapterTitle, setCurrentChapterTitle] = useState("");
  const [currentBookId, setCurrentBookId] = useState(null);
  const [currentBookCover, setCurrentBookCover] = useState("");
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const carouselRef = useRef(null);
  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false); // New state to track message processing
  const [audioModeEnabled, setAudioModeEnabled] = useState(false); // New state for audio mode toggle
  const [audioMessages, setAudioMessages] = useState({}); // Store audio blobs by message ID
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [notification, setNotification] = useState({ show: false, type: "", message: "" });

  // Notification states
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);

  // Add state for current notification popup
  const [currentNotification, setCurrentNotification] = useState(null);
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  
  // Add state for chapter score
  const [chapterScore, setChapterScore] = useState(null);
  const [showScorePopup, setShowScorePopup] = useState(false);
  const scorePopupTimeoutRef = useRef(null);

  const getUserId = () => localStorage.getItem("userId");
  const getToken = () => localStorage.getItem("token");

  // Update activity timestamp on component mount and check for notifications
  useEffect(() => {
    if (isAuthenticated()) {
      updateLastActivity();
      
      // Fetch user notifications and first unseen notification on login
      fetchUserNotifications();
      
      // Only attempt to show notification popup if not shown already in this session
      if (!sessionStorage.getItem('notificationShown')) {
        fetchFirstUnseenNotification();
      }
    } else {
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
        // Log the structure of each subscription to check for bookCoverImgLink
        if (response.data && response.data.length > 0) {
          console.log("First subscription details:", {
            _id: response.data[0]._id,
            bookId: response.data[0].bookId,
            bookTitle: response.data[0].bookTitle,
            bookCoverImgLink: response.data[0].bookCoverImgLink
          });
        }
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

  // Fetch publisher books for the carousel
  useEffect(() => {
    const fetchPublisherBooks = async () => {
      const token = getToken();
      if (!token) return;
      
      try {
        // First get user data to determine publisher
        const userResponse = await axios.get(API_ENDPOINTS.GET_USER, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const userPublisher = userResponse.data.publisher;
        
        // PUBLISHER FILTER TEMPORARILY DISABLED - Fetch all books instead
        // To re-enable filtering, uncomment the code below and comment out the unfiltered request
        
        /*
        if (!userPublisher) {
          console.log("User has no publisher preference set");
          return;
        }
        
        // Then fetch books filtered by this publisher
        const booksResponse = await axios.get(`${API_ENDPOINTS.GET_BOOKS}?publisher=${userPublisher}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        */
        
        // Unfiltered request - remove this block when re-enabling publisher filtering
        const booksResponse = await axios.get(API_ENDPOINTS.GET_BOOKS, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setPublisherBooks(booksResponse.data);
        console.log(`Fetched ${booksResponse.data.length} books for carousel display`);
      } catch (error) {
        console.error("Error fetching publisher books:", error);
      }
    };
    
    fetchPublisherBooks();
  }, []);

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
      
      // Extract the chapterId string if it's an object
      const chapterIdString = typeof chapterId === 'object' && chapterId.chapterId 
        ? chapterId.chapterId 
        : chapterId;
        
      console.log(`Fetching chat history for chapter: ${chapterIdString}`);
      
      const response = await axios.get(API_ENDPOINTS.GET_CHAPTER_HISTORY.replace(':chapterId', chapterIdString), {
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

      // Fetch the chapter score when loading chat history
      fetchChapterScore(chapterId);
      
    } catch (error) {
      console.error("Error fetching chapter chat history:", error);
      setChatHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Add function to fetch chapter score
  const fetchChapterScore = async (chapterId) => {
    const userId = getUserId();
    const token = getToken();
    
    if (!userId || !token || !chapterId) {
      return;
    }
    
    // Extract the chapterId string if it's an object
    const chapterIdString = typeof chapterId === 'object' && chapterId.chapterId 
      ? chapterId.chapterId 
      : chapterId;
    
    try {
      const response = await axios.get(API_ENDPOINTS.GET_CHAPTER_STATS.replace(':chapterId', chapterIdString), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'user-id': userId
        }
      });
      
      console.log("Chapter Score Response:", response.data);
      
      // Only show score if there are stats available
      if (response.data.hasStats) {
        setChapterScore(response.data);
        
        // Show score popup with timeout to hide it
        setShowScorePopup(true);
        
        // Clear any existing timeout
        if (scorePopupTimeoutRef.current) {
          clearTimeout(scorePopupTimeoutRef.current);
        }
        
        // Set timeout to hide the popup after 5 seconds
        scorePopupTimeoutRef.current = setTimeout(() => {
          setShowScorePopup(false);
        }, 5000);
      } else {
        // If no stats, clear the score and don't show popup
        setChapterScore(null);
        setShowScorePopup(false);
      }
    } catch (error) {
      console.error("Error fetching chapter score:", error);
      setChapterScore(null);
      setShowScorePopup(false);
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

  // Function to handle chapter selection
  const handleChapterSelect = async (bookId, chapterId, chapterTitle) => {
    try {
      setCurrentChapterTitle(chapterTitle);
      setActiveChapter({ bookId, chapterId });
      setCurrentBookId(bookId);
      setExpandedBook(bookId); // Expand the book in sidebar
      setLoading(true);
      
      // Find the book in subscribed books to get its cover image
      const book = subscribedBooks.find(b => b.bookId === bookId);
      if (book && book.bookCoverImgLink) {
        setCurrentBookCover(book.bookCoverImgLink);
      }
      
      // If chapters for this book aren't loaded yet, fetch them
      if (!bookChapters[bookId]) {
        await fetchBookChapters(bookId);
      }
      
      console.log(`Fetching chat history for chapter: ${chapterId}`);
      
      // Fetch chat history for this chapter with retry logic
      const fetchHistoryWithRetry = async (retries = 3) => {
        try {
          const response = await axios.get(API_ENDPOINTS.GET_CHAPTER_HISTORY.replace(':chapterId', chapterId), {
            headers: {
              'Authorization': `Bearer ${getToken()}`,
              'user-id': getUserId()
            }
          });
          
          console.log(`Received ${response.data?.length || 0} messages for chapter ${chapterId}`);
          
          if (response.data && Array.isArray(response.data)) {
            if (response.data.length > 0) {
              // Use existing chat history if available
              setChatHistory(response.data);
              console.log("Chat history loaded successfully");
            } else {
              // If empty array returned, show welcome message
              setChatHistory([{
                role: 'system',
                content: `Welcome to chapter "${chapterTitle}". Click the "Start Test" button below to begin.`
              }]);
              console.log("No chat history found, showing welcome message");
            }
            return true;
          }
          return false;
        } catch (error) {
          console.error(`Error fetching chat history (attempt ${4-retries}/3):`, error);
          if (retries > 1) {
            // Wait a moment before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            return fetchHistoryWithRetry(retries - 1);
          }
          return false;
        }
      };
      
      const historyFetched = await fetchHistoryWithRetry();
      
      if (!historyFetched) {
        // If all retries failed, show welcome message
        setChatHistory([{
          role: 'system',
          content: `Welcome to chapter "${chapterTitle}". Click the "Start Test" button below to begin.`
        }]);
        console.log("Failed to fetch chat history after retries, showing welcome message");
      }

      // Scroll to bottom of chat
      setTimeout(() => {
        if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (error) {
      console.error("Error handling chapter selection:", error);
      // Add welcome message for empty chat
      setChatHistory([{
        role: 'system',
        content: `Welcome to chapter "${chapterTitle}". Click the "Start Test" button below to begin.`
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Function to clean response messages (remove LaTeX formatting)
  const cleanMessageContent = (content) => {
    if (!content) return '';
    
    // Replace LaTeX formulas with more readable versions
    let cleanedContent = content
      // Replace \text{...} with just the text inside
      .replace(/\\text\{([^}]+)\}/g, '$1')
      
      // Replace \frac{a}{b} with a/b
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
      
      // Replace [ ... ] LaTeX display math mode with italicized content
      // More aggressive replacement for square bracket LaTeX notation
      .replace(/\[\s*\\text\{([^}]+)\}\s*=\s*\\frac\{([^}]+)\}\{([^}]+)\}\s*\]/g, '*$1 = $2/$3*')
      .replace(/\[\s*([^\]]+)\s*\]/g, '*$1*')
      
      // Other LaTeX commands to clean up
      .replace(/\\cdot/g, '·')
      .replace(/\\times/g, '×')
      .replace(/\\div/g, '÷')
      .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
      .replace(/\\mathbf\{([^}]+)\}/g, '**$1**')
      .replace(/\\mathit\{([^}]+)\}/g, '*$1*')
      .replace(/\\mathbb\{([^}]+)\}/g, '$1')
      .replace(/\\mathrm\{([^}]+)\}/g, '$1')
      
      // More complex LaTeX expressions - convert to simpler notation
      .replace(/\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g, '\n\n$1\n\n')
      .replace(/\\begin\{align\}([\s\S]*?)\\end\{align\}/g, '\n\n$1\n\n')
      .replace(/\\left/g, '')
      .replace(/\\right/g, '')
      
      // Common LaTeX symbols
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\gamma/g, 'γ')
      .replace(/\\delta/g, 'δ')
      .replace(/\\epsilon/g, 'ε')
      .replace(/\\theta/g, 'θ')
      .replace(/\\lambda/g, 'λ')
      .replace(/\\omega/g, 'ω')
      .replace(/\\pi/g, 'π')
      .replace(/\\sigma/g, 'σ')
      .replace(/\\sum/g, '∑')
      .replace(/\\infty/g, '∞')
      .replace(/\\neq/g, '≠')
      .replace(/\\approx/g, '≈')
      .replace(/\\geq/g, '≥')
      .replace(/\\leq/g, '≤');
      
    // Do a final pass to remove any remaining square bracket LaTeX that wasn't caught
    cleanedContent = cleanedContent.replace(/\[\s*\\[^\]]+\]/g, '*formula*');
      
    return cleanedContent;
  };

  // Update the handleSendMessage function to clean AI responses
  const handleSendMessage = async () => {
    if (!message.trim() && !audioBlob) return;
    
    const userMessage = message.trim();
    setMessage("");
    setAudioBlob(null);
    
    if (!activeChapter) {
      setNotification({
        show: true,
        type: "error",
        message: "Please select a chapter to start a conversation"
      });
      
      setTimeout(() => {
        setNotification({ show: false, type: "", message: "" });
      }, 3000);
      
      return;
    }

    updateLastActivity();
    setIsProcessing(true);

    // Add user message to chat immediately
    const userMessageObj = { role: "user", content: userMessage || "[Audio Message]" };
    setChatHistory(prev => [...prev, userMessageObj]);

    try {
      const userId = getUserId();
      const token = getToken();
      
      if (!userId || !token) {
        navigate("/login");
        return;
      }
      
      const endpoint = audioBlob ? API_ENDPOINTS.TRANSCRIBE_AUDIO : API_ENDPOINTS.CHAT;
      
      // Extract the chapterId string from the activeChapter object
      const chapterId = typeof activeChapter === 'object' && activeChapter.chapterId 
        ? activeChapter.chapterId 
        : activeChapter;
      
      // Set up the request data based on whether this is audio or text
      let requestData;
      let requestConfig = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };
      
      if (audioBlob) {
        // For audio, we need to use FormData
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('userId', userId);
        formData.append('chapterId', chapterId);
        
        requestData = formData;
        requestConfig = {
          headers: {
            'Authorization': `Bearer ${token}`
            // Content-Type is automatically set by browser for FormData
          }
        };
      } else {
        // For text messages
        requestData = {
          userId,
          message: userMessage,
          chapterId
        };
      }
      
      // Make the request
      const response = await axios.post(endpoint, requestData, requestConfig);
      
      // Handle audio transcription redirecting to chat
      if (audioBlob && response.data.redirect) {
        console.log("Audio transcribed, sending to chat API:", response.data.transcription);
        
        // Update chat with transcription
        const updatedUserMessage = { role: "user", content: response.data.transcription };
        setChatHistory(prev => {
          // Remove the last "[Audio Message]" and replace with actual transcript
          const newHistory = [...prev];
          newHistory.pop();
          return [...newHistory, updatedUserMessage];
        });
        
        // Now send the transcribed message to chat
        const chatResponse = await axios.post(API_ENDPOINTS.CHAT, {
          userId,
          message: response.data.transcription,
          chapterId
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        // Check if there's score information and append it to the message
        let botContent = chatResponse.data.message;
        
        // Add score information if present
        if (chatResponse.data.score && chatResponse.data.score.marksAwarded !== null) {
          const scoreInfo = `\n\n**Score: ${chatResponse.data.score.marksAwarded}/${chatResponse.data.score.maxMarks}**`;
          botContent += scoreInfo;
        }
        
        // Handle the chat response
        const botResponse = { role: "assistant", content: botContent };
        setChatHistory(prev => [...prev, botResponse]);
      } else if (!audioBlob) {
        // For text messages, process the response directly
        
        // Check if there's score information and append it to the message
        let botContent = response.data.message;
        
        // Add score information if present
        if (response.data.score && response.data.score.marksAwarded !== null) {
          const scoreInfo = `\n\n**Score: ${response.data.score.marksAwarded}/${response.data.score.maxMarks}**`;
          botContent += scoreInfo;
        }
        
        const botResponse = { role: "assistant", content: botContent };
        setChatHistory(prev => [...prev, botResponse]);
      }
      
      // After receiving response, fetch the updated chapter score
      if (activeChapter) {
        fetchChapterScore(chapterId);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Handle error...
      const errorMessage = {
        role: "assistant",
        content: "I'm sorry, I'm having trouble processing your message right now. Please try again later."
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Update the Let's Start button to use the cleanMessageContent function
  const processStartTestResponse = (response) => {
    console.log("Start Test response:", response.data);
                                
    // Check for message field in response (new format)
    if (response.data && response.data.message) {
      // Clean up the message content
      let cleanedContent = cleanMessageContent(response.data.message);
      
      // Add score information if present
      if (response.data.score && response.data.score.marksAwarded !== null) {
        const scoreInfo = `\n\n**Score: ${response.data.score.marksAwarded}/${response.data.score.maxMarks}**`;
        cleanedContent += scoreInfo;
      }
      
      const aiResponse = { 
        role: "assistant", 
        content: cleanedContent 
      };
      setChatHistory(prevHistory => [...prevHistory, aiResponse]);
    }
    // Fallback for legacy response format
    else if (response.data && response.data.response) {
      // Clean up the message content
      let cleanedContent = cleanMessageContent(response.data.response);
      
      // Add score information if present
      if (response.data.score && response.data.score.marksAwarded !== null) {
        const scoreInfo = `\n\n**Score: ${response.data.score.marksAwarded}/${response.data.score.maxMarks}**`;
        cleanedContent += scoreInfo;
      }
      
      const aiResponse = { 
        role: "assistant", 
        content: cleanedContent 
      };
      setChatHistory(prevHistory => [...prevHistory, aiResponse]);
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
        
        // Save a reference to the audioBlob before resetting
        const audioBlobCopy = audioBlob;
        
        // Reset the audioBlob state immediately
        setAudioBlob(null);
        
        // Release the microphone
        stream.getTracks().forEach(track => track.stop());
        
        // Automatically send the audio message with the copied blob
        setTimeout(() => {
          // Create a unique message ID for this audio message
          const messageId = `audio-${Date.now()}`;
          
          // Store audio blob for later playback
          setAudioMessages(prev => ({
            ...prev,
            [messageId]: URL.createObjectURL(audioBlobCopy)
          }));
          
          // Create message indicating audio is being processed
          const newChat = [...chatHistory, { 
            role: "user", 
            content: "🎤 Processing audio message...",
            messageId: messageId,
            isAudio: true
          }];
          setChatHistory(newChat);
          
          // Start processing the audio
          processAudioMessage(audioBlobCopy, messageId, newChat);
        }, 100);
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
      // The audio will be sent automatically by the onstop handler
    }
  };
  
  // Clear active chapter
  const clearActiveChapter = async () => {
    setActiveChapter(null);
    setCurrentChapterTitle("");
    setCurrentBookId(null);
    setCurrentBookCover("");
    
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
    
    // Clear the notification session flag so notifications will show on next login
    sessionStorage.removeItem('notificationShown');
    
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
            chapter => chapter._id === activeChapter.chapterId
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

  // Handle book cover image error
  const handleBookCoverError = () => {
    console.error(`Failed to load book cover image: ${currentBookCover}`);
    // Use a fallback gradient instead
    setCurrentBookCover("");
  };

  // Fetch all user notifications
  const fetchUserNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(API_ENDPOINTS.GET_NOTIFICATIONS, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (Array.isArray(response.data)) {
        setNotifications(response.data);
        const unreadNotifications = response.data.filter(notif => notif.seen_status === "no");
        setUnreadCount(unreadNotifications.length);
        console.log(`Fetched ${response.data.length} notifications (${unreadNotifications.length} unread)`);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  // Fetch first unseen notification
  const fetchFirstUnseenNotification = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(API_ENDPOINTS.GET_FIRST_UNSEEN, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data) {
        // Show the notification popup
        console.log("Found unseen notification to display:", response.data);
        setShowNotificationPopup(true);
        setCurrentNotification(response.data);
        
        // Mark that we've shown a notification this session
        sessionStorage.setItem('notificationShown', 'true');
      } else {
        console.log("No unseen notifications found");
      }
    } catch (error) {
      // If 404, it means there are no unseen notifications
      if (error.response && error.response.status === 404) {
        console.log("No unseen notifications to display");
      } else {
        console.error("Error fetching unseen notification:", error);
      }
    }
  };

  // Mark notification as seen
  const markNotificationAsSeen = async (notificationId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      await axios.put(
        API_ENDPOINTS.MARK_NOTIFICATION_SEEN.replace(':notificationId', notificationId),
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      // Update local state
      setNotifications(prevNotifications => 
        prevNotifications.map(notif => 
          notif._id === notificationId ? { ...notif, seen_status: 'yes' } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as seen:", error);
    }
  };

  // Toggle notifications panel
  const toggleNotificationsPanel = () => {
    setShowNotifications(!showNotifications);
  };

  // Handle notification popup confirmation
  const handleNotificationConfirm = () => {
    if (currentNotification && currentNotification._id) {
      markNotificationAsSeen(currentNotification._id);
      setShowNotificationPopup(false);
      setCurrentNotification(null);
    }
  };

  // For development: Seed test notifications
  const seedTestNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // First, close the notifications panel if it's open
      setShowNotifications(false);
      
      // Show loading notification
      setNotification({
        show: true,
        type: "info",
        message: "Adding test notifications..."
      });

      // Call the backend endpoint to create notifications
      const response = await axios.post(
        API_ENDPOINTS.SEED_NOTIFICATIONS,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log("Test notifications added:", response.data);
      
      // Clear the notifications seen flag so they show up immediately
      sessionStorage.removeItem('notificationShown');
      
      // Refresh notifications data
      await fetchUserNotifications();
      
      // Also show the first unseen notification
      await fetchFirstUnseenNotification();
      
      // Show success message
      setNotification({
        show: true,
        type: "success",
        message: `Added ${response.data.count || 4} test notifications successfully!`
      });
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setNotification({ show: false });
      }, 3000);
      
    } catch (error) {
      console.error("Error seeding test notifications:", error);
      setNotification({
        show: true,
        type: "error",
        message: "Failed to add test notifications: " + (error.response?.data?.error || error.message)
      });
      
      setTimeout(() => {
        setNotification({ show: false });
      }, 3000);
    }
  };

  // Add this function to handle notification clicks
  const markNotificationAsRead = (id) => {
    setNotifications(notifications.map(notification => 
      notification.id === id ? { ...notification, read: true } : notification
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Add click outside handler for notifications
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Format timestamp to readable format
  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - new Date(timestamp);
    
    // Less than a minute
    if (diff < 60000) {
      return 'Just now';
    }
    
    // Less than an hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    // Format as date for older notifications
    return new Date(timestamp).toLocaleDateString();
  };

  // Mark all notifications as read
  const markAllNotificationsAsSeen = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // Since there's no specific endpoint for marking all as seen in the backend yet,
      // we'll implement a workaround by marking each unseen notification individually
      const unseenNotifications = notifications.filter(notif => notif.seen_status === 'no');
      
      if (unseenNotifications.length === 0) {
        return; // No unseen notifications to mark
      }
      
      // Create promises for each notification update
      const markPromises = unseenNotifications.map(notif => 
        axios.put(
          API_ENDPOINTS.MARK_NOTIFICATION_SEEN.replace(':notificationId', notif._id),
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        )
      );
      
      // Execute all promises
      await Promise.all(markPromises);
      console.log(`Marked ${unseenNotifications.length} notifications as seen`);

      // Update local state
      setNotifications(prevNotifications => 
        prevNotifications.map(notif => ({ ...notif, seen_status: 'yes' }))
      );
      setUnreadCount(0);
      
      // Close notifications panel
      setShowNotifications(false);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  // Add a useEffect to preload the background image
  useEffect(() => {
    // Preload the background image
    const img = new Image();
    img.src = `${process.env.PUBLIC_URL}/images/chat-background.jpg`;
    img.onload = () => {
      console.log('Background image successfully loaded');
    };
    img.onerror = (error) => {
      console.error('Failed to load background image', error);
    };
  }, []);

  // Inline styles for background patterns - with fallback to gradient
  const chatBackgroundStyle = {
    backgroundImage: `url('${process.env.PUBLIC_URL}/images/chat-background.jpg')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    position: 'relative',
    zIndex: 0
  };

  // Add this function to fetch chapters for a book and return them
  const fetchBookChaptersData = async (bookId) => {
    const token = getToken();
    if (!token) return [];
    
    try {
      // Use direct axios call without updating state immediately
      const response = await axios.get(API_ENDPOINTS.GET_BOOK_CHAPTERS.replace(':bookId', bookId), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      return response.data || [];
    } catch (error) {
      console.error("Error fetching chapters data:", error);
      return [];
    }
  };

  // Add cleanup function for audio URLs on component unmount
  useEffect(() => {
    return () => {
      // Revoke all object URLs to prevent memory leaks
      Object.values(audioMessages).forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [audioMessages]);

  // Save audio messages to localStorage when they're created or updated
  useEffect(() => {
    // Create a serializable version of the audio messages
    const serializedAudioMessages = {};
    Object.entries(audioMessages).forEach(([id, url]) => {
      // We can't store blob URLs, so just store a flag that audio exists
      serializedAudioMessages[id] = true;
    });
    
    // Save to localStorage if we have any audio messages
    if (Object.keys(serializedAudioMessages).length > 0) {
      localStorage.setItem('audioMessagesInfo', JSON.stringify(serializedAudioMessages));
    }
  }, [audioMessages]);

  // Load audio message info from localStorage on component mount
  useEffect(() => {
    const savedAudioInfo = localStorage.getItem('audioMessagesInfo');
    if (savedAudioInfo) {
      try {
        const audioInfo = JSON.parse(savedAudioInfo);
        console.log("Found saved audio message info:", audioInfo);
        
        // Update chat history to mark messages as audio messages
        setChatHistory(prev => 
          prev.map(msg => {
            // If this message ID is in the saved audio info, mark it as an audio message
            if (msg.messageId && audioInfo[msg.messageId]) {
              return { ...msg, isAudio: true };
            }
            return msg;
          })
        );
      } catch (e) {
        console.error("Error parsing saved audio info:", e);
      }
    }
  }, []);

  // Process audio message and send for transcription
  const processAudioMessage = async (audioBlobCopy, messageId, newChat) => {
    try {
      const userId = getUserId();
      const token = getToken();
      if (!userId || !token) return;
      
      // Set processing state to true
      setIsProcessing(true);
      
      // Create form data to send the audio file for transcription
      const formData = new FormData();
      formData.append('audio', audioBlobCopy, 'recording.webm');
      
      // Extract the chapterId string from the activeChapter object
      const chapterId = typeof activeChapter === 'object' && activeChapter.chapterId 
        ? activeChapter.chapterId 
        : activeChapter;
      
      formData.append('userId', userId);
      formData.append('chapterId', chapterId || '');
      
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
      
      // Handle audio transcription redirecting to chat
      if (transcriptionResponse.data.redirect) {
        console.log("Audio transcribed, sending to chat API:", transcriptionResponse.data.transcription);
        
        // Update chat with transcription
        const updatedUserMessage = { 
          role: "user", 
          content: transcriptionResponse.data.transcription,
          messageId: messageId,
          isAudio: true
        };
        
        setChatHistory(prev => {
          // Remove the last "[Audio Message]" and replace with actual transcript
          const newHistory = [...prev];
          newHistory.pop();
          return [...newHistory, updatedUserMessage];
        });
        
        // Now send the transcribed message to chat
        const chatResponse = await axios.post(API_ENDPOINTS.CHAT, {
          userId,
          message: transcriptionResponse.data.transcription,
          chapterId
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        // Check if there's score information and append it to the message
        let botContent = chatResponse.data.message;
        
        // Add score information if present
        if (chatResponse.data.score && chatResponse.data.score.marksAwarded !== null) {
          const scoreInfo = `\n\n**Score: ${chatResponse.data.score.marksAwarded}/${chatResponse.data.score.maxMarks}**`;
          botContent += scoreInfo;
        }
        
        // Handle the chat response
        const botResponse = { role: "assistant", content: botContent };
        setChatHistory(prev => [...prev, botResponse]);
      }
    } catch (error) {
      console.error("Error processing audio message:", error);
      
      // Check if it's a transcription error or a chat API error
      const errorMessage = error.response?.data?.error || "Failed to process audio message. Please try again.";
      setChatHistory([...newChat.slice(0, -1), { 
        role: "user", 
        content: "🎤 Audio message (Transcription failed)",
        messageId: messageId,
        isAudio: true
      }, {
        role: "system", 
        content: errorMessage
      }]);
    } finally {
      // Set processing state back to false
      setIsProcessing(false);
    }
  };

  return (
    <>
      <style>
        {`
          /* Toggle switch styles */
          .toggle-checkbox {
            transition: .3s;
            z-index: 1;
            position: absolute;
            left: 0;
          }
          
          .toggle-checkbox:checked {
            transform: translateX(100%);
            border-color: #3B82F6;
          }
          
          .toggle-label {
            transition: .3s;
          }
        `}
      </style>
      <div className="flex h-screen flex-col bg-gray-50">
        {/* Hidden image to preload and validate book cover */}
        {currentBookCover && (
          <img 
            src={currentBookCover}
            alt=""
            className="hidden"
            onError={handleBookCoverError}
          />
        )}
      
        <div className="w-full bg-white text-gray-800 p-2 sm:p-3 flex justify-between items-center shadow-sm border-b border-gray-100">
          <div className="flex items-center space-x-4">
            <div className="flex flex-col items-center bg-blue-50 px-3 py-3 rounded-lg">
              <img 
                src={bookLogo}
                alt="Book Logo" 
                className="h-12 w-auto object-contain rounded mb-1"
                onError={(e) => {
                  console.error("Failed to load book logo");
                  e.target.onerror = null;
                  e.target.src = `${process.env.PUBLIC_URL}/images/testyourlearning-logo.svg`;
                }}
              />
              <span className="text-sm font-bold tracking-wide text-gray-800">TestYourLearning</span>
            </div>
          </div>
          
          {/* Carousel of book covers - updated to match image style */}
          <div className="hidden md:block flex-1 mx-8 overflow-hidden carousel-container">
            <h2 className="text-xl font-bold text-center text-blue-500 mb-2">Your Educational Resources</h2>
            <div className="h-48 overflow-hidden">
              {publisherBooks.length > 0 && (
                <div 
                  ref={carouselRef}
                  className="whitespace-nowrap animate-slider h-full"
                  style={{
                    animationDuration: `${Math.max(40, publisherBooks.length * 8)}s`,
                    animationTimingFunction: 'linear',
                    animationIterationCount: 'infinite',
                    animationDelay: '-2s' // Start with content slightly moved in
                  }}
                >
                  {/* Duplicate the books to create seamless looping */}
                  {[...publisherBooks, ...publisherBooks].map((book, index) => (
                    <div 
                      key={`${book._id}-${index}`} 
                      className="inline-block mx-8 rounded-xl overflow-hidden shadow-sm hover:scale-105 transition-transform duration-200 cursor-pointer text-center align-top bg-white border border-gray-100"
                      title={book.title}
                      onClick={() => window.open(`/collections?bookId=${book._id}`, '_blank')}
                      style={{ width: '160px' }}
                    >
                      <div className="flex flex-col items-center p-2">
                        <div className="h-24 w-24 mb-2 bg-blue-50 rounded-lg p-2 flex items-center justify-center">
                          <img 
                            src={book.bookCoverImgLink} 
                            alt={book.title}
                            className="h-full object-contain"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22150%22%20viewBox%3D%220%200%20100%20150%22%3E%3Crect%20fill%3D%22%233B82F6%22%20width%3D%22100%22%20height%3D%22150%22%2F%3E%3Ctext%20fill%3D%22%23FFFFFF%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2210%22%20text-anchor%3D%22middle%22%20x%3D%2250%22%20y%3D%2275%22%3EBook%3C%2Ftext%3E%3C%2Fsvg%3E";
                            }}
                          />
                        </div>
                        <h3 className="text-base font-medium text-center text-blue-500 uppercase tracking-wide mb-1">
                          {book.title.split(' ').slice(0, 2).join(' ')}
                        </h3>
                        <p className="text-xs text-gray-600 line-clamp-2 w-full">
                          {book.title.length > 40 ? book.title.substring(0, 40) + "..." : book.title}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {publisherBooks.length === 0 && (
                <div className="flex justify-center h-full">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-2">
                      <FaBook className="text-blue-500 text-2xl" />
                    </div>
                    <h3 className="text-base font-medium text-blue-500 mb-1">No Books Available</h3>
                    <p className="text-xs text-gray-600 text-center max-w-md">
                      Visit collections to find books
                    </p>
                    <button 
                      onClick={() => navigate("/collections")}
                      className="mt-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs"
                    >
                      Browse Collections
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center">
            {/* Container for notification elements - reorganized for mobile */}
            <div className="hidden sm:flex items-center space-x-4">
              {/* Notifications Button for desktop */}
              <div className="relative" ref={notificationRef}>
                <button 
                  className={`p-1.5 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors duration-200 focus:outline-none ${unreadCount > 0 ? 'notification-bell-blink' : ''}`}
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label="Notifications"
                >
                  <FaBell className="h-4 w-4 text-blue-500" />
                  {unreadCount > 0 && (
                    <span className="notification-badge">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                
                {/* Notifications Panel */}
                {showNotifications && (
                  <div 
                    className="notification-panel bg-white rounded-lg shadow-md border border-gray-100" 
                    style={{ 
                      width: '350px',
                      maxWidth: 'calc(100vw - 40px)',
                      position: 'absolute',
                      top: '45px',
                      right: '0',
                      left: 'auto',
                      zIndex: 1000,
                      overflowY: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center sticky top-0">
                      <h3 className="font-medium text-gray-800">Notifications</h3>
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllNotificationsAsSeen}
                          className="text-xs text-blue-500 hover:text-blue-600"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No notifications</div>
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto overflow-x-hidden">
                        {notifications.map((notification, index) => (
                          <div 
                            key={index}
                            className={`p-3 border-b border-gray-100 flex ${notification.seen_status === 'yes' ? 'bg-white' : 'bg-blue-50'} hover:bg-gray-50`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-gray-800 truncate">{notification.title}</div>
                              <div className="text-sm text-gray-600 line-clamp-2">{notification.message}</div>
                              <div className="text-xs text-gray-400 mt-1">{formatTimestamp(notification.createdAt)}</div>
                            </div>
                            {notification.seen_status === 'no' && (
                              <button 
                                onClick={() => markNotificationAsSeen(notification._id)}
                                className="text-xs text-blue-500 hover:text-blue-600 ml-2 flex-shrink-0 self-start mt-1"
                              >
                                Mark as read
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Test Notifications button for desktop */}
              <button
                onClick={seedTestNotifications}
                className="bg-blue-50 hover:bg-blue-100 text-blue-500 text-xs px-2 py-1 rounded-md shadow-sm transition-colors duration-200"
                title="Add test notifications for this user"
              >
                Test Notifications
              </button>
            </div>
            
            {/* Mobile only notification components */}
            <div className="sm:hidden flex flex-col items-end mr-4">
              {/* Notification button for mobile */}
              <div className="relative" ref={notificationRef}>
                <button 
                  className={`p-1.5 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors duration-200 focus:outline-none ${unreadCount > 0 ? 'notification-bell-blink' : ''}`}
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label="Notifications"
                >
                  <FaBell className="h-4 w-4 text-blue-500" />
                  {unreadCount > 0 && (
                    <span className="notification-badge">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                
                {/* Notifications Panel for mobile */}
                {showNotifications && (
                  <div 
                    className="notification-panel bg-white rounded-lg shadow-md border border-gray-100" 
                    style={{ 
                      width: '300px',
                      maxWidth: 'calc(100vw - 40px)',
                      position: 'absolute',
                      top: '75px',
                      right: '0',
                      left: 'auto',
                      zIndex: 1000,
                      overflowY: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center sticky top-0">
                      <h3 className="font-medium text-gray-800">Notifications</h3>
                      {unreadCount > 0 && (
                        <button 
                          onClick={markAllNotificationsAsSeen}
                          className="text-xs text-blue-500 hover:text-blue-600"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No notifications</div>
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto overflow-x-hidden">
                        {notifications.map((notification, index) => (
                          <div 
                            key={index}
                            className={`p-3 border-b border-gray-100 flex ${notification.seen_status === 'yes' ? 'bg-white' : 'bg-blue-50'} hover:bg-gray-50`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-gray-800 truncate">{notification.title}</div>
                              <div className="text-sm text-gray-600 line-clamp-2">{notification.message}</div>
                              <div className="text-xs text-gray-400 mt-1">{formatTimestamp(notification.createdAt)}</div>
                            </div>
                            {notification.seen_status === 'no' && (
                              <button 
                                onClick={() => markNotificationAsSeen(notification._id)}
                                className="text-xs text-blue-500 hover:text-blue-600 ml-2 flex-shrink-0 self-start mt-1"
                              >
                                Mark as read
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Test Notifications button for mobile - below the notification bell */}
              <button
                onClick={seedTestNotifications}
                className="bg-blue-50 hover:bg-blue-100 text-blue-500 text-xs px-2 py-1 rounded-md shadow-sm transition-colors duration-200 mt-2"
                title="Add test notifications for this user"
              >
                Test Notifications
              </button>
            </div>
            
            {/* Mobile menu toggle button */}
            <button 
              className="lg:hidden flex items-center justify-center p-1.5 rounded-md text-gray-600 hover:bg-gray-100 transition-colors duration-200 focus:outline-none"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden relative w-full">
          {/* Sidebar overlay for mobile - only shows when sidebar is open */}
          {isSidebarOpen && (
            <div 
              className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-10"
              onClick={() => setIsSidebarOpen(false)}
              aria-hidden="true"
            ></div>
          )}
          
          {/* Sidebar */}
          <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transform transition-transform duration-300 ease-in-out lg:w-72 w-3/4 max-w-sm bg-white text-gray-800 fixed lg:static z-20 h-full overflow-y-auto shadow-sm flex flex-col flex-shrink-0 border-r border-gray-100`}>
            <div className="p-4 flex-1">
              <div className="flex justify-between items-center lg:hidden mb-4">
                <h2 className="text-lg font-semibold text-gray-800">My Library</h2>
                <button 
                  className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  onClick={() => setIsSidebarOpen(false)}
                  aria-label="Close menu"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <h2 className="text-lg font-semibold mb-4 hidden lg:block text-gray-800">My Library</h2>
              
              {loading ? (
                <div className="py-10 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : subscribedBooks.length > 0 ? (
                <div className="space-y-2 mb-6">
                  {subscribedBooks.map((sub) => (
                    <div key={sub._id} className="bg-gray-50 rounded-lg overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 transition-colors duration-200" onClick={() => toggleBookExpansion(sub.bookId)}>
                        <span className="font-medium truncate flex-1 text-gray-700">{sub.bookTitle}</span>
                        <div className="flex items-center">
                          <button
                            className="mr-2 text-gray-400 hover:text-red-500 focus:outline-none"
                            onClick={(e) => handleUnsubscribe(sub.bookId, e)}
                            title="Unsubscribe"
                          >
                            <FaTimes className="h-4 w-4" />
                          </button>
                          <span className="text-gray-400 transform transition-transform duration-200">
                            {expandedBook === sub.bookId ? 
                              <FaChevronDown className="h-4 w-4" /> : 
                              <FaChevronRight className="h-4 w-4" />
                            }
                          </span>
                        </div>
                      </div>
                      
                      {expandedBook === sub.bookId && (
                        <div className="border-t border-gray-200">
                          {bookChapters[sub.bookId] ? (
                            bookChapters[sub.bookId].length > 0 ? (
                              <div className="max-h-64 overflow-y-auto">
                                {bookChapters[sub.bookId].map((chapter) => (
                                  <div 
                                    key={chapter._id} 
                                    className={`p-2 pl-6 cursor-pointer transition-colors duration-200 text-sm ${
                                      activeChapter && activeChapter.chapterId === chapter._id 
                                        ? "bg-blue-500 text-white" 
                                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                    }`}
                                    onClick={() => {
                                      handleChapterSelect(sub.bookId, chapter._id, chapter.title);
                                      setIsSidebarOpen(false);
                                    }}
                                  >
                                    {chapter.title}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-3 text-sm text-gray-500">No chapters available</div>
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
                <div className="bg-gray-50 rounded-lg p-4 text-center shadow-sm">
                  <p className="text-gray-600 mb-4">No books in your library</p>
                  <button 
                    className="inline-flex items-center px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
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
              <div className="pt-4 mt-6 border-t border-gray-200 lg:hidden">
                <nav className="space-y-2">
                  <button 
                    className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => {
                      navigate("/profile");
                      setIsSidebarOpen(false);
                    }}
                  >
                    <FaUserEdit className="h-5 w-5 text-gray-500" /> 
                    <span className="text-gray-700">Profile</span>
                  </button>
                  <button
                    className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => {
                      navigate("/collections");
                      setIsSidebarOpen(false);
                    }}
                  >
                    <FaBook className="h-5 w-5 text-gray-500" /> 
                    <span className="text-gray-700">Collections</span>
                  </button>
                  <button
                    className="w-full flex items-center gap-2 p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 text-red-600"
                    onClick={handleLogout}
                  >
                    <FaSignOutAlt className="h-5 w-5" /> 
                    <span>Logout</span>
                  </button>
                </nav>
              </div>
            </div>
            
            {/* For desktop only - controls fixed at the bottom */}
            <div className="hidden lg:block border-t border-gray-200 mt-auto">
              <nav className="p-4 space-y-2">
                <button 
                  className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={() => navigate("/profile")}
                >
                  <FaUserEdit className="h-5 w-5 text-gray-500" /> 
                  <span className="text-gray-700">Profile</span>
                </button>
                <button
                  className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={() => {
                    navigate("/collections");
                    setIsSidebarOpen(false);
                  }}
                >
                  <FaBook className="h-5 w-5 text-gray-500" /> 
                  <span className="text-gray-700">Collections</span>
                </button>
                <button
                  className="w-full flex items-center gap-2 p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 text-red-600"
                  onClick={handleLogout}
                >
                  <FaSignOutAlt className="h-5 w-5" /> 
                  <span>Logout</span>
                </button>
              </nav>
            </div>
          </aside>
          
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden" style={chatBackgroundStyle}>
            {/* No overlay - removed for full background visibility */}

            {activeChapter ? (
              <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Current chapter indicator */}
                <div className="relative">
                  <div className="bg-white bg-opacity-95 text-gray-800 px-4 py-3 shadow-sm flex justify-between items-center border-b border-gray-100">
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wider text-blue-500">Active Chapter</span>
                      <h3 className="text-sm sm:text-base font-medium text-gray-800">{currentChapterTitle}</h3>
                    </div>
                    <button 
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                      onClick={clearActiveChapter}
                    >
                      Exit Chapter
                    </button>
                  </div>
                </div>
                
                {/* Chat Messages Area - Only shown when activeChapter is selected */}
                <div 
                  className="flex-1 overflow-y-auto p-4 sm:p-6"
                  ref={chatContainerRef}
                >
                  <div className="flex flex-col space-y-4">
                    {Array.isArray(chatHistory) && chatHistory.length > 0 ? (
                      <>
                        {chatHistory.map((msg, index) => (
                          <div
                            key={index}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl shadow-sm p-3 ${
                              msg.role === "user" 
                                ? "bg-blue-500 text-white rounded-tr-sm" 
                                : msg.role === "system" 
                                  ? "bg-yellow-50 text-yellow-800 rounded-tl-sm border border-yellow-100" 
                                  : "bg-white text-gray-800 rounded-tl-sm border border-gray-100"
                            } text-sm sm:text-base markdown-content`}
                            >
                              {msg.role === "user" ? (
                                <>
                                  {msg.content}
                                  {msg.isAudio && msg.messageId && (
                                  <div className="mt-3 p-2 bg-blue-600 rounded-lg">
                                    {audioMessages[msg.messageId] ? (
                                      <audio 
                                        src={audioMessages[msg.messageId]} 
                                        controls 
                                        className="h-10 w-full max-w-[250px] opacity-90" 
                                      />
                                    ) : (
                                      <div className="text-xs text-blue-100 p-2">
                                        [Audio message - Playback unavailable after page reload]
                                      </div>
                                    )}
                                  </div>
                                )}
                                </>
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
                        
                        {/* Show typing indicator when processing a message */}
                        {isProcessing && (
                          <div className="flex justify-start">
                            <div className="bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100 p-3 shadow-sm max-w-[85%] sm:max-w-[75%]">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-150"></div>
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-300"></div>
                                <span className="text-xs text-gray-500 ml-2">AI is thinking...</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Add Start Test button if there's only the system welcome message */}
                        {chatHistory.length === 1 && chatHistory[0].role === 'system' && (
                          <div className="flex justify-center mt-4">
                            <button
                              onClick={() => {
                                // Send "Let's Start" message when button is clicked
                                const newMessage = { role: "user", content: "Let's Start" };
                                setChatHistory([...chatHistory, newMessage]);
                                setIsProcessing(true);
                                
                                // Extract the chapterId string from the activeChapter object
                                const chapterId = typeof activeChapter === 'object' && activeChapter.chapterId 
                                  ? activeChapter.chapterId 
                                  : activeChapter;
                                
                                // Then call API directly with this content
                                axios.post(API_ENDPOINTS.CHAT, {
                                  message: "Let's Start",
                                  userId: getUserId(),
                                  chapterId
                                }, {
                                  headers: {
                                    'Authorization': `Bearer ${getToken()}`
                                  }
                                }).then(response => {
                                  processStartTestResponse(response);
                                  
                                  // Scroll to bottom of chat
                                  setTimeout(() => {
                                    if (chatEndRef && chatEndRef.current) {
                                      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
                                    }
                                  }, 200);
                                }).catch(error => {
                                  console.error("Error sending initial message:", error);
                                  setChatHistory(prev => [...prev, { 
                                    role: "system", 
                                    content: "Failed to start test. Please try again." 
                                  }]);
                                }).finally(() => {
                                  setIsProcessing(false);
                                });
                              }}
                              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm transition-colors duration-200 flex items-center"
                              disabled={isProcessing}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3-2a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {isProcessing ? "Starting..." : "Start Test"}
                            </button>
                          </div>
                        )}
                        
                        <div ref={chatEndRef} />
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-700 bg-white bg-opacity-95 rounded-xl p-8 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <p className="text-center text-xl font-medium">Start a conversation!</p>
                        <p className="text-center text-base mt-3">
                          Ask questions about this chapter
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Message Input - Only shown when activeChapter is selected */}
                <div className="border-t border-gray-100 p-3 sm:p-4 bg-white bg-opacity-95">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Ask about this chapter..."
                        className={`w-full pl-4 pr-10 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base font-sans ${isProcessing ? 'bg-gray-100 text-gray-500' : ''}`}
                        style={{ fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        disabled={isRecording || isProcessing}
                      />
                      <button 
                        className={`absolute right-2 top-1/2 transform -translate-y-1/2 ${isProcessing || !message.trim() ? 'text-gray-300' : 'text-gray-400 hover:text-blue-500'} p-2 rounded-full focus:outline-none`}
                        onClick={handleSendMessage}
                        disabled={isRecording || isProcessing || !message.trim()}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Audio Mode Toggle */}
                    <div className="flex items-center">
                      <label htmlFor="audioMode" className="mr-2 text-sm text-gray-600 cursor-pointer">
                        Audio Mode
                      </label>
                      <div className="relative inline-block w-10 mr-2 align-middle select-none">
                        <input 
                          type="checkbox" 
                          name="audioMode" 
                          id="audioMode" 
                          checked={audioModeEnabled}
                          onChange={() => setAudioModeEnabled(!audioModeEnabled)}
                          className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                        />
                        <label 
                          htmlFor="audioMode" 
                          className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${audioModeEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                        ></label>
                      </div>
                    </div>
                    
                    {/* Audio recording button - always visible regardless of audio mode */}
                    {!isRecording ? (
                      <button 
                        className={`bg-blue-600 ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'} text-white px-4 py-3 rounded-lg shadow-sm flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto`}
                        onClick={startRecording}
                        disabled={isProcessing}
                      >
                        <span className="flex items-center">
                          <FaMicrophone className="mr-2" /> 
                          Voice Message
                        </span>
                      </button>
                    ) : (
                      <button 
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg shadow-sm flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 animate-pulse"
                        onClick={stopRecording}
                      >
                        <FaStop className="mr-2" /> 
                        Stop Recording
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Display SubscribedBooksView when no chapter is selected */
              <div className="flex-1 overflow-hidden relative">
                <SubscribedBooksView 
                  subscribedBooks={subscribedBooks}
                  onSelectChapter={handleChapterSelect}
                  fetchChapters={fetchBookChaptersData}
                  loading={loading}
                />
              </div>
            )}
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

        {/* Notification Popup */}
        {showNotificationPopup && currentNotification && (
          <div 
            className="fixed inset-0 flex items-center justify-center z-[9999]"
            style={{pointerEvents: 'none'}}
          >
            <div className="notification-popup-container mx-auto" 
                 style={{
                   maxWidth: '320px',
                   width: '90%',
                   pointerEvents: 'auto',
                   margin: '0 auto'
                 }}>
              <div className="bg-white rounded-lg shadow-lg p-4 notification-popup relative border border-blue-200 w-full">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-3">
                    <FaBell className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-800 mb-1 break-words">{currentNotification.title}</h3>
                    <p className="text-xs text-gray-600 mb-3 break-words">{currentNotification.message}</p>
                    <div className="flex justify-end">
                      <button
                        onClick={handleNotificationConfirm}
                        className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors font-medium"
                      >
                        OK
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Add Score Popup */}
        {showScorePopup && chapterScore && (
          <div className="fixed bottom-24 right-5 z-50 animate-pulse">
            <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex flex-col items-center">
              <h3 className="font-bold text-lg mb-1">Current Score</h3>
              <div className="flex items-center justify-center space-x-2">
                <span className="text-xl font-bold">{chapterScore.earnedMarks}/{chapterScore.totalMarks}</span>
                <span className="text-lg">({Math.round(chapterScore.percentage)}%)</span>
              </div>
              <p className="text-sm mt-1">
                Questions: {chapterScore.answeredQuestions}/{chapterScore.totalQuestions}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}



