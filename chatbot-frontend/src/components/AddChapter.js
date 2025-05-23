import React, { useState, useEffect } from "react";
import axios from "axios";
import adminAxiosInstance, { testEndpoint } from "../utils/adminAxios";
import { API_ENDPOINTS } from "../config";

const AddChapter = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingLoading, setProcessingLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isEnhancedMode, setIsEnhancedMode] = useState(true); // Default to using enhanced mode
  const [autoSaveQnA, setAutoSaveQnA] = useState(true); // Default to auto-save after QnA generation
  const [chapterData, setChapterData] = useState({
    bookId: "",
    title: "",
    rawText: "",
    subject: "",
    finalPrompt: "",
    hasEmbedding: false,
    embedding: null
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

  const toggleProcessingMode = () => {
    setIsEnhancedMode(!isEnhancedMode);
    setSuccessMessage(
      isEnhancedMode 
        ? "Switched to standard processing mode" 
        : "Switched to enhanced processing mode with embeddings and question analysis"
    );
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

    if (!chapterData.title.trim()) {
      setError("Please enter a chapter title");
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

      // Choose endpoint based on the processing mode
      const endpoint = isEnhancedMode 
        ? API_ENDPOINTS.ENHANCED_BATCH_PROCESS 
        : API_ENDPOINTS.PROCESS_TEXT_BATCH;
      
      console.log(`Processing text using ${isEnhancedMode ? 'enhanced' : 'standard'} batch processing`);
      console.log("Text length:", chapterData.rawText.length);
      console.log("Subject:", chapterData.subject);
      
      // Use selected processing endpoint
      const response = await adminAxiosInstance.post(endpoint, 
        { 
          rawText: chapterData.rawText,
          subject: chapterData.subject,
          bookId: chapterData.bookId,
          title: chapterData.title
        }
      );
      
      console.log("Processing response received:", response.status);
      
      if (response.data && response.data.success) {
        if (isEnhancedMode && response.data.chapter) {
          // For enhanced mode with direct save
          console.log("Chapter created with raw text embedding and question analysis");
          
          setSuccessMessage(`Chapter "${response.data.chapter.title}" successfully created with ${response.data.enhancedQuestions.length} analyzed questions!`);
          
          // Reset form
          setChapterData({
            bookId: "",
            title: "",
            rawText: "",
            subject: "",
            finalPrompt: "",
            hasEmbedding: false,
            embedding: null
          });
        } else if (response.data.isQuestionFormat && response.data.questionArray) {
          // Standard processing with question format
          console.log(`Received structured question data with ${response.data.totalQuestions} questions`);
          
          // Store the question array in finalPrompt as JSON string
          setChapterData({
            ...chapterData,
            finalPrompt: response.data.combinedPrompt,
            hasQuestionFormat: true,
            questionCount: response.data.totalQuestions,
            hasEmbedding: !!response.data.hasEmbedding,
            embedding: response.data.embedding || null
          });
          
          setSuccessMessage(`Text successfully processed! ${response.data.totalQuestions} questions extracted with metadata ready to save.`);
        } else if (response.data.combinedPrompt) {
          // Regular text processing
          setChapterData({
            ...chapterData,
            finalPrompt: response.data.combinedPrompt,
            hasQuestionFormat: false,
            hasEmbedding: !!response.data.hasEmbedding,
            embedding: response.data.embedding || null
          });
          
          setSuccessMessage(`Text successfully processed! Ready to save as chapter.`);
        } else {
          setError("Processing did not complete successfully");
        }
      } else if (response.data && response.data.processedText) {
        // Handle response from regular process-text endpoint (for backward compatibility)
        setChapterData({
          ...chapterData,
          finalPrompt: response.data.processedText,
          hasQuestionFormat: false,
          hasEmbedding: false
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

  const handleGenerateQnA = async () => {
    if (!chapterData.rawText.trim()) {
      setError("Please enter some text in the Raw Text field");
      return;
    }

    if (!chapterData.bookId) {
      setError("Please select a book");
      return;
    }

    if (!chapterData.title.trim()) {
      setError("Please enter a chapter title");
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

      // Log the endpoint URL
      console.log("Using QnA endpoint URL:", API_ENDPOINTS.GENERATE_QNA);

      // Use the generate-qna endpoint
      const response = await adminAxiosInstance.post(
        API_ENDPOINTS.GENERATE_QNA, 
        { 
          rawText: chapterData.rawText,
          subject: chapterData.subject,
          bookId: chapterData.bookId,
          title: chapterData.title,
          saveChapter: autoSaveQnA
        }
      );
      
      console.log("QnA generation response received:", response.status);
      console.log("Response data:", response.data); // Log the full response data
      
      if (response.data && response.data.success) {
        // Check if analyzedQuestions exists in the response
        if (!response.data.analyzedQuestions || !Array.isArray(response.data.analyzedQuestions)) {
          console.error("Response has success: true but no analyzedQuestions array");
          setError("Invalid response format from server. Missing questions data.");
          return;
        }
        
        // Store the analyzed questions in finalPrompt as JSON string
        console.log("Analyzed questions:", response.data.analyzedQuestions); // Log the analyzed questions
        setChapterData({
          ...chapterData,
          finalPrompt: JSON.stringify(response.data.analyzedQuestions, null, 2),
          hasQuestionFormat: true,
          questionCount: response.data.analyzedQuestions.length
        });
        
        if (autoSaveQnA) {
          setSuccessMessage(`Successfully generated ${response.data.analyzedQuestions.length} questions and saved chapter!`);
          
          // Reset the form if auto-save was enabled
          setTimeout(() => {
            setChapterData({
              bookId: "",
              title: "",
              rawText: "",
              subject: "",
              finalPrompt: "",
              hasEmbedding: false,
              embedding: null,
              hasQuestionFormat: false,
              questionCount: 0
            });
          }, 2000);
        } else {
          setSuccessMessage(`Successfully generated ${response.data.analyzedQuestions.length} questions with analysis! Click "Add Chapter" to save.`);
        }
      } else {
        setError("Failed to generate QnA");
      }
    } catch (error) {
      console.error("Error generating QnA:", error);
      
      // Error handling
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", JSON.stringify(error.response.data));
        
        if (error.response.status === 401) {
          setError("Authentication failed. Please log in again as an admin.");
          return;
        }
        
        if (error.response.status === 504) {
          setError("Processing timed out. The text may be too complex. Please try again with smaller text.");
          return;
        }
      } else if (error.request) {
        console.error("No response received from server");
        setError("No response received from server. Please check your connection.");
        return;
      }
      
      setError(error.response?.data?.error || error.message || "Failed to generate QnA. Please try again.");
    } finally {
      setProcessingLoading(false);
    }
  };

  // Add a test function to directly check the endpoint
  const testGenerateQnA = async () => {
    try {
      setProcessingLoading(true);
      setError("");
      setSuccessMessage("Testing endpoint directly...");
      
      // Minimal test data
      const testData = {
        rawText: "This is a test text. Physics is the study of matter and energy.",
        bookId: chapterData.bookId || "6819ddc8ec8dd4bcc19b9207", // Use current or fallback ID
        title: "Test Chapter",
        subject: "SCIENCE",
        saveChapter: false
      };
      
      console.log("Testing endpoint with data:", testData);
      
      // Test using direct function
      const response = await testEndpoint(API_ENDPOINTS.GENERATE_QNA, testData);
      
      if (response.data && response.data.success) {
        setSuccessMessage("Test successful! Check the console for details.");
      } else {
        setError("Test received a response but without success flag.");
      }
    } catch (error) {
      console.error("Test error:", error);
      setError(`Test failed: ${error.message}`);
    } finally {
      setProcessingLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    // In enhanced mode with direct save, we don't need to submit manually
    if (isEnhancedMode && successMessage.includes("successfully created")) {
      setLoading(false);
      return;
    }
  
    if (!chapterData.finalPrompt) {
      setError("Please process the text or generate QnA before adding the chapter");
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
  
    let dataToSubmit;
    
    // If we have generated QnA questions, we need to format them differently
    if (chapterData.hasQuestionFormat && chapterData.finalPrompt) {
      try {
        // Parse the finalPrompt back to an array
        const analyzedQuestions = JSON.parse(chapterData.finalPrompt);
        
        dataToSubmit = {
          bookId: chapterData.bookId,
          title: chapterData.title,
          subject: chapterData.subject,
          prompt: JSON.stringify(analyzedQuestions), // Save the questions as a JSON string
          rawText: chapterData.rawText, // Include raw text for storage
          questionPrompt: analyzedQuestions // Send as proper array for the backend to process
        };
      } catch (error) {
        console.error("Error parsing finalPrompt JSON:", error);
        setError("Invalid question format. Please regenerate the QnA.");
        setLoading(false);
        return;
      }
    } else {
      // Standard format
      dataToSubmit = {
        bookId: chapterData.bookId,
        title: chapterData.title,
        subject: chapterData.subject,
        prompt: chapterData.finalPrompt,
        rawText: chapterData.rawText // Include raw text for storage
      };
    }
    
    // Add embedding if it exists
    if (chapterData.hasEmbedding && chapterData.embedding) {
      dataToSubmit.embedding = chapterData.embedding;
    }
  
    try {
      const response = await adminAxiosInstance.post(API_ENDPOINTS.ADD_CHAPTER, dataToSubmit);
      
      if (response.status === 201) {
        setSuccessMessage(`Chapter "${response.data.title}" added successfully!`);
        
        // Reset form
        setChapterData({
          bookId: "",
          title: "",
          rawText: "",
          subject: "",
          finalPrompt: "",
          hasEmbedding: false,
          embedding: null,
          hasQuestionFormat: false,
          questionCount: 0
        });
      } else {
        setError("Failed to add chapter. Please try again.");
      }
    } catch (error) {
      console.error("Error adding chapter:", error);
      setError(error.response?.data?.error || "Failed to add chapter. Please try again.");
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
                  
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">Processing Mode</label>
                    <div className="mt-1">
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={toggleProcessingMode}
                          className={`px-4 py-2 text-sm font-medium rounded-md ${
                            isEnhancedMode 
                              ? "bg-indigo-100 text-indigo-800 border border-indigo-300" 
                              : "bg-gray-100 text-gray-700 border border-gray-300"
                          }`}
                        >
                          {isEnhancedMode ? "Enhanced Mode (with embeddings)" : "Standard Mode"}
                        </button>
                        <div className="ml-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isEnhancedMode 
                              ? "bg-indigo-100 text-indigo-800" 
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {isEnhancedMode ? "AI analysis + embeddings" : "Basic processing"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700">QnA Options</label>
                    <div className="mt-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={autoSaveQnA}
                          onChange={() => setAutoSaveQnA(!autoSaveQnA)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-600">Auto-save chapter after generating QnA</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        When enabled, the chapter will be saved automatically after questions are generated
                      </p>
                      <div className="mt-2 flex items-center">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Uses vector embeddings for semantic question analysis
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium text-gray-900">Raw Text</h2>
                    <div className="flex-shrink-0 flex space-x-2">
                      <button 
                        type="button" 
                        onClick={handleGenerateQnA}
                        disabled={processingLoading}
                        className={`${processingLoading ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'} text-white px-4 py-2 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 inline-flex items-center text-sm font-medium`}
                      >
                        {processingLoading ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating QnA...
                          </span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Generate QnA
                          </>
                        )}
                      </button>
                      
                      {/* Diagnostic Test Button */}
                      <button 
                        type="button" 
                        onClick={testGenerateQnA}
                        disabled={processingLoading}
                        className="ml-2 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 inline-flex items-center text-xs font-medium"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Test API
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
                    <div className="flex items-center space-x-2">
                      {chapterData.hasEmbedding && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          With Embeddings
                        </span>
                      )}
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