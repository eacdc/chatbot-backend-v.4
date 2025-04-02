import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../config";

const AddChapter = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [qnaLoading, setQnaLoading] = useState(false);
  const [finalPromptLoading, setFinalPromptLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [chapterData, setChapterData] = useState({
    bookId: "",
    title: "",
    rawText: "",
    goodText: "",
    subject: "",
    grade: "1",
    specialInstructions: "",
    qnaOutput: "",
    finalPrompt: ""
  });

  // Grade options
  const gradeOptions = [
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "College Student"
  ];

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
    setChapterData({ ...chapterData, [e.target.name]: e.target.value });
    setError(""); // Clear error when user types
  };

  const handleGoodText = async () => {
    if (!chapterData.rawText.trim()) {
      setError("Please enter some text in the Raw Text field");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in to continue");
        setLoading(false);
        return;
      }

      console.log("Sending request to process text...");
      const response = await axios.post(API_ENDPOINTS.PROCESS_TEXT, 
        { rawText: chapterData.rawText },
        { 
          headers: { 
            'Authorization': `Bearer ${token}` 
          } 
        }
      );
      
      console.log("Response received:", response.status);
      setChapterData({
        ...chapterData,
        goodText: response.data.processedText
      });
      setSuccessMessage("Text processed successfully!");
    } catch (error) {
      console.error("Error processing text:", error);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
      setError(error.response?.data?.message || "Failed to process text. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMakeQnA = async () => {
    if (!chapterData.subject.trim()) {
      setError("Please enter a subject");
      return;
    }

    if (!chapterData.goodText.trim() && !chapterData.rawText.trim()) {
      setError("Please provide content in either Raw Text or Good Text field");
      return;
    }

    setQnaLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in to continue");
        setQnaLoading(false);
        return;
      }

      console.log("Sending request to generate QnA...");
      const response = await axios.post(API_ENDPOINTS.GENERATE_QNA, 
        {
          subject: chapterData.subject,
          grade: chapterData.grade,
          text: chapterData.goodText || chapterData.rawText,
          specialInstructions: chapterData.specialInstructions
        },
        { 
          headers: { 
            'Authorization': `Bearer ${token}` 
          } 
        }
      );
      
      console.log("Response received:", response.status);
      setChapterData({
        ...chapterData,
        qnaOutput: response.data.qnaOutput
      });
      setSuccessMessage("QnA generated successfully!");
    } catch (error) {
      console.error("Error generating QnA:", error);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
      setError(error.response?.data?.message || "Failed to generate QnA. Please try again.");
    } finally {
      setQnaLoading(false);
    }
  };

  const handleGetFinalPrompt = async () => {
    if (!chapterData.qnaOutput.trim()) {
      setError("Please generate QnA first");
      return;
    }

    setFinalPromptLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in to continue");
        setFinalPromptLoading(false);
        return;
      }

      console.log("Sending request to generate final prompt...");
      const response = await axios.post(API_ENDPOINTS.GENERATE_FINAL_PROMPT, 
        {
          subject: chapterData.subject,
          grade: chapterData.grade,
          specialInstructions: chapterData.specialInstructions,
          qnaOutput: chapterData.qnaOutput
        },
        { 
          headers: { 
            'Authorization': `Bearer ${token}` 
          } 
        }
      );
      
      console.log("Response received:", response.status);
      setChapterData({
        ...chapterData,
        finalPrompt: response.data.finalPrompt
      });
      setSuccessMessage("Final prompt generated successfully!");
    } catch (error) {
      console.error("Error generating final prompt:", error);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
      setError(error.response?.data?.message || "Failed to generate final prompt. Please try again.");
    } finally {
      setFinalPromptLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
  
    const dataToSubmit = {
      bookId: chapterData.bookId,
      title: chapterData.title,
      prompt: chapterData.finalPrompt || chapterData.goodText || chapterData.rawText
    };
    
    try {
      const response = await axios.post(API_ENDPOINTS.ADD_CHAPTER, dataToSubmit);
      
      if (response.status === 201) {
        setSuccessMessage("Chapter added successfully!");
        // Reset form after successful submission
        setChapterData({
          bookId: "",
          title: "",
          rawText: "",
          goodText: "",
          subject: "",
          grade: "1",
          specialInstructions: "",
          qnaOutput: "",
          finalPrompt: ""
        });
      }
    } catch (error) {
      console.error("Error adding chapter:", error);
      setError(error.response?.data?.message || "Failed to add chapter. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-8">Add New Chapter</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded relative mb-4 text-sm sm:text-base" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 sm:px-4 sm:py-3 rounded relative mb-4 text-sm sm:text-base" role="alert">
          <span className="block sm:inline">{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Book</label>
            <select
              name="bookId"
              value={chapterData.bookId}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg text-sm sm:text-base"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Chapter Title</label>
            <input
              type="text"
              name="title"
              value={chapterData.title}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg text-sm sm:text-base"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Subject</label>
            <input
              type="text"
              name="subject"
              value={chapterData.subject}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg text-sm sm:text-base"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Grade</label>
            <select
              name="grade"
              value={chapterData.grade}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg text-sm sm:text-base"
              required
            >
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  Grade {grade}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="transition-all duration-200 hover:shadow-md p-2 sm:p-3 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Raw Text</label>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <textarea
              name="rawText"
              placeholder="Enter Raw Text Content"
              value={chapterData.rawText}
              onChange={handleChange}
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-32 sm:h-48 resize-none text-sm sm:text-base"
              required
            />
            <button 
              type="button" 
              onClick={handleGoodText}
              disabled={loading}
              className={`${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-3 sm:px-4 py-2 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg font-medium whitespace-nowrap self-start flex items-center justify-center text-sm sm:text-base`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Get Good Text'
              )}
            </button>
          </div>
        </div>

        <div className="transition-all duration-200 hover:shadow-md p-2 sm:p-3 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Good Text</label>
          <textarea
            name="goodText"
            placeholder="Processed text will appear here"
            value={chapterData.goodText}
            onChange={handleChange}
            className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-32 sm:h-48 resize-none text-sm sm:text-base"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="col-span-1 sm:col-span-2 flex flex-col transition-all duration-200 hover:shadow-md p-2 sm:p-3 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Special Instructions</label>
            <div className="flex flex-col space-y-2 h-full">
              <textarea
                name="specialInstructions"
                placeholder="100 chars max"
                value={chapterData.specialInstructions}
                onChange={handleChange}
                className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 flex-grow resize-none text-sm sm:text-base"
                maxLength="100"
              />
              <button 
                type="button" 
                onClick={handleMakeQnA}
                disabled={qnaLoading}
                className={`${qnaLoading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-3 sm:px-4 py-2 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg font-medium whitespace-nowrap text-sm sm:text-base`}
              >
                {qnaLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                ) : (
                  'Make QnA'
                )}
              </button>
            </div>
          </div>

          <div className="col-span-1 sm:col-span-2 transition-all duration-200 hover:shadow-md p-2 sm:p-3 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">QnA Output</label>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <textarea
                name="qnaOutput"
                placeholder="QnA Output will appear here"
                value={chapterData.qnaOutput}
                onChange={handleChange}
                className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-32 resize-none text-sm sm:text-base"
              />
              <button 
                type="button" 
                onClick={handleGetFinalPrompt}
                disabled={finalPromptLoading}
                className={`${finalPromptLoading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'} text-white px-3 sm:px-4 py-2 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg font-medium whitespace-nowrap self-start text-sm sm:text-base`}
              >
                {finalPromptLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                ) : (
                  'Get Final Prompt'
                )}
              </button>
            </div>
          </div>

          <div className="col-span-1 sm:col-span-2 transition-all duration-200 hover:shadow-md p-2 sm:p-3 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Final Prompt</label>
            <textarea
              name="finalPrompt"
              placeholder="Final prompt to be sent to backend"
              value={chapterData.finalPrompt}
              onChange={handleChange}
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-32 resize-none text-sm sm:text-base"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className={`${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 sm:px-6 py-2 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg font-medium text-sm sm:text-base`}
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
              'Add Chapter'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddChapter;