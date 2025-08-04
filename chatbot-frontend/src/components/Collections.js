import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../config";
import { updateLastActivity, isAuthenticated } from "../utils/auth";
import { useNavigate } from "react-router-dom";
import ChaptersModal from "./ChaptersModal";
import BookFilterToolbar from "./BookFilterToolbar";

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

          console.log(`🔍 Fetching all books with params:`, params.toString());
          console.log(`🔍 API URL: ${API_ENDPOINTS.SEARCH_WITH_STATUS}?${params.toString()}`);

          response = await axios.get(`${API_ENDPOINTS.SEARCH_WITH_STATUS}?${params.toString()}`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          console.log(`✅ API Response:`, response.data);
          
          if (response.data.success) {
            // The response format matches the collection API
            setBooks(response.data.data.books);
            setPagination(response.data.pagination);
            setAvailableFilters(response.data.data.availableFilters || {
              subjects: [...new Set(response.data.data.books.map(book => book.subject))],
              grades: [...new Set(response.data.data.books.map(book => book.grade))],
              publishers: [...new Set(response.data.data.books.map(book => book.publisher))]
            });
            console.log(`Loaded ${response.data.data.books.length} books from all available books`);
          } else {
            console.error(`❌ API returned success: false`, response.data);
            setError("Failed to fetch books");
          }
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
        <BookFilterToolbar 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filters={filters}
          setFilters={setFilters}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          availableFilters={availableFilters}
          clearAllFilters={clearFilters}
          viewMode={viewMode}
        />

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
