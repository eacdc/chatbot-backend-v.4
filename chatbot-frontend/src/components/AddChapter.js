import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../config";

const AddChapter = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [qnaLoading, setQnaLoading] = useState(false);
  const [finalPromptLoading, setFinalPromptLoading] = useState(false);
  const [chapterData, setChapterData] = useState({
    bookId: "",
    title: "",
    rawText: "",
    goodText: "",
    subject: "",
    grade: "1", // Default to grade 1
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
        const response = await axios.get("http://localhost:5000/api/books");
        setBooks(response.data);
      } catch (error) {
        console.error("Error fetching books:", error);
      }
    };
    fetchBooks();
  }, []);

  const handleChange = (e) => {
    setChapterData({ ...chapterData, [e.target.name]: e.target.value });
  };

  const handleGoodText = async () => {
    // Check if raw text is empty
    if (!chapterData.rawText.trim()) {
      alert("Please enter some text in the Raw Text field");
      return;
    }

    setLoading(true);
    try {
      // Send raw text to backend for processing
      const response = await axios.post("http://localhost:5000/api/chapters/process-text", {
        rawText: chapterData.rawText
      });
      
      // Update good text with the processed text from OpenAI
      setChapterData({
        ...chapterData,
        goodText: response.data.processedText
      });
    } catch (error) {
      console.error("Error processing text:", error);
      alert("Failed to process text. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMakeQnA = async () => {
    // Check if required fields are filled
    if (!chapterData.subject.trim()) {
      alert("Please enter a subject");
      return;
    }

    if (!chapterData.goodText.trim() && !chapterData.rawText.trim()) {
      alert("Please provide content in either Raw Text or Good Text field");
      return;
    }

    setQnaLoading(true);
    try {
      // Send data to backend for QnA generation
      const response = await axios.post("http://localhost:5000/api/chapters/generate-qna", {
        subject: chapterData.subject,
        grade: chapterData.grade,
        text: chapterData.goodText || chapterData.rawText,
        specialInstructions: chapterData.specialInstructions
      });
      
      // Update QnA output with the response from OpenAI
      setChapterData({
        ...chapterData,
        qnaOutput: response.data.qnaOutput
      });
    } catch (error) {
      console.error("Error generating QnA:", error);
      alert("Failed to generate QnA. Please try again.");
    } finally {
      setQnaLoading(false);
    }
  };

  const handleGetFinalPrompt = async () => {
    // Check if QnA output exists
    if (!chapterData.qnaOutput.trim()) {
      alert("Please generate QnA first");
      return;
    }

    setFinalPromptLoading(true);
    try {
      // Construct the message to send to OpenAI
      const userMessage = `
Subject: ${chapterData.subject}
Grade: ${chapterData.grade}
Special Instructions: ${chapterData.specialInstructions}

QnA Content:
${chapterData.qnaOutput}
`;

      // Send to the backend for final prompt generation
      const response = await axios.post("http://localhost:5000/api/chapters/generate-final-prompt", {
        subject: chapterData.subject,
        grade: chapterData.grade,
        specialInstructions: chapterData.specialInstructions,
        qnaOutput: chapterData.qnaOutput
      });
      
      // Update final prompt with the generated content
      setChapterData({
        ...chapterData,
        finalPrompt: response.data.finalPrompt
      });
      
    } catch (error) {
      console.error("Error generating final prompt:", error);
      alert("Failed to generate final prompt. Please try again.");
    } finally {
      setFinalPromptLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    const dataToSubmit = {
      bookId: chapterData.bookId,
      title: chapterData.title,
      prompt: chapterData.finalPrompt || chapterData.goodText || chapterData.rawText // Use finalPrompt if available, otherwise use goodText, then rawText
    };
    
    try {
      const response = await axios.post(API_ENDPOINTS.ADD_CHAPTER, dataToSubmit);
      
      if (response.status === 201) {
        // Show confirmation popup
        if (window.confirm("Chapter has been added successfully! Click OK to proceed.")) {
          window.location.reload(); // Refresh the page after clicking OK
        }
      }
    } catch (error) {
      console.error("Error adding chapter:", error);
      alert("Failed to add chapter. Please try again.");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="bg-white p-8 rounded-xl shadow-xl w-[800px] border border-gray-100">
        <h2 className="text-2xl font-bold text-center mb-6 text-indigo-700">Add a New Chapter</h2>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Book selection dropdown */}
          <div className="transition-all duration-200 hover:shadow-md p-3 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Book</label>
            <select
              name="bookId"
              value={chapterData.bookId}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              required
            >
              <option value="">Select Book</option>
              {books.map((book) => (
                <option key={book._id} value={book._id}>{book.title}</option>
              ))}
            </select>
          </div>

          <div className="transition-all duration-200 hover:shadow-md p-3 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">Chapter Title</label>
            <input
              type="text"
              name="title"
              placeholder="Enter chapter title"
              value={chapterData.title}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div className="transition-all duration-200 hover:shadow-md p-3 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">Raw Text</label>
            <div className="flex space-x-2">
              <textarea
                name="rawText"
                placeholder="Enter Raw Text Content"
                value={chapterData.rawText}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-48 resize-none"
                required
              />
              <button 
                type="button" 
                onClick={handleGoodText}
                disabled={loading}
                className={`${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg font-medium whitespace-nowrap self-start flex items-center`}
              >
                {loading ? 'Processing...' : 'Get Good Text'}
              </button>
            </div>
          </div>

          <div className="transition-all duration-200 hover:shadow-md p-3 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">Good Text</label>
            <textarea
              name="goodText"
              placeholder="Processed text will appear here"
              value={chapterData.goodText}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-48 resize-none"
            />
          </div>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-4 transition-all duration-200 hover:shadow-md p-3 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <input
                type="text"
                name="subject"
                placeholder="20 chars max"
                value={chapterData.subject}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                maxLength="20"
              />
            </div>
            
            <div className="col-span-4 transition-all duration-200 hover:shadow-md p-3 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
              <select
                name="grade"
                value={chapterData.grade}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
            
            <div className="col-span-4 flex flex-col transition-all duration-200 hover:shadow-md p-3 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions</label>
              <div className="flex flex-col space-y-2 h-full">
                <textarea
                  name="specialInstructions"
                  placeholder="100 chars max"
                  value={chapterData.specialInstructions}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 flex-grow resize-none"
                  maxLength="100"
                />
                <button 
                  type="button" 
                  onClick={handleMakeQnA}
                  disabled={qnaLoading}
                  className={`${qnaLoading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 py-2 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg font-medium whitespace-nowrap`}
                >
                  {qnaLoading ? 'Generating...' : 'Make QnA'}
                </button>
              </div>
            </div>
          </div>

          <div className="transition-all duration-200 hover:shadow-md p-3 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">QnA Output</label>
            <div className="flex space-x-2">
              <textarea
                name="qnaOutput"
                placeholder="QnA Output will appear here"
                value={chapterData.qnaOutput}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-32 resize-none"
              />
              <button 
                type="button" 
                onClick={handleGetFinalPrompt}
                disabled={finalPromptLoading}
                className={`${finalPromptLoading ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg font-medium whitespace-nowrap self-start`}
              >
                {finalPromptLoading ? 'Generating...' : 'Get Final Prompt'}
              </button>
            </div>
          </div>

          <div className="transition-all duration-200 hover:shadow-md p-3 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">Final Prompt</label>
            <textarea
              name="finalPrompt"
              placeholder="Final prompt to be sent to backend"
              value={chapterData.finalPrompt}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-32 resize-none"
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium text-lg shadow-md hover:shadow-lg"
          >
            Add Chapter
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddChapter;