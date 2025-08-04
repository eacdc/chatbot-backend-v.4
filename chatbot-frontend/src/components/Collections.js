import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../config";
import { updateLastActivity, isAuthenticated } from "../utils/auth";
import { useNavigate } from "react-router-dom";
import ChaptersModal from "./ChaptersModal";

export default function Collections() {
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedBookData, setSelectedBookData] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState({ show: false, type: "", message: "" });
  const [subscribedBookIds, setSubscribedBookIds] = useState([]);
  const [noChaptersModal, setNoChaptersModal] = useState({ show: false, bookTitle: "" });
  const [showChaptersModal, setShowChaptersModal] = useState(false);
  const navigate = useNavigate();

  // Enhanced UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    subject: "",
    grade: "",
    author: "",
    publisher: ""
  });
  const [sortBy, setSortBy] = useState("title");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [availableFilters, setAvailableFilters] = useState({
    subjects: [],
    grades: [],
    authors: [],
    publishers: []
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [viewMode, setViewMode] = useState("subscribed"); // "all" for all books, "subscribed" for user's collection

  // Update activity timestamp on component mount
  useEffect(() => {
    if (isAuthenticated()) {
      updateLastActivity();
    } else {
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
        
        const bookIds = response.data.map(sub => sub.bookId);
        setSubscribedBookIds(bookIds);
      } catch (error) {
        console.error("Error fetching subscriptions:", error);
      }
    };
    
    fetchSubscriptions();
  }, []);

  // Fetch books based on view mode
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Please log in to view collections");
          setLoading(false);
          return;
        }

        let response;
        
        if (viewMode === "subscribed") {
          // Fetch user's collection (subscribed books)
          const params = new URLSearchParams();
          
          if (searchQuery) params.append('search', searchQuery);
          if (filters.subject) params.append('subject', filters.subject);
          if (filters.grade) params.append('grade', filters.grade);
          if (filters.author) params.append('author', filters.author);
          
          params.append('sortBy', sortBy);
          params.append('sortOrder', sortOrder);
          params.append('page', currentPage.toString());
          params.append('limit', '20');

          console.log(`🔍 Fetching subscribed books with params:`, params.toString());
          console.log(`🔍 API URL: ${API_ENDPOINTS.GET_USER_COLLECTION}?${params.toString()}`);

          response = await axios.get(`${API_ENDPOINTS.GET_USER_COLLECTION}?${params.toString()}`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          console.log(`✅ API Response:`, response.data);
          
          if (response.data.success) {
            setBooks(response.data.data.books);
            setPagination(response.data.pagination);
            setAvailableFilters(response.data.data.availableFilters);
            console.log(`✅ Available filters set:`, response.data.data.availableFilters);
            console.log(`Loaded ${response.data.data.books.length} books from user collection`);
          } else {
            console.error(`❌ API returned success: false`, response.data);
            setError("Failed to fetch books");
          }
        } else {
          // Fetch all available books
          const params = new URLSearchParams();
          
          if (searchQuery) params.append('q', searchQuery);
          if (filters.subject) params.append('subject', filters.subject);
          if (filters.grade) params.append('grade', filters.grade);
          if (filters.publisher) params.append('publisher', filters.publisher);
          
          params.append('sortBy', sortBy);
          params.append('sortOrder', sortOrder);
          params.append('page', currentPage.toString());
          params.append('limit', '20');

          // Check if user has publisher preference
          if (user && user.publisher) {
            params.append('publisher', user.publisher);
          }

          response = await axios.get(`${API_ENDPOINTS.GET_BOOKS}?${params.toString()}`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          // Transform books to match expected structure
          const transformedBooks = response.data.map(book => ({
            bookId: book._id,
            title: book.title,
            subject: book.subject,
            grade: book.grade,
            author: book.publisher,
            publisher: book.publisher,
            coverImage: book.bookCoverImgLink,
            description: book.description,
            totalChapters: book.totalChapters || 0,
            createdAt: book.createdAt
          }));
          
          setBooks(transformedBooks);
          setPagination({
            currentPage: currentPage,
            totalPages: Math.ceil(response.data.length / 20),
            totalItems: response.data.length,
            hasNext: currentPage < Math.ceil(response.data.length / 20),
            hasPrev: currentPage > 1
          });
          
          // Get unique values for filters
          const subjects = [...new Set(response.data.map(book => book.subject))];
          const grades = [...new Set(response.data.map(book => book.grade))];
          const publishers = [...new Set(response.data.map(book => book.publisher))];
          
          setAvailableFilters({
            subjects,
            grades,
            publishers,
            authors: publishers
          });
          
          console.log(`Loaded ${transformedBooks.length} books from all available books`);
        }
      } catch (error) {
        console.error("Error fetching books:", error);
        console.error("Error response:", error.response?.data);
        console.error("Error status:", error.response?.status);
        
        if (error.response?.status === 401) {
          setError("Please log in to view collections");
        } else if (error.response?.status === 500) {
          setError("Server error. Please try again later.");
        } else if (error.response?.data?.error) {
          setError(error.response.data.error);
        } else {
          setError("Failed to fetch books. Please check your connection.");
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchBooks();
  }, [searchQuery, filters, sortBy, sortOrder, currentPage, viewMode, user]);

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

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    console.log(`🔍 Filter changed: ${filterType} = ${value}`);
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
    setCurrentPage(1);
  };

  // Handle sort changes
  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setFilters({
      subject: "",
      grade: "",
      author: "",
      publisher: ""
    });
    setSortBy("title");
    setSortOrder("asc");
    setCurrentPage(1);
  };

  // Show notification
  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification({ show: false, type: "", message: "" });
    }, 3000);
  };

  // Fetch chapters for a book
  const fetchChapters = async (bookId) => {
    try {
      const token = localStorage.getItem("token");
      
      // First, find the book data from our current books array
      const bookData = books.find(book => book.bookId === bookId);
      if (bookData) {
        setSelectedBookData(bookData);
      }
      
      const response = await axios.get(API_ENDPOINTS.GET_BOOK_CHAPTERS.replace(':bookId', bookId), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setChapters(response.data);
      setSelectedBook(bookId);
      setShowChaptersModal(true);
    } catch (error) {
      console.error("Error fetching chapters:", error);
      if (error.response?.status === 404) {
        // Find the book title for the error message
        const bookTitle = books.find(book => book.bookId === bookId)?.title || "Book";
        setNoChaptersModal({ show: true, bookTitle });
      } else {
        showNotification("error", "Failed to fetch chapters");
      }
    }
  };

  // Close chapters modal
  const closeChaptersModal = () => {
    setShowChaptersModal(false);
    setSelectedBook(null);
    setSelectedBookData(null);
    setChapters([]);
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

      setSubscribedBookIds([...subscribedBookIds, bookId]);
      showNotification("success", response.data.message || "Successfully subscribed to the book");
    } catch (error) {
      console.error("Subscription error:", error.response?.data?.error || error.message);
      
      if (error.response?.data?.error === "Already subscribed to this book") {
        showNotification("info", "You are already subscribed to this book");
      } else {
        showNotification("error", error.response?.data?.error || "Subscription failed");
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
      const response = await axios.delete(
        API_ENDPOINTS.UNSUBSCRIBE_BOOK.replace(':bookId', bookId),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setSubscribedBookIds(subscribedBookIds.filter(id => id !== bookId));
      showNotification("success", response.data.message || "Successfully unsubscribed from the book");
      
      // If in subscribed view, refresh the books list
      if (viewMode === "subscribed") {
        setBooks(books.filter(book => book.bookId !== bookId));
      }
    } catch (error) {
      console.error("Unsubscription error:", error.response?.data?.error || error.message);
      showNotification("error", error.response?.data?.error || "Unsubscription failed");
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for subscribed view
  const formatProgress = (value) => {
    return Math.round(value || 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'not_started': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      case 'not_started': return 'Not Started';
      default: return 'Unknown';
    }
  };

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleNextPage = () => {
    if (pagination.hasNext) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (pagination.hasPrev) {
      setCurrentPage(currentPage - 1);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Notification */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500' : 
          notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        } text-white`}>
          {notification.message}
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">📚 Book Collections</h1>
          <p className="text-gray-600 text-lg">Discover and manage your learning journey</p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setViewMode("all")}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === "all"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              All Books
            </button>
            <button
              onClick={() => setViewMode("subscribed")}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === "subscribed"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              My Collection
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* Enhanced Search Bar */}
            <div className="flex-1 relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search books by title, subject, or author..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full p-4 pl-12 pr-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-white border-2 border-gray-300 rounded-xl px-6 py-4 hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
            >
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="font-medium">Filters</span>
            </button>

            {/* Sort Button */}
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="bg-white border-2 border-gray-300 rounded-xl px-6 py-4 hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5v14m8-14v14" />
                </svg>
                <span className="font-medium">Sort</span>
              </button>

              {showSortDropdown && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                  <div className="py-2">
                    {['title', 'subject', 'grade', 'createdAt'].map((field) => (
                      <button
                        key={field}
                        onClick={() => {
                          handleSortChange(field);
                          setShowSortDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 capitalize flex items-center justify-between"
                      >
                        <span>{field === 'createdAt' ? 'Date Added' : field}</span>
                        {sortBy === field && (
                          <span className="text-blue-500">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <select
                  value={filters.subject}
                  onChange={(e) => handleFilterChange('subject', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Subjects</option>
                  {((availableFilters || {}).subjects || []).map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
                <select
                  value={filters.grade}
                  onChange={(e) => handleFilterChange('grade', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Grades</option>
                  {((availableFilters || {}).grades || []).map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Publisher</label>
                <select
                  value={filters.publisher}
                  onChange={(e) => handleFilterChange('publisher', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Publishers</option>
                  {((availableFilters || {}).publishers || []).map(publisher => (
                    <option key={publisher} value={publisher}>{publisher}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 flex gap-2">
                <button
                  onClick={clearFilters}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Books Grid */}
        <div className="mb-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
              <p className="mt-4 text-gray-600 font-medium">Loading books...</p>
            </div>
          ) : (
            <>
              {!loading && books.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {books.map((book) => (
                    <div key={book.bookId} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow duration-300">
                      <div className="flex flex-col h-full">
                        {/* Book Cover */}
                        <div className="mb-4 text-center">
                          <img
                            src={book.coverImage}
                            alt={book.title}
                            className="h-32 w-auto mx-auto object-contain rounded-lg"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22150%22%20viewBox%3D%220%200%20100%20150%22%3E%3Crect%20fill%3D%22%233B82F6%22%20width%3D%22100%22%20height%3D%22150%22%2F%3E%3Ctext%20fill%3D%22%23FFFFFF%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2210%22%20text-anchor%3D%22middle%22%20x%3D%2250%22%20y%3D%2275%22%3EBook%3C%2Ftext%3E%3C%2Fsvg%3E";
                            }}
                          />
                        </div>

                        {/* Book Info */}
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 mb-2 text-center">{book.title}</h3>
                          <p className="text-sm text-gray-600 mb-1">Subject: {book.subject}</p>
                          <p className="text-sm text-gray-600 mb-1">Grade: {book.grade}</p>
                          <p className="text-sm text-gray-600 mb-3">Publisher: {book.author}</p>

                          {/* Progress Info for subscribed view */}
                          {viewMode === "subscribed" && book.userProgress && (
                            <>
                              <div className="mb-3">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm text-gray-600">Progress:</span>
                                  <span className="text-sm font-medium">{formatProgress(book.userProgress.progressPercentage)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${book.userProgress.progressPercentage}%` }}
                                  ></div>
                                </div>
                              </div>

                              <div className="mb-3">
                                <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(book.userProgress.status)}`}>
                                  {getStatusText(book.userProgress.status)}
                                </span>
                              </div>

                              <div className="text-xs text-gray-500 mb-4">
                                <div>Chapters: {book.userProgress.chaptersCompleted}/{book.totalChapters}</div>
                                <div>Time: {book.userProgress.totalTimeSpent}min</div>
                                <div>Score: {formatProgress(book.userProgress.averageScore)}%</div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-auto">
                          <button
                            onClick={() => fetchChapters(book.bookId)}
                            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors text-sm"
                          >
                            View Chapters
                          </button>
                          
                          {/* Subscribe/Unsubscribe button */}
                          {subscribedBookIds.includes(book.bookId) ? (
                            <button
                              onClick={() => handleUnsubscribe(book.bookId)}
                              className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors text-sm"
                              disabled={loading}
                            >
                              Remove
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSubscribe(book.bookId)}
                              className="bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors text-sm"
                              disabled={loading}
                            >
                              Subscribe
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    onClick={handlePrevPage}
                    disabled={!pagination.hasPrev}
                    className={`px-4 py-2 rounded-lg ${
                      pagination.hasPrev
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Previous
                  </button>
                  
                  <span className="px-4 py-2 text-gray-600">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  
                  <button
                    onClick={handleNextPage}
                    disabled={!pagination.hasNext}
                    className={`px-4 py-2 rounded-lg ${
                      pagination.hasNext
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Next
                  </button>
                </div>
              )}

              {!loading && books.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📚</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No books found</h3>
                  <p className="text-gray-500 mb-4">
                    {searchQuery || Object.values(filters).some(f => f) 
                      ? "Try adjusting your search or filters"
                      : viewMode === "subscribed" 
                        ? "You haven't subscribed to any books yet"
                        : "No books available"}
                  </p>
                  {searchQuery || Object.values(filters).some(f => f) ? (
                    <button
                      onClick={clearFilters}
                      className="bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Clear Filters
                    </button>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chapters Modal */}
      {showChaptersModal && (
        <ChaptersModal
          isOpen={showChaptersModal}
          book={selectedBookData}
          chapters={chapters}
          onClose={closeChaptersModal}
        />
      )}

      {/* No Chapters Modal */}
      {noChaptersModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">No Chapters Available</h3>
            <p className="text-gray-600 mb-6">
              "{noChaptersModal.bookTitle}" doesn't have any chapters yet.
            </p>
            <button
              onClick={() => setNoChaptersModal({ show: false, bookTitle: "" })}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
