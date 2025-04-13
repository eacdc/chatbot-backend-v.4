import React, { useState, useEffect } from "react";
import axios from "axios";
import adminAxiosInstance from "../utils/adminAxios";
import { API_ENDPOINTS } from "../config";
import { useNavigate } from "react-router-dom";

export default function AdminCollections() {
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState({ show: false, type: "", message: "" });
  const navigate = useNavigate();

  // Check admin authentication
  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");
    if (!adminToken) {
      setError("Please log in as an admin to view collections");
      navigate("/admin/login");
    }
  }, [navigate]);

  // Fetch books from API
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        const response = await axios.get(API_ENDPOINTS.GET_BOOKS);
        setBooks(response.data);
      } catch (error) {
        console.error("Error fetching books:", error);
        setError("Failed to fetch books");
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, []);

  // Fetch chapters when a book is selected
  const fetchChapters = async (bookId) => {
    try {
      setLoading(true);
      const response = await adminAxiosInstance.get(API_ENDPOINTS.GET_BOOK_CHAPTERS.replace(':bookId', bookId));
      setChapters(response.data);
      setSelectedBook(bookId);
    } catch (error) {
      console.error("Error fetching chapters:", error);
      setError("Failed to fetch chapters");
      setChapters([]);
    } finally {
      setLoading(false);
    }
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{error === "Please log in as an admin to view collections" ? "Authentication Required" : "Error"}</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button 
              onClick={() => navigate('/admin/login')} 
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              Go to Admin Login
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Book Collections</h1>
            <p className="mt-1 text-sm sm:text-base text-gray-500">View all available books and chapters</p>
          </div>
          
          <div className="mt-4 sm:mt-0">
            <button 
              onClick={() => navigate('/admin/dashboard')} 
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </button>
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
                      src={book.bookCoverImgLink} 
                      alt={book.title} 
                      className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500 ease-in-out"
                      onError={(e) => {
                        console.log("Image failed to load:", book.bookCoverImgLink);
                        e.target.onerror = null; // Prevent infinite loop
                        e.target.src = "https://via.placeholder.com/400x600?text=Book+Cover+Not+Available";
                      }}
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <h2 className="font-bold text-lg text-gray-900 line-clamp-1">{book.title}</h2>
                    <p className="text-sm text-gray-600 mb-4">{book.publisher}</p>
                    <div className="mt-auto">
                      <button
                        className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                        onClick={() => fetchChapters(book._id)}
                        disabled={loading}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                        View Chapters
                      </button>
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

            {selectedBook && (
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Chapters
                </h2>
                {loading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                  </div>
                ) : chapters.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {chapters.map((chapter) => (
                      <li key={chapter._id} className="py-3 flex items-center hover:bg-gray-50 rounded-lg px-2 transition-colors duration-150">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-gray-800">{chapter.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-gray-600">No chapters found for this book.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 