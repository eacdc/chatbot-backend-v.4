import React, { useState } from "react";
import ChaptersModal from "./ChaptersModal";

// Helper function to fix image URLs
const fixImageUrl = (url) => {
  if (!url) return "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%20viewBox%3D%220%200%20400%20600%22%3E%3Crect%20fill%3D%22%233B82F6%22%20width%3D%22400%22%20height%3D%22600%22%2F%3E%3Ctext%20fill%3D%22%23FFFFFF%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20x%3D%22200%22%20y%3D%22300%22%3E%3Ctspan%20x%3D%22200%22%20dy%3D%220%22%3EBook%20Cover%3C%2Ftspan%3E%3Ctspan%20x%3D%22200%22%20dy%3D%2230%22%3ENot%20Available%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fsvg%3E";
  
  // Check if the URL is using localhost
  if (url.includes('localhost:5000')) {
    // Replace localhost:5000 with the production URL
    return url.replace('http://localhost:5000', 'https://chatbot-backend-v-4-1.onrender.com');
  }
  
  // If it's already using HTTP, convert to HTTPS
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  
  return url;
};

const SubscribedBooksView = ({ subscribedBooks, onSelectChapter, fetchChapters, loading }) => {
  const [showChaptersModal, setShowChaptersModal] = useState(false);
  const [selectedBookData, setSelectedBookData] = useState(null);
  const [chapters, setChapters] = useState([]);

  // Handler for viewing chapters of a book
  const handleViewChapters = async (book) => {
    setSelectedBookData(book);
    setChapters([]); // Reset chapters
    
    try {
      const chaptersData = await fetchChapters(book.bookId);
      setChapters(chaptersData || []);
      setShowChaptersModal(true);
    } catch (error) {
      console.error("Error fetching chapters:", error);
      setChapters([]);
      setShowChaptersModal(true);
    }
  };

  // Close the chapters modal
  const closeChaptersModal = () => {
    setShowChaptersModal(false);
  };

  // Handler for selecting a chapter to test
  const handleTestChapter = (chapter, bookId, bookCoverImgLink) => {
    // Call the parent component's handleChapterSelect with the correct parameters
    onSelectChapter(bookId, chapter._id, chapter.title);
    setShowChaptersModal(false);
  };
  
  // Enhanced ChaptersModal component with test functionality
  const EnhancedChaptersModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
      {/* Modal content */}
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative animate-scale-in transform-gpu">
        {/* Close button */}
        <button
          onClick={closeChaptersModal}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 focus:outline-none z-10"
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal header with book cover and info */}
        <div className="flex flex-col sm:flex-row items-center bg-gradient-to-b from-blue-50 to-white p-6 rounded-t-xl">
          <div className="w-40 h-56 sm:w-48 sm:h-64 overflow-hidden rounded-lg shadow-lg border border-blue-100 flex-shrink-0 mb-6 sm:mb-0 flex justify-center">
            <img
              src={fixImageUrl(selectedBookData?.bookCoverImgLink)}
              alt={selectedBookData?.bookTitle || "Book cover"}
              className="h-full w-auto object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%20viewBox%3D%220%200%20400%20600%22%3E%3Crect%20fill%3D%22%233B82F6%22%20width%3D%22400%22%20height%3D%22600%22%2F%3E%3Ctext%20fill%3D%22%23FFFFFF%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20x%3D%22200%22%20y%3D%22300%22%3E%3Ctspan%20x%3D%22200%22%20dy%3D%220%22%3EBook%20Cover%3C%2Ftspan%3E%3Ctspan%20x%3D%22200%22%20dy%3D%2230%22%3ENot%20Available%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fsvg%3E";
              }}
            />
          </div>
          <div className="sm:ml-8 text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{selectedBookData?.bookTitle || "Book Title"}</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-2">Publisher: {selectedBookData?.publisher || "Unknown"}</p>
            {selectedBookData?.grade && (
              <p className="text-sm sm:text-base text-gray-600 mb-4">Grade: {selectedBookData.grade}</p>
            )}
            <div className="inline-flex items-center justify-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {chapters?.length || 0} Chapters
            </div>
          </div>
        </div>

        {/* Modal body - Chapter list with Test buttons */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Chapters
          </h3>
          
          {chapters?.length > 0 ? (
            <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
              {chapters.map((chapter, index) => (
                <li key={chapter._id} className="p-4 hover:bg-blue-50 transition-colors duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="h-8 w-8 flex-shrink-0 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                        <span className="font-semibold text-blue-800">{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{chapter.title}</h4>
                        {chapter.description && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{chapter.description}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleTestChapter(chapter, selectedBookData.bookId, selectedBookData.bookCoverImgLink)}
                      className="ml-4 inline-flex items-center px-3 py-1.5 border border-transparent rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Test
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Chapters Available</h4>
              <p className="text-gray-600">
                No chapters have been added to this book yet. Please check back later.
              </p>
            </div>
          )}
        </div>
        
        {/* Modal footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end">
          <button
            onClick={closeChaptersModal}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white bg-opacity-95 px-6 py-4 border-b border-gray-200 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">My Subscribed Books</h1>
        <p className="text-sm text-gray-600 mt-1">Select a book to view its chapters and start testing</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 flex-1 bg-white bg-opacity-90">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading your books...</p>
        </div>
      ) : subscribedBooks.length > 0 ? (
        <div className="px-4 sm:px-6 py-4 sm:py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 overflow-y-auto">
          {subscribedBooks.map((book) => (
            <div key={book._id} className="bg-white bg-opacity-95 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 border border-gray-100 flex flex-col min-h-[270px] sm:min-h-0 max-w-[240px] mx-auto">
              <div className="relative h-52 sm:h-48 overflow-hidden flex justify-center items-center">
                <img 
                  src={fixImageUrl(book.bookCoverImgLink)} 
                  alt={book.bookTitle} 
                  className="h-full max-w-[160px] object-contain transform hover:scale-105 transition-transform duration-500 ease-in-out"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22160%22%20height%3D%22220%22%20viewBox%3D%220%200%20160%20220%22%3E%3Crect%20fill%3D%22%233B82F6%22%20width%3D%22160%22%20height%3D%22220%22%2F%3E%3Ctext%20fill%3D%22%23FFFFFF%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2212%22%20text-anchor%3D%22middle%22%20x%3D%2280%22%20y%3D%22110%22%3E%3Ctspan%20x%3D%2280%22%20dy%3D%220%22%3EBook%20Cover%3C%2Ftspan%3E%3Ctspan%20x%3D%2280%22%20dy%3D%2215%22%3ENot%20Available%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fsvg%3E";
                  }}
                />
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h2 className="font-bold text-lg text-gray-900 line-clamp-2 mb-2 text-center">{book.bookTitle}</h2>
                {book.publisher && <p className="text-sm text-gray-600 mb-4 text-center">{book.publisher}</p>}
                <div className="mt-auto pt-2">
                  <button
                    className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                    onClick={() => handleViewChapters(book)}
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
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center flex-1">
          <div className="bg-white bg-opacity-95 rounded-xl shadow-md border border-gray-100 p-8 max-w-md w-full">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">No Books Available</h2>
            <p className="text-gray-600 mb-6">You haven't subscribed to any books yet. Visit collections to find books.</p>
            <button
              onClick={() => window.location.href = "/collections"}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              Browse Collections
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Chapters Modal with Test buttons */}
      {showChaptersModal && <EnhancedChaptersModal />}
    </div>
  );
};

export default SubscribedBooksView; 