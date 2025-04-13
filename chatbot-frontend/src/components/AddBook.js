import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import adminAxiosInstance from "../utils/adminAxios";
import { API_ENDPOINTS } from "../config";
import { useNavigate } from "react-router-dom";

const AddBook = () => {
  // Grade options
  const gradeOptions = [
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "College Student", "Other"
  ];

  const [bookData, setBookData] = useState({
    title: "",
    publisher: "",
    subject: "",
    language: "",
    grade: "1",
    bookCoverImgLink: "",
  });
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Check if admin is logged in
  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");
    if (!adminToken) {
      navigate("/admin-login");
    }
  }, [navigate]);

  const handleChange = (e) => {
    setBookData({ ...bookData, [e.target.name]: e.target.value });
    setError(""); // Clear error when user types
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedImage(file);
      // Create a preview URL for the image
      const fileUrl = URL.createObjectURL(file);
      setPreviewUrl(fileUrl);
      // Clear the bookCoverImgLink field since we're using an upload
      setBookData({ ...bookData, bookCoverImgLink: "" });
    }
  };

  const handleUrlChange = (e) => {
    setBookData({ ...bookData, bookCoverImgLink: e.target.value });
    // Clear the uploaded image since we're using a URL
    setUploadedImage(null);
    setPreviewUrl("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      // Check for admin token 
      const adminToken = localStorage.getItem("adminToken");
      if (!adminToken) {
        setError("Please log in as an admin to continue");
        setLoading(false);
        return;
      }

      let coverImageUrl = bookData.bookCoverImgLink;

      // If we have an uploaded image, upload it to the server first
      if (uploadedImage) {
        const formData = new FormData();
        formData.append("coverImage", uploadedImage);
        
        const uploadResponse = await adminAxiosInstance.post(
          API_ENDPOINTS.UPLOAD_BOOK_COVER, 
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
        
        if (uploadResponse.data && uploadResponse.data.imageUrl) {
          coverImageUrl = uploadResponse.data.imageUrl;
        } else {
          throw new Error("Failed to upload image");
        }
      }

      // Now submit the book data with the image URL
      const response = await adminAxiosInstance.post(
        API_ENDPOINTS.ADD_BOOK, 
        { ...bookData, bookCoverImgLink: coverImageUrl }
      );

      if (response.status === 201) {
        setSuccessMessage("✅ Book details have been added successfully!");
        // Reset form after successful submission
        setBookData({
          title: "",
          publisher: "",
          subject: "",
          language: "",
          grade: "1",
          bookCoverImgLink: "",
        });
        setUploadedImage(null);
        setPreviewUrl("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (error) {
      console.error("Error adding book:", error);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
        
        // Handle specific error cases
        if (error.response.status === 401) {
          setError("Authentication failed. Please log in again as an admin.");
          return;
        }
      }
      setError(error.response?.data?.message || error.response?.data?.error || "❌ Failed to add book. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header with navigation buttons */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 py-4 px-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Add New Book</h1>
          <div className="flex space-x-3">
            <a href="/admin/dashboard" className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-100 bg-indigo-800 hover:bg-indigo-900 focus:outline-none focus:border-indigo-900 focus:shadow-outline-indigo transition duration-150 ease-in-out">
              <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </a>
            <a href="/collections" className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-100 bg-indigo-800 hover:bg-indigo-900 focus:outline-none focus:border-indigo-900 focus:shadow-outline-indigo transition duration-150 ease-in-out">
              <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              View Collections
            </a>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex justify-center items-center flex-grow py-8">
        <div className="bg-white p-8 rounded-lg shadow-lg w-[600px]">
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
              <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
              <div className="flex space-x-2">
                <select
                  id="grade-select"
                  value={bookData.grade}
                  onChange={(e) => {
                    if (e.target.value !== "custom") {
                      setBookData({ ...bookData, grade: e.target.value });
                    }
                  }}
                  className="w-1/2 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {gradeOptions.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade === "College Student" || grade === "Other" ? grade : `Grade ${grade}`}
                    </option>
                  ))}
                  <option value="custom">Custom Grade...</option>
                </select>
                <input
                  id="grade"
                  type="text"
                  name="grade"
                  placeholder="Enter grade"
                  value={bookData.grade}
                  onChange={handleChange}
                  className="w-1/2 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Book Cover Image</label>
              
              {/* Upload option */}
              <div className="mb-3">
                <label className="block text-sm text-gray-600 mb-1">Upload from your device</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              
              {/* URL option */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Or provide an image URL</label>
                <input
                  id="bookCoverImgLink"
                  type="url"
                  name="bookCoverImgLink"
                  placeholder="Enter book cover image URL"
                  value={bookData.bookCoverImgLink}
                  onChange={handleUrlChange}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              {/* Image preview */}
              {(previewUrl || bookData.bookCoverImgLink) && (
                <div className="mt-3">
                  <p className="text-sm text-gray-600 mb-1">Preview:</p>
                  <div className="w-32 h-40 bg-gray-100 border rounded-md overflow-hidden">
                    <img 
                      src={previewUrl || bookData.bookCoverImgLink} 
                      alt="Book cover preview" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://via.placeholder.com/128x160?text=No+Image";
                      }}
                    />
                  </div>
                </div>
              )}
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
    </div>
  );
};

export default AddBook;
