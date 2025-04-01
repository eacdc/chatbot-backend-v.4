import { useState, useEffect } from "react";
import axios from "axios";

export default function Collections() {
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [user, setUser] = useState(null);

  // Fetch logged-in user details from API
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get("http://localhost:5000/api/users/me", {
          withCredentials: true, // Ensures cookies/session are sent
        });
        setUser(response.data); // Expected response: { _id, name }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    fetchUser();
  }, []);

  // Fetch books from API
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

  // Fetch chapters when a book is selected
  const fetchChapters = async (bookId) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/books/${bookId}/chapters`);
      setChapters(response.data);
      setSelectedBook(bookId);
    } catch (error) {
      console.error("Error fetching chapters:", error);
      setChapters([]);
    }
  };

  // Subscribe to a book
const handleSubscribe = async (bookId) => {
  const token = localStorage.getItem("token"); // Retrieve token from storage

  if (!token) {
    alert("Please log in to subscribe to books.");
    return;
  }

  try {
    const response = await axios.post(
      "http://localhost:5000/api/subscriptions",
      { bookId }, // Send only bookId, user details are fetched in backend
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    alert(response.data.message); // Show success message
  } catch (error) {
    console.error("Subscription error:", error.response?.data?.error || error.message);
    alert(error.response?.data?.error || "Subscription failed");
  }
};


  //end

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Collections</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {books.map((book) => (
          <div key={book._id} className="bg-white shadow-lg rounded-lg p-4">
            <img src={book.bookCoverImgLink} alt={book.title} className="w-full h-40 object-cover rounded-md" />
            <h2 className="text-lg font-semibold mt-3">{book.title}</h2>
            <p className="text-gray-600">{book.publisher}</p>
            <div className="mt-3 flex space-x-2">
              <button
                className="bg-blue-500 text-white px-4 py-2 rounded-lg"
                onClick={() => fetchChapters(book._id)}
              >
                View Chapters
              </button>
              <button
                className="bg-green-500 text-white px-4 py-2 rounded-lg"
                onClick={() => handleSubscribe(book._id, book.title)}
              >
                Subscribe
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedBook && (
        <div className="mt-8 p-4 bg-white shadow-lg rounded-lg">
          <h2 className="text-xl font-bold">Chapters</h2>
          {chapters.length > 0 ? (
            <ul className="mt-2">
              {chapters.map((chapter) => (
                <li key={chapter._id} className="p-2 border-b border-gray-300">{chapter.title}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No chapters found for this book.</p>
          )}
        </div>
      )}
    </div>
  );
}
