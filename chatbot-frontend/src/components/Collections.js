import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../config";

export default function Collections() {
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in to view chapters");
        return;
      }
      const response = await axios.get(API_ENDPOINTS.GET_BOOK_CHAPTERS.replace(':bookId', bookId), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
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

      alert(response.data.message);
    } catch (error) {
      console.error("Subscription error:", error.response?.data?.error || error.message);
      setError(error.response?.data?.error || "Subscription failed");
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="p-6 bg-gray-100 min-h-screen flex items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-lg text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.href = '/login'} 
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Collections</h1>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {books.map((book) => (
            <div key={book._id} className="bg-white shadow-lg rounded-lg p-3 sm:p-4">
              <img 
                src={book.bookCoverImgLink} 
                alt={book.title} 
                className="w-full h-32 sm:h-40 object-cover rounded-md" 
              />
              <h2 className="text-base sm:text-lg font-semibold mt-2 sm:mt-3">{book.title}</h2>
              <p className="text-sm text-gray-600">{book.publisher}</p>
              <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <button
                  className="bg-blue-500 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-600 text-sm sm:text-base"
                  onClick={() => fetchChapters(book._id)}
                  disabled={loading}
                >
                  View Chapters
                </button>
                <button
                  className="bg-green-500 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-600 text-sm sm:text-base"
                  onClick={() => handleSubscribe(book._id)}
                  disabled={loading}
                >
                  Subscribe
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedBook && (
        <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-white shadow-lg rounded-lg">
          <h2 className="text-lg sm:text-xl font-bold">Chapters</h2>
          {loading ? (
            <div className="flex justify-center items-center h-24 sm:h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : chapters.length > 0 ? (
            <ul className="mt-2">
              {chapters.map((chapter) => (
                <li key={chapter._id} className="p-2 border-b border-gray-300 text-sm sm:text-base">{chapter.title}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm sm:text-base">No chapters found for this book.</p>
          )}
        </div>
      )}
    </div>
  );
}
