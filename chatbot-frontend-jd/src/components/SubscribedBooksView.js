import React, { useState } from 'react';
import { FaBook, FaChevronRight } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const SubscribedBooksView = ({ subscribedBooks, onSelectChapter, fetchChapters, loading }) => {
  const [expandedBooks, setExpandedBooks] = useState({});
  const [bookChaptersData, setBookChaptersData] = useState({});
  const navigate = useNavigate();

  // When a book is clicked, fetch its chapters if not already loaded
  const handleBookClick = async (bookId) => {
    setExpandedBooks(prev => ({
      ...prev,
      [bookId]: !prev[bookId]
    }));

    // Fetch chapters if not already loaded
    if (!bookChaptersData[bookId]) {
      const chaptersData = await fetchChapters(bookId);
      setBookChaptersData(prev => ({
        ...prev,
        [bookId]: chaptersData
      }));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">My Library</h1>
          
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : subscribedBooks.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow-sm text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <FaBook className="text-blue-500 text-2xl" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">No Books In Your Library</h2>
              <p className="text-gray-600 mb-6">Subscribe to books to start learning and chatting with AI.</p>
              <button 
                onClick={() => navigate('/collections')}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg shadow-sm transition-colors duration-200"
              >
                Browse Collections
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subscribedBooks.map((book) => (
                <div key={book._id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
                  <div 
                    className="flex p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                    onClick={() => handleBookClick(book.bookId)}
                  >
                    <div className="h-16 w-16 bg-blue-50 rounded-md flex-shrink-0 flex items-center justify-center mr-4">
                      {book.bookCoverImgLink ? (
                        <img 
                          src={book.bookCoverImgLink} 
                          alt={book.bookTitle}
                          className="h-full w-full object-contain p-1"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22150%22%20viewBox%3D%220%200%20100%20150%22%3E%3Crect%20fill%3D%22%233B82F6%22%20width%3D%22100%22%20height%3D%22150%22%2F%3E%3Ctext%20fill%3D%22%23FFFFFF%22%20font-family%3D%22Arial%2C%20sans-serif%22%20font-size%3D%2210%22%20text-anchor%3D%22middle%22%20x%3D%2250%22%20y%3D%2275%22%3EBook%3C%2Ftext%3E%3C%2Fsvg%3E";
                          }}
                        />
                      ) : (
                        <FaBook className="text-blue-500 text-2xl" />
                      )}
                    </div>
                    <div className="flex-1 flex flex-col min-w-0">
                      <h3 className="text-base font-medium text-gray-800 truncate">{book.bookTitle}</h3>
                      <p className="text-sm text-gray-500 mt-1">Click to view chapters</p>
                    </div>
                    <FaChevronRight className={`text-gray-400 self-center transition-transform duration-200 transform ${expandedBooks[book.bookId] ? 'rotate-90' : ''}`} />
                  </div>
                  
                  {expandedBooks[book.bookId] && (
                    <div className="border-t border-gray-100">
                      {bookChaptersData[book.bookId] ? (
                        bookChaptersData[book.bookId].length > 0 ? (
                          <div className="divide-y divide-gray-100">
                            {bookChaptersData[book.bookId].map((chapter) => (
                              <div 
                                key={chapter._id} 
                                className="p-3 pl-16 cursor-pointer hover:bg-blue-50 transition-colors duration-200"
                                onClick={() => onSelectChapter(book.bookId, chapter._id, chapter.title)}
                              >
                                <p className="text-sm text-gray-700">{chapter.title}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-sm text-gray-500">
                            No chapters available for this book
                          </div>
                        )
                      ) : (
                        <div className="p-4 flex justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white p-4 border-t border-gray-100 text-center">
        <button 
          onClick={() => navigate('/collections')}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg shadow-sm transition-colors duration-200 inline-flex items-center"
        >
          <FaBook className="mr-2" /> Browse Collections
        </button>
      </div>
    </div>
  );
};

export default SubscribedBooksView; 