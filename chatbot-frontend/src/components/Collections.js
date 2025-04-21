import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../config";
import { updateLastActivity, isAuthenticated } from "../utils/auth"; // Import auth utilities
import { useNavigate } from "react-router-dom"; // Import for navigation
import ChaptersModal from "./ChaptersModal"; // Import the new ChaptersModal component

export default function Collections() {
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedBookData, setSelectedBookData] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState({ show: false, type: "", message: "" });
  const [subscribedBookIds, setSubscribedBookIds] = useState([]); // Track subscribed book IDs
  const [noChaptersModal, setNoChaptersModal] = useState({ show: false, bookTitle: "" });
  const [showChaptersModal, setShowChaptersModal] = useState(false);
  const navigate = useNavigate(); // For navigation

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

  // Fetch logged-in user details from API
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Please log in to view collections");
          return;
        }
        const response = await axios.get(API_ENDPOINTS.GET_USER, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setUser(response.data);
      } catch (error) {
        console.error("Error fetching user:", error);
        setError("Failed to fetch user details");
      }
    };

    fetchUser();
  }, []);

  // Fetch user's subscriptions
  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        
        const response = await axios.get(API_ENDPOINTS.GET_SUBSCRIPTIONS, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Extract book IDs from subscriptions
        const bookIds = response.data.map(sub => sub.bookId);
        setSubscribedBookIds(bookIds);
      } catch (error) {
        console.error("Error fetching subscriptions:", error);
      }
    };
    
    fetchSubscriptions();
  }, []);

  // Fetch books from API
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        
        // Get the user's details from state
        const userGrade = user?.grade || localStorage.getItem("userGrade");
        const userPublisher = user?.publisher || localStorage.getItem("userPublisher");
        
        // PUBLISHER FILTER TEMPORARILY DISABLED
        // To re-enable filtering, uncomment the code below and remove the unfiltered request
        
        /*
        // Build query parameters
        const queryParams = new URLSearchParams();
        // Temporarily removed grade filtering
        // if (userGrade) {
        //   queryParams.append('grade', userGrade);
        // }
        if (userPublisher) {
          queryParams.append('publisher', userPublisher);
        }
        
        // Construct URL with query parameters
        const url = `${API_ENDPOINTS.GET_BOOKS}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        */
        
        // Unfiltered request - fetch all books without filtering
        const url = API_ENDPOINTS.GET_BOOKS;
        
        const response = await axios.get(url);
        setBooks(response.data);
        console.log(`Loaded ${response.data.length} books (publisher filtering disabled)`);
      } catch (error) {
        console.error("Error fetching books:", error);
        setError("Failed to fetch books");
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, [user]);

  // Store user data in localStorage when user data is fetched
  useEffect(() => {
    if (user) {
      if (user.grade) {
        localStorage.setItem("userGrade", user.grade);
      }
      if (user.publisher) {
        localStorage.setItem("userPublisher", user.publisher);
      }
    }
  }, [user]);

  // Fetch chapters when a book is selected
  const fetchChapters = async (bookId) => {
    setLoading(true);
    
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to view chapters");
      setLoading(false);
      return;
    }
    
    // Find the book data for the selected book
    const bookData = books.find(book => book._id === bookId);
    setSelectedBookData(bookData);
    
    try {
      // Use a direct axios call with the correct endpoint
      const response = await axios.get(API_ENDPOINTS.GET_BOOK_CHAPTERS.replace(':bookId', bookId), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // If we get a response, check if it has chapters
      if (response.data && response.data.length > 0) {
        setChapters(response.data);
        setSelectedBook(bookId);
        setShowChaptersModal(true);
      } else {
        // No chapters in response
        setChapters([]);
        setSelectedBook(bookId);
        setShowChaptersModal(true);
      }
    } catch (error) {
      console.log("Caught error in fetchChapters:", error.message);
      
      // Handle authentication errors without redirecting
      if (error.response && error.response.status === 401) {
        setError("Your session has expired. Please log in again.");
      } 
      // Specifically handle 404 errors as "No chapters found"
      else if (error.response && error.response.status === 404) {
        setChapters([]);
        setSelectedBook(bookId);
        setShowChaptersModal(true);
      } else {
        // For other errors, don't set the full error state, just log it
        console.error("Error fetching chapters:", error);
        setError("Failed to load chapters. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Close the chapters modal
  const closeChaptersModal = () => {
    setShowChaptersModal(false);
  };

  // Subscribe to a book
  const handleSubscribe = async (bookId) => {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Please log in to subscribe to books");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(
        API_ENDPOINTS.SUBSCRIPTIONS,
        { bookId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Add this book ID to the subscribed list
      setSubscribedBookIds([...subscribedBookIds, bookId]);

      setNotification({
        show: true,
        type: "success",
        message: response.data.message || "Successfully subscribed to the book"
      });
    } catch (error) {
      console.error("Subscription error:", error.response?.data?.error || error.message);
      
      // Handle "Already subscribed" message differently
      if (error.response?.data?.error === "Already subscribed to this book") {
        setNotification({
          show: true,
          type: "info",
          message: "You are already subscribed to this book"
        });
      } else {
        setError(error.response?.data?.error || "Subscription failed");
      }
    } finally {
      setLoading(false);
    }
  };

  // Unsubscribe from a book
  const handleUnsubscribe = async (bookId) => {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Please log in to unsubscribe from books");
      return;
    }

    try {
      setLoading(true);
      await axios.delete(
        API_ENDPOINTS.UNSUBSCRIBE_BOOK.replace(':bookId', bookId),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Remove this book ID from the subscribed list
      setSubscribedBookIds(subscribedBookIds.filter(id => id !== bookId));

      setNotification({
        show: true,
        type: "success",
        message: "Successfully unsubscribed from the book"
      });
    } catch (error) {
      console.error("Unsubscription error:", error.response?.data?.error || error.message);
      setError(error.response?.data?.error || "Unsubscription failed");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to fix image URLs that might be using localhost
  const fixImageUrl = (url) => {
    if (!url) return "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%20viewBox%3D%220%200%20400%20600%22%3E%3Crect%20fill%3D%22%233B82F6%22%20width%3D%22400%22%20height%3D%22600%22%2F%3E%3Ctext%20fill%3D%22%23FFFFFF%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20x%3D%22200%22%20y%3D%22300%22%3E%3Ctspan%20x%3D%22200%22%20dy%3D%220%22%3EBook%20Cover%3C%2Ftspan%3E%3Ctspan%20x%3D%22200%22%20dy%3D%2230%22%3ENot%20Available%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fsvg%3E";
    
    // Check if the URL is using localhost
    if (url.includes('localhost:5000')) {
      // Replace localhost:5000 with the production URL
      return url.replace('http://localhost:5000', 'https://chatbot-backend-v-4-1.onrender.com');
    }
    
    // If it's already using HTTP, convert to HTTPS
    if (url.startsWith('http://')) {
      return url.replace('http://', 'https://');
    }
    
    return url;
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4">
        <div className="bg-white rounded-xl shadow-xl p-6 md:p-8 max-w-md w-full border border-red-100">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{error === "Please log in to view collections" ? "Authentication Required" : "Error"}</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button 
              onClick={() => window.location.href = '/login'} 
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
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

      {/* Chapters Modal */}
      <ChaptersModal
        isOpen={showChaptersModal}
        onClose={closeChaptersModal}
        book={selectedBookData}
        chapters={chapters}
        isAdmin={false}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Book Collections</h1>
            <p className="mt-1 text-sm sm:text-base text-gray-500">Browse and subscribe to available books</p>
          </div>
          
          <div className="mt-4 sm:mt-0">
            <a 
              href="/chatbot" 
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Back to Chat
            </a>
          </div>
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading collections...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
              {books.map((book) => (
                <div key={book._id} className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-100 flex flex-col">
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={fixImageUrl(book.bookCoverImgLink)} 
                      alt={book.title} 
                      className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500 ease-in-out"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%20viewBox%3D%220%200%20400%20600%22%3E%3Crect%20fill%3D%22%233B82F6%22%20width%3D%22400%22%20height%3D%22600%22%2F%3E%3Ctext%20fill%3D%22%23FFFFFF%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20x%3D%22200%22%20y%3D%22300%22%3E%3Ctspan%20x%3D%22200%22%20dy%3D%220%22%3EBook%20Cover%3C%2Ftspan%3E%3Ctspan%20x%3D%22200%22%20dy%3D%2230%22%3ENot%20Available%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fsvg%3E";
                        console.error(`Failed to load image: ${book.bookCoverImgLink}`);
                      }}
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h2 className="font-bold text-lg text-gray-900 line-clamp-1">{book.title}</h2>
                    <p className="text-sm text-gray-600 mb-4">{book.publisher}</p>
                    <div className="mt-auto flex flex-col sm:flex-row gap-2">
                      <button
                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 flex-1"
                        onClick={() => fetchChapters(book._id)}
                        disabled={loading}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                        View Chapters
                      </button>
                      
                      {subscribedBookIds.includes(book._id) ? (
                        <button
                          className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200 flex-1"
                          onClick={() => handleUnsubscribe(book._id)}
                          disabled={loading}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Unsubscribe
                        </button>
                      ) : (
                        <button
                          className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200 flex-1"
                          onClick={() => handleSubscribe(book._id)}
                          disabled={loading}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Subscribe
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {books.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8 max-w-md w-full">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">No Books Available</h2>
                  <p className="text-gray-600 mb-6">There are currently no books in the collection. Check back soon as our library continues to grow!</p>
                  <div className="animate-pulse flex space-x-4 mt-4 justify-center">
                    <div className="h-3 w-20 bg-blue-200 rounded"></div>
                    <div className="h-3 w-16 bg-blue-300 rounded"></div>
                    <div className="h-3 w-24 bg-blue-200 rounded"></div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
