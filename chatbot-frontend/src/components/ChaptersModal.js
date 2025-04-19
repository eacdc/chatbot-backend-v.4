import React from "react";

const ChaptersModal = ({ isOpen, onClose, book, chapters, isAdmin = false }) => {
  // If modal is not open, don't render anything
  if (!isOpen) return null;
  
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
      {/* Modal content */}
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative animate-scale-in transform-gpu">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 focus:outline-none z-10"
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal header with book cover and info */}
        <div className="flex flex-col sm:flex-row items-center bg-gradient-to-b from-blue-50 to-white p-6 rounded-t-xl">
          <div className="w-40 h-56 sm:w-48 sm:h-64 overflow-hidden rounded-lg shadow-lg border border-blue-100 flex-shrink-0 mb-6 sm:mb-0">
            <img
              src={fixImageUrl(book?.bookCoverImgLink)}
              alt={book?.title || "Book cover"}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22600%22%20viewBox%3D%220%200%20400%20600%22%3E%3Crect%20fill%3D%22%233B82F6%22%20width%3D%22400%22%20height%3D%22600%22%2F%3E%3Ctext%20fill%3D%22%23FFFFFF%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2224%22%20text-anchor%3D%22middle%22%20x%3D%22200%22%20y%3D%22300%22%3E%3Ctspan%20x%3D%22200%22%20dy%3D%220%22%3EBook%20Cover%3C%2Ftspan%3E%3Ctspan%20x%3D%22200%22%20dy%3D%2230%22%3ENot%20Available%3C%2Ftspan%3E%3C%2Ftext%3E%3C%2Fsvg%3E";
              }}
            />
          </div>
          <div className="sm:ml-8 text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{book?.title || "Book Title"}</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-2">Publisher: {book?.publisher || "Unknown"}</p>
            {book?.grade && (
              <p className="text-sm sm:text-base text-gray-600 mb-4">Grade: {book.grade}</p>
            )}
            <div className="inline-flex items-center justify-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {chapters?.length || 0} Chapters
            </div>
          </div>
        </div>

        {/* Modal body - Chapter list */}
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
                  <div className="flex items-center">
                    <div className="h-8 w-8 flex-shrink-0 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                      <span className="font-semibold text-blue-800">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{chapter.title}</h4>
                      {chapter.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{chapter.description}</p>
                      )}
                    </div>
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
                {isAdmin 
                  ? "No chapters have been added to this book yet. Add chapters from the Admin Dashboard to make them available."
                  : "No chapters have been added to this book yet. Please check back later."
                }
              </p>
              {isAdmin && (
                <button
                  onClick={() => window.location.href = '/admin/add-chapter'}
                  className="mt-4 inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Chapter
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Modal footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChaptersModal; 