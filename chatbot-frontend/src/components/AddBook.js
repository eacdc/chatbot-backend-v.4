import React, { useState } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../config";

const AddBook = () => {
  const [bookData, setBookData] = useState({
    title: "",
    publisher: "",
    subject: "",
    language: "",
    bookCoverImgLink: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setBookData({ ...bookData, [e.target.name]: e.target.value });
    setError(""); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const response = await axios.post(API_ENDPOINTS.ADD_BOOK, bookData);

      if (response.status === 201) {
        setSuccessMessage("✅ Book details have been added successfully!");
        // Reset form after successful submission
        setBookData({
          title: "",
          publisher: "",
          subject: "",
          language: "",
          bookCoverImgLink: "",
        });
      }
    } catch (error) {
      console.error("Error adding book:", error);
      setError(error.response?.data?.message || "❌ Failed to add book. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-[600px]">
        <h2 className="text-2xl font-semibold text-center mb-4">Add a New Book</h2>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Book Title</label>
            <input
              id="title"
              type="text"
              name="title"
              placeholder="Enter book title"
              value={bookData.title}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="publisher" className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
            <input
              id="publisher"
              type="text"
              name="publisher"
              placeholder="Enter publisher name"
              value={bookData.publisher}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              id="subject"
              type="text"
              name="subject"
              placeholder="Enter subject"
              value={bookData.subject}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <input
              id="language"
              type="text"
              name="language"
              placeholder="Enter language"
              value={bookData.language}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="bookCoverImgLink" className="block text-sm font-medium text-gray-700 mb-1">Book Cover Image URL</label>
            <input
              id="bookCoverImgLink"
              type="url"
              name="bookCoverImgLink"
              placeholder="Enter book cover image URL"
              value={bookData.bookCoverImgLink}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className={`${
                loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
              } text-white px-6 py-2 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg font-medium flex items-center`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Adding Book...
                </span>
              ) : (
                'Add Book'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBook;
