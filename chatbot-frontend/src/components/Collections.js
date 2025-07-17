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

  // New state for search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    subject: "",
    grade: "",
    author: "",
    status: "",
    progress: "",
    lastAccessed: ""
  });
  const [sortBy, setSortBy] = useState("title");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [availableFilters, setAvailableFilters] = useState({
    subjects: [],
    grades: [],
    authors: [],
    statuses: []
  });
  const [collectionSummary, setCollectionSummary] = useState({
    totalBooks: 0,
    completedBooks: 0,
    inProgressBooks: 0,
    notStartedBooks: 0,
    averageProgress: 0,
    totalTimeSpent: 0
  });

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

  // Fetch collection summary
  useEffect(() => {
    const fetchCollectionSummary = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        
        const response = await axios.get(API_ENDPOINTS.GET_COLLECTION_SUMMARY, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data.success) {
          setCollectionSummary(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching collection summary:", error);
      }
    };
    
    fetchCollectionSummary();
  }, []);

  // Fetch books from collection API with search and filters
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

        // Build query parameters
        const params = new URLSearchParams();
        
        if (searchQuery) params.append('search', searchQuery);
        if (filters.subject) params.append('subject', filters.subject);
        if (filters.grade) params.append('grade', filters.grade);
        if (filters.author) params.append('author', filters.author);
        if (filters.status) params.append('status', filters.status);
        if (filters.progress) params.append('progress', filters.progress);
        if (filters.lastAccessed) params.append('lastAccessed', filters.lastAccessed);
        
        params.append('sortBy', sortBy);
        params.append('sortOrder', sortOrder);
        params.append('page', currentPage.toString());
        params.append('limit', '20');

        const response = await axios.get(`${API_ENDPOINTS.GET_USER_COLLECTION}?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data.success) {
          setBooks(response.data.data.books);
          setPagination(response.data.pagination);
          setAvailableFilters(response.data.data.availableFilters);
          setCollectionSummary(response.data.data.summary);
          console.log(`Loaded ${response.data.data.books.length} books from collection`);
        }
      } catch (error) {
        console.error("Error fetching books:", error);
        setError("Failed to fetch books");
      } finally {
        setLoading(false);
      }
    };
    
    fetchBooks();
  }, [searchQuery, filters, sortBy, sortOrder, currentPage]);

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
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Handle sort changes
  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setFilters({
      subject: "",
      grade: "",
      author: "",
      status: "",
      progress: "",
      lastAccessed: ""
    });
    setSortBy("title");
    setSortOrder("asc");
    setCurrentPage(1);
  };

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
    const bookData = books.find(book => book.bookId === bookId);
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

  // Auto-hide notification after 5 seconds
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, type: "", message: "" });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Auto-hide error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Format progress percentage
  const formatProgress = (progress) => {
    return Math.round(progress * 10) / 10;
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'not_started': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status display text
  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      case 'not_started': return 'Not Started';
      default: return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            📚 My Collection
          </h1>

          {/* Collection Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">{collectionSummary.totalBooks}</div>
              <div className="text-sm">Total Books</div>
            </div>
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">{collectionSummary.completedBooks}</div>
              <div className="text-sm">Completed</div>
            </div>
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">{collectionSummary.inProgressBooks}</div>
              <div className="text-sm">In Progress</div>
            </div>
            <div className="bg-gradient-to-r from-gray-500 to-gray-600 text-white p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">{collectionSummary.notStartedBooks}</div>
              <div className="text-sm">Not Started</div>
            </div>
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">{formatProgress(collectionSummary.averageProgress)}%</div>
              <div className="text-sm">Avg Progress</div>
            </div>
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-4 rounded-lg text-center">
              <div className="text-2xl font-bold">{Math.round(collectionSummary.totalTimeSpent / 60)}h</div>
              <div className="text-sm">Time Spent</div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search books by title, subject, or author..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
              {/* Subject Filter */}
              <select
                value={filters.subject}
                onChange={(e) => handleFilterChange('subject', e.target.value)}
                className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Subjects</option>
                {availableFilters.subjects.map(subject => (
                  <option key={subject.name} value={subject.name}>
                    {subject.name} ({subject.count})
                  </option>
                ))}
              </select>

              {/* Grade Filter */}
              <select
                value={filters.grade}
                onChange={(e) => handleFilterChange('grade', e.target.value)}
                className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Grades</option>
                {availableFilters.grades.map(grade => (
                  <option key={grade.name} value={grade.name}>
                    Grade {grade.name} ({grade.count})
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                {availableFilters.statuses.map(status => (
                  <option key={status.name} value={status.name}>
                    {getStatusText(status.name)} ({status.count})
                  </option>
                ))}
              </select>

              {/* Progress Filter */}
              <select
                value={filters.progress}
                onChange={(e) => handleFilterChange('progress', e.target.value)}
                className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Progress</option>
                <option value="0-25">0-25%</option>
                <option value="26-50">26-50%</option>
                <option value="51-75">51-75%</option>
                <option value="76-100">76-100%</option>
              </select>

              {/* Last Accessed Filter */}
              <select
                value={filters.lastAccessed}
                onChange={(e) => handleFilterChange('lastAccessed', e.target.value)}
                className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Time</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="older">Older</option>
              </select>

              {/* Clear Filters Button */}
              <button
                onClick={clearFilters}
                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Clear All
              </button>
            </div>

            {/* Sort Options */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-600 py-2">Sort by:</span>
              {['title', 'subject', 'grade', 'progress', 'lastAccessed'].map(field => (
                <button
                  key={field}
                  onClick={() => handleSortChange(field)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    sortBy === field
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                  {sortBy === field && (
                    <span className="ml-1">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Notification */}
          {notification.show && (
            <div className={`px-4 py-3 rounded-lg mb-6 ${
              notification.type === "success" ? "bg-green-100 border border-green-400 text-green-700" :
              notification.type === "info" ? "bg-blue-100 border border-blue-400 text-blue-700" :
              "bg-red-100 border border-red-400 text-red-700"
            }`}>
              <p className="text-sm">{notification.message}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="text-gray-600 mt-2">Loading your collection...</p>
            </div>
          )}

          {/* Books Grid */}
          {!loading && (
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

                      {/* Progress Info */}
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

                      {/* Status Badge */}
                      <div className="mb-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(book.userProgress.status)}`}>
                          {getStatusText(book.userProgress.status)}
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="text-xs text-gray-500 mb-4">
                        <div>Chapters: {book.userProgress.chaptersCompleted}/{book.totalChapters}</div>
                        <div>Time: {book.userProgress.totalTimeSpent}min</div>
                        <div>Score: {formatProgress(book.userProgress.averageScore)}%</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() => fetchChapters(book.bookId)}
                        className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors text-sm"
                      >
                        View Chapters
                      </button>
                      <button
                        onClick={() => handleUnsubscribe(book.bookId)}
                        className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors text-sm"
                        disabled={loading}
                      >
                        Remove
                      </button>
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
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
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

          {/* Empty State */}
          {!loading && books.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No books found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery || Object.values(filters).some(f => f) 
                  ? "Try adjusting your search or filters"
                  : "You haven't subscribed to any books yet"}
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
        </div>
      </div>

      {/* Chapters Modal */}
      {showChaptersModal && (
        <ChaptersModal
          book={selectedBookData}
          chapters={chapters}
          onClose={closeChaptersModal}
        />
      )}
    </div>
  );
}
