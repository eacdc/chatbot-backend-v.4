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
    finalPrompt: "",
    vectorStoreId: ""
  });

  const [categorizedQuestions, setCategorizedQuestions] = useState({
    shortAnswerDescriptiveBelow75: [],
    otherQuestionInvalid: [],
    shortAnswerDescriptiveInvalid: [],
    validQuestions: [] // Combined: shortAnswerDescriptiveAtOrAbove75 + otherQuestionValid
  });

  const [processingProgress, setProcessingProgress] = useState(null); // { stage, message, percent } when processing

  // Helper: true if question type is Short answer or Descriptive (tentative answer applies)
  const isShortAnswerOrDescriptive = (q) => {
    const rawType = (q?.question_type || q?.["question type"] || "").toString().toLowerCase();
    return rawType.includes("short answer") || rawType.includes("descriptive");
  };

  // Helper: get tentative answer as a string (OpenAI may return string or object with keys like "Most important part...")
  const getTentativeAnswer = (q) => {
    const raw = q["Tentative response from the book"] ?? q.tentativeAnswer ?? "";
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object") {
      return Object.entries(raw)
        .map(([k, v]) => (v != null && v !== "" ? `${k}: ${v}` : null))
        .filter(Boolean)
        .join("\n") || JSON.stringify(raw);
    }
    return "";
  };

  // Normalize question for saving: tentativeAnswer only for short answer/descriptive; MCQ/True-False/Fill in blanks get none
  const normalizeQuestionForSave = (q) => ({
    ...q,
    tentativeAnswer: isShortAnswerOrDescriptive(q) ? getTentativeAnswer(q) : ""
  });

  // Function to move a question from review box to valid questions (does not submit form)
  const moveQuestionToValid = (question, sourceCategory) => {
    // Remove from source category
    const updatedSource = categorizedQuestions[sourceCategory].filter(
      q => q !== question
    );

    // MCQ/True-False/Fill in Blanks - Invalid: do not carry over tentative answer when adding to valid
    const questionToAdd =
      sourceCategory === "otherQuestionInvalid"
        ? { ...question, "Tentative response from the book": undefined, tentativeAnswer: "" }
        : question;

    // Add to valid questions
    const updatedValid = [...categorizedQuestions.validQuestions, questionToAdd];

    // Update state
    setCategorizedQuestions({
      ...categorizedQuestions,
      [sourceCategory]: updatedSource,
      validQuestions: updatedValid
    });

    // Update finalPrompt with normalized questions so backend gets tentativeAnswer
    const normalizedForSave = updatedValid.map(normalizeQuestionForSave);
    setChapterData({
      ...chapterData,
      finalPrompt: JSON.stringify(normalizedForSave),
      questionCount: updatedValid.length
    });
  };

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

    if (!chapterData.title.trim()) {
      setError("Please enter a chapter title");
      return;
    }

    const selectedBook = books.find((book) => book._id === chapterData.bookId);
    if (!selectedBook) {
      setError("Selected book not found");
      return;
    }

    setProcessingLoading(true);
    setProcessingProgress({ stage: "starting", message: "Starting...", percent: 0 });
    setError("");
    setSuccessMessage("");
    setCategorizedQuestions({
      shortAnswerDescriptiveBelow75: [],
      otherQuestionInvalid: [],
      shortAnswerDescriptiveInvalid: [],
      validQuestions: []
    });
    
    try {
      const adminToken = localStorage.getItem("adminToken");
      if (!adminToken) {
        setError("Please log in as an admin to continue");
        setProcessingLoading(false);
        setProcessingProgress(null);
        return;
      }

      const grade = selectedBook.grade || selectedBook.class || "7";
      const title = selectedBook.title || "Book";
      const chapter = chapterData.title;
      const language = selectedBook.language || "English";

      const response = await fetch(API_ENDPOINTS.PROCESS_TEXT_BATCH_V2_STREAM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          rawText: chapterData.rawText,
          grade,
          title,
          chapter,
          language
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let resultData = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const obj = JSON.parse(trimmed);
            if (obj.type === "progress") {
              setProcessingProgress({
                stage: obj.stage || "",
                message: obj.message || "",
                percent: obj.percent != null ? obj.percent : 0
              });
            } else if (obj.type === "result" && obj.data) {
              resultData = obj.data;
            } else if (obj.type === "error") {
              throw new Error(obj.error || "Processing failed");
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
      if (buffer.trim()) {
        try {
          const obj = JSON.parse(buffer.trim());
          if (obj.type === "result" && obj.data) resultData = obj.data;
          else if (obj.type === "error") throw new Error(obj.error || "Processing failed");
        } catch (e) {
          if (!(e instanceof SyntaxError)) throw e;
        }
      }

      if (resultData && resultData.success && resultData.categorized) {
        const { categorized, vectorStoreId } = resultData;
        const validQuestions = [
          ...(categorized.shortAnswerDescriptiveAtOrAbove75 || []),
          ...(categorized.otherQuestionValid || [])
        ];
        setCategorizedQuestions({
          shortAnswerDescriptiveBelow75: categorized.shortAnswerDescriptiveBelow75 || [],
          otherQuestionInvalid: categorized.otherQuestionInvalid || [],
          shortAnswerDescriptiveInvalid: categorized.shortAnswerDescriptiveInvalid || [],
          validQuestions
        });
        const normalizedForSave = validQuestions.map(q => ({ ...q, tentativeAnswer: getTentativeAnswer(q) }));
        setChapterData({
          ...chapterData,
          finalPrompt: JSON.stringify(normalizedForSave),
          hasQuestionFormat: true,
          questionCount: validQuestions.length,
          vectorStoreId: vectorStoreId || ""
        });
        const totalInvalidOrLowScore =
          (categorized.shortAnswerDescriptiveBelow75 || []).length +
          (categorized.otherQuestionInvalid || []).length +
          (categorized.shortAnswerDescriptiveInvalid || []).length;
        setSuccessMessage(
          `Text successfully processed! ${validQuestions.length} valid questions ready to save. ` +
          `${totalInvalidOrLowScore} questions flagged for review.`
        );
      } else {
        setError("Processing did not complete successfully");
      }
    } catch (error) {
      console.error("Error in text processing:", error);
      if (error.message?.includes("401")) {
        setError("Authentication failed. Please log in again as an admin.");
      } else if (error.message?.includes("504")) {
        setError("Processing timed out. The text may be too complex. Please try again later or try processing in multiple sessions.");
      } else {
        setError(error.message || "Failed during text processing. Please try again.");
      }
    } finally {
      setProcessingLoading(false);
      setProcessingProgress(null);
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
      prompt: chapterData.finalPrompt,
      vectorStoreId: chapterData.vectorStoreId
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
          finalPrompt: "",
          vectorStoreId: ""
        });
        setCategorizedQuestions({
          shortAnswerDescriptiveBelow75: [],
          otherQuestionInvalid: [],
          shortAnswerDescriptiveInvalid: [],
          validQuestions: []
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

                  {/* Progress bar and stage when processing */}
                  {processingLoading && processingProgress && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-900">
                          {processingProgress.message}
                        </span>
                        <span className="text-sm font-semibold text-blue-700">
                          {processingProgress.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${Math.min(100, Math.max(0, processingProgress.percent))}%` }}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-blue-700">
                        <span className={processingProgress.stage === "vector_store" ? "font-semibold underline" : ""}>
                          Creating vector store
                        </span>
                        <span>•</span>
                        <span className={processingProgress.stage === "normalizing" ? "font-semibold underline" : ""}>
                          Normalizing text
                        </span>
                        <span>•</span>
                        <span className={processingProgress.stage === "extracting_questions" ? "font-semibold underline" : ""}>
                          Extracting questions
                        </span>
                        <span>•</span>
                        <span className={processingProgress.stage === "extracting_answer_validation" ? "font-semibold underline" : ""}>
                          Extracting answers & validation
                        </span>
                        <span>•</span>
                        <span className={processingProgress.stage === "categorizing" ? "font-semibold underline" : ""}>
                          Categorizing
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Review Boxes - Show flagged questions */}
                {(categorizedQuestions.shortAnswerDescriptiveBelow75.length > 0 ||
                  categorizedQuestions.otherQuestionInvalid.length > 0 ||
                  categorizedQuestions.shortAnswerDescriptiveInvalid.length > 0) && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900 mt-6">Questions Flagged for Review</h2>
                    
                    {/* Box 1: Short Answer/Descriptive - Below 75% Score */}
                    {categorizedQuestions.shortAnswerDescriptiveBelow75.length > 0 && (
                      <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-300">
                        <div className="flex items-center mb-3">
                          <svg className="h-5 w-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                          </svg>
                          <h3 className="text-md font-semibold text-yellow-900">
                            Short Answer/Descriptive - Low Relevance Score (&lt; 75%)
                          </h3>
                          <span className="ml-auto bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                            {categorizedQuestions.shortAnswerDescriptiveBelow75.length} questions
                          </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {categorizedQuestions.shortAnswerDescriptiveBelow75.map((q, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={(e) => { e.preventDefault(); moveQuestionToValid(q, 'shortAnswerDescriptiveBelow75'); }}
                              className="w-full text-left bg-white hover:bg-yellow-100 p-3 rounded border border-yellow-300 flex items-start justify-between group transition-colors"
                            >
                              <div className="flex-1 pr-3">
                                <p className="text-sm font-medium text-gray-900 mb-1">{q.question || 'No question text'}</p>
                                {getTentativeAnswer(q) && (
                                  <p className="text-xs text-gray-600 mb-2 mt-1 pl-2 border-l-2 border-yellow-400 italic">
                                    Answer: {getTentativeAnswer(q)}
                                  </p>
                                )}
                                <div className="flex gap-2 text-xs text-gray-600">
                                  <span>Type: {q.question_type || q['question type'] || 'N/A'}</span>
                                  {q.highestScore !== undefined && (
                                    <span className="text-yellow-700 font-medium">Score: {(q.highestScore * 100).toFixed(1)}%</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                <div className="bg-green-500 text-white rounded-full p-1 group-hover:bg-green-600 transition-colors">
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Box 2: Other Question Types - Invalid */}
                    {categorizedQuestions.otherQuestionInvalid.length > 0 && (
                      <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-300">
                        <div className="flex items-center mb-3">
                          <svg className="h-5 w-5 text-orange-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                          </svg>
                          <h3 className="text-md font-semibold text-orange-900">
                            MCQ/True-False/Fill in Blanks - Invalid
                          </h3>
                          <span className="ml-auto bg-orange-200 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                            {categorizedQuestions.otherQuestionInvalid.length} questions
                          </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {categorizedQuestions.otherQuestionInvalid.map((q, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={(e) => { e.preventDefault(); moveQuestionToValid(q, 'otherQuestionInvalid'); }}
                              className="w-full text-left bg-white hover:bg-orange-100 p-3 rounded border border-orange-300 flex items-start justify-between group transition-colors"
                            >
                              <div className="flex-1 pr-3">
                                <p className="text-sm font-medium text-gray-900 mb-1">{q.question || 'No question text'}</p>
                                {getTentativeAnswer(q) && (
                                  <p className="text-xs text-gray-600 mb-2 mt-1 pl-2 border-l-2 border-orange-400 italic">
                                    Answer: {getTentativeAnswer(q)}
                                  </p>
                                )}
                                <div className="flex gap-2 text-xs text-gray-600">
                                  <span>Type: {q.question_type || q['question type'] || 'N/A'}</span>
                                  {q['Invalid reason'] && (
                                    <span className="text-orange-700">Reason: {q['Invalid reason']}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                <div className="bg-green-500 text-white rounded-full p-1 group-hover:bg-green-600 transition-colors">
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Box 3: Short Answer/Descriptive - Invalid */}
                    {categorizedQuestions.shortAnswerDescriptiveInvalid.length > 0 && (
                      <div className="bg-red-50 p-4 rounded-lg border-2 border-red-300">
                        <div className="flex items-center mb-3">
                          <svg className="h-5 w-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                          </svg>
                          <h3 className="text-md font-semibold text-red-900">
                            Short Answer/Descriptive - Invalid
                          </h3>
                          <span className="ml-auto bg-red-200 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                            {categorizedQuestions.shortAnswerDescriptiveInvalid.length} questions
                          </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {categorizedQuestions.shortAnswerDescriptiveInvalid.map((q, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={(e) => { e.preventDefault(); moveQuestionToValid(q, 'shortAnswerDescriptiveInvalid'); }}
                              className="w-full text-left bg-white hover:bg-red-100 p-3 rounded border border-red-300 flex items-start justify-between group transition-colors"
                            >
                              <div className="flex-1 pr-3">
                                <p className="text-sm font-medium text-gray-900 mb-1">{q.question || 'No question text'}</p>
                                {getTentativeAnswer(q) && (
                                  <p className="text-xs text-gray-600 mb-2 mt-1 pl-2 border-l-2 border-red-400 italic">
                                    Answer: {getTentativeAnswer(q)}
                                  </p>
                                )}
                                <div className="flex flex-col gap-1 text-xs text-gray-600">
                                  <span>Type: {q.question_type || q['question type'] || 'N/A'}</span>
                                  {q['Invalid reason'] && (
                                    <span className="text-red-700">Reason: {q['Invalid reason']}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                <div className="bg-green-500 text-white rounded-full p-1 group-hover:bg-green-600 transition-colors">
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="bg-green-50 p-4 rounded-lg border-2 border-green-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                      <h2 className="text-lg font-semibold text-green-900">Valid Questions (Ready to Save)</h2>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        {categorizedQuestions.validQuestions.length > 0 
                          ? `${categorizedQuestions.validQuestions.length} questions`
                          : "0 questions"
                        }
                      </span>
                    </div>
                  </div>
                  
                  {categorizedQuestions.validQuestions.length > 0 ? (
                    <div className="space-y-3">
                      {/* Visual list of questions */}
                      <div className="max-h-96 overflow-y-auto space-y-2 bg-white p-3 rounded border border-green-200">
                        {categorizedQuestions.validQuestions.map((q, idx) => (
                          <div
                            key={idx}
                            className="bg-green-50 p-3 rounded border border-green-200"
                          >
                            <div className="flex items-start gap-2">
                              <span className="flex-shrink-0 bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                {idx + 1}
                              </span>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 mb-1">{q.question || 'No question text'}</p>
                                {isShortAnswerOrDescriptive(q) && getTentativeAnswer(q) && (
                                  <p className="text-xs text-gray-600 mb-2 mt-1 pl-2 border-l-2 border-green-400 italic">
                                    Answer: {getTentativeAnswer(q)}
                                  </p>
                                )}
                                <div className="flex gap-3 text-xs text-gray-600">
                                  <span>Type: {q.question_type || q['question type'] || 'N/A'}</span>
                                  {q.highestScore !== undefined && (
                                    <span className="text-green-700 font-medium">Score: {(q.highestScore * 100).toFixed(1)}%</span>
                                  )}
                                  {q.subtopic && (
                                    <span>Subtopic: {q.subtopic}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Hidden textarea for form submission */}
                      <textarea
                        name="finalPrompt"
                        value={chapterData.finalPrompt}
                        onChange={handleChange}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm">No valid questions yet</p>
                      <p className="text-xs mt-1">Process text or add questions from the review boxes above</p>
                    </div>
                  )}
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