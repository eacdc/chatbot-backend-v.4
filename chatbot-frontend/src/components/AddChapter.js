import React, { useState, useEffect } from "react";
import axios from "axios";
import adminAxiosInstance from "../utils/adminAxios";
import { API_ENDPOINTS } from "../config";

const AddChapter = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingLoading, setProcessingLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [chapterData, setChapterData] = useState({
    bookId: "",
    title: "",
    rawText: "",
    subject: "",
    finalPrompt: ""
  });

  // Fetch books for dropdown
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        const response = await axios.get(API_ENDPOINTS.GET_BOOKS);
        setBooks(response.data);
      } catch (error) {
        console.error("Error fetching books:", error);
        setError("Failed to fetch books. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // If book selection changes, update the subject based on the selected book
    if (name === "bookId" && value) {
      const selectedBook = books.find((book) => book._id === value);
      if (selectedBook) {
        setChapterData({ 
          ...chapterData, 
          [name]: value,
          subject: selectedBook.subject
        });
        console.log(`Selected book: ${selectedBook.title}, subject: ${selectedBook.subject}`);
      } else {
        setChapterData({ ...chapterData, [name]: value });
      }
    } else {
      setChapterData({ ...chapterData, [name]: value });
    }
    
    setError(""); // Clear error when user types
  };

  const handleProcessText = async () => {
    if (!chapterData.rawText.trim()) {
      setError("Please enter some text in the Raw Text field");
      return;
    }

    if (!chapterData.bookId) {
      setError("Please select a book");
      return;
    }

    if (!chapterData.subject) {
      const selectedBook = books.find((book) => book._id === chapterData.bookId);
      if (selectedBook && selectedBook.subject) {
        // Update subject if it's not set but book is selected
        setChapterData(prevData => ({
          ...prevData,
          subject: selectedBook.subject
        }));
      } else {
        setError("Could not determine subject from selected book");
        return;
      }
    }

    setProcessingLoading(true);
    setError("");
    setSuccessMessage("");
    
    try {
      const adminToken = localStorage.getItem("adminToken");
      if (!adminToken) {
        setError("Please log in as an admin to continue");
        setProcessingLoading(false);
        return;
      }

      console.log("Processing text using batch processing");
      console.log("Text length:", chapterData.rawText.length);
      console.log("Subject:", chapterData.subject);
      
      // Use batch processing endpoint for text processing
      const response = await adminAxiosInstance.post(API_ENDPOINTS.PROCESS_TEXT_BATCH, 
        { 
          rawText: chapterData.rawText,
          subject: chapterData.subject
        }
      );
      
      console.log("Processing response received:", response.status);
      
      if (response.data && response.data.success) {
        // Check if response contains structured question data
        if (response.data.isQuestionFormat && response.data.questionArray) {
          console.log(`Received structured question data with ${response.data.totalQuestions} questions`);
          
          // Store the question array in finalPrompt as JSON string
          setChapterData({
            ...chapterData,
            finalPrompt: response.data.combinedPrompt,
            hasQuestionFormat: true,
            questionCount: response.data.totalQuestions
          });
          
          setSuccessMessage(`Text successfully processed! ${response.data.totalQuestions} questions extracted and ready to save.`);
        } else if (response.data.combinedPrompt) {
          // Regular text processing
          setChapterData({
            ...chapterData,
            finalPrompt: response.data.combinedPrompt,
            hasQuestionFormat: false
          });
          setSuccessMessage("Text successfully processed! Ready to save as chapter.");
        } else {
          setError("Processing did not complete successfully");
        }
      } else if (response.data && response.data.processedText) {
        // Handle response from regular process-text endpoint (for backward compatibility)
        setChapterData({
          ...chapterData,
          finalPrompt: response.data.processedText,
          hasQuestionFormat: false
        });
        setSuccessMessage("Text processed successfully! Ready to save as chapter.");
      } else {
        setError("Text processing did not complete successfully");
      }
    } catch (error) {
      console.error("Error in text processing:", error);
      
      // Error logging
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", JSON.stringify(error.response.data));
        
        // Handle specific error cases
        if (error.response.status === 401) {
          setError("Authentication failed. Please log in again as an admin.");
          return;
        }
        
        if (error.response.status === 504) {
          setError("Processing timed out. The text may be too complex. Please try again later or try processing in multiple sessions.");
          return;
        }
        
        if (error.response.status === 500) {
          setError("Server error during processing. Please try again later.");
          return;
        }
      } else if (error.request) {
        console.error("No response received from server");
        setError("No response received from server. Please check your connection and try again later.");
        return;
      }
      
      setError(error.response?.data?.error || error.response?.data?.message || "Failed during text processing. Please try again.");
    } finally {
      setProcessingLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
  
    if (!chapterData.finalPrompt) {
      setError("Please process the text before adding the chapter");
      setLoading(false);
      return;
    }

    if (!chapterData.subject) {
      const selectedBook = books.find((book) => book._id === chapterData.bookId);
      if (selectedBook && selectedBook.subject) {
        // Ensure subject is set before submission
        setChapterData(prevData => ({
          ...prevData,
          subject: selectedBook.subject
        }));
      } else {
        setError("Could not determine subject from selected book");
        setLoading(false);
        return;
      }
    }
    
    const dataToSubmit = {
      bookId: chapterData.bookId,
      title: chapterData.title,
      subject: chapterData.subject,
      prompt: chapterData.finalPrompt
    };
    
    try {
      const adminToken = localStorage.getItem("adminToken");
      if (!adminToken) {
        setError("Please log in as an admin to continue");
        setLoading(false);
        return;
      }

      console.log("Sending request to add chapter with admin token...");
      console.log("Chapter data:", { 
        bookId: dataToSubmit.bookId, 
        title: dataToSubmit.title, 
        subject: dataToSubmit.subject,
        promptLength: dataToSubmit.prompt.length 
      });
      
      const response = await adminAxiosInstance.post(
        API_ENDPOINTS.ADD_CHAPTER, 
        dataToSubmit
      );
      
      if (response.status === 201) {
        setSuccessMessage("Chapter added successfully!");
        // Reset form after successful submission
        setChapterData({
          bookId: "",
          title: "",
          rawText: "",
          subject: "",
          finalPrompt: ""
        });
      }
    } catch (error) {
      console.error("Error adding chapter:", error);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
        
        // Handle specific error cases
        if (error.response.status === 401) {
          setError("Authentication failed. Please log in again as an admin.");
          return;
        }
      }
      setError(error.response?.data?.error || error.response?.data?.message || "Failed to add chapter. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-6 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-4 py-5 sm:px-6 bg-gradient-to-r from-blue-600 to-indigo-700">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Add New Chapter</h1>
                <p className="mt-1 text-sm text-blue-100">Create educational content for students</p>
              </div>
              <div className="hidden sm:flex space-x-3">
                <a href="/admin/dashboard" className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-5 font-medium rounded-md text-indigo-100 bg-indigo-800 hover:bg-indigo-900 focus:outline-none focus:border-indigo-900 focus:shadow-outline-indigo transition duration-150 ease-in-out">
                  <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back
                </a>
                <a href="/admin/collections" className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-5 font-medium rounded-md text-indigo-100 bg-indigo-800 hover:bg-indigo-900 focus:outline-none focus:border-indigo-900 focus:shadow-outline-indigo transition duration-150 ease-in-out">
                  <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  View Collections
                </a>
              </div>
            </div>
          </div>
          
          <div className="px-4 py-5 sm:p-6">
            {error && (
              <div className="rounded-md bg-red-50 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm leading-5 text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            {successMessage && (
              <div className="rounded-md bg-green-50 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm leading-5 text-green-700">{successMessage}</p>
                  </div>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Book</label>
                    <div className="mt-1">
                      <select
                        name="bookId"
                        value={chapterData.bookId}
                        onChange={handleChange}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md transition-colors duration-200"
                        required
                      >
                        <option value="">Select a book</option>
                        {books.map((book) => (
                          <option key={book._id} value={book._id}>
                            {book.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Subject</label>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="subject"
                        value={chapterData.subject}
                        readOnly
                        className="shadow-sm bg-gray-100 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md transition-colors duration-200"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        This field is automatically populated based on the selected book
                      </p>
                    </div>
                  </div>
                  
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Chapter Title</label>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="title"
                        value={chapterData.title}
                        onChange={handleChange}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md transition-colors duration-200"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium text-gray-900">Raw Text</h2>
                    <div className="flex-shrink-0">
                      <button 
                        type="button" 
                        onClick={handleProcessText}
                        disabled={processingLoading}
                        className={`${processingLoading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 inline-flex items-center text-sm font-medium`}
                      >
                        {processingLoading ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                            Process Text
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <textarea
                      name="rawText"
                      placeholder="Enter raw text content here..."
                      value={chapterData.rawText}
                      onChange={handleChange}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border border-gray-300 rounded-md h-64 transition-colors duration-200"
                      required
                    />
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium text-gray-900">Final Prompt</h2>
                    <div className="flex-shrink-0">
                      <span className="text-sm text-gray-500">
                        Processed text will appear here automatically
                      </span>
                    </div>
                  </div>
                  <div>
                    <textarea
                      name="finalPrompt"
                      placeholder="Processed text will appear here after clicking 'Process Text'..."
                      value={chapterData.finalPrompt}
                      onChange={handleChange}
                      className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border border-gray-300 rounded-md h-64 transition-colors duration-200"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className={`${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 py-3 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-medium inline-flex items-center`}
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding Chapter...
                    </span>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Chapter
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddChapter;