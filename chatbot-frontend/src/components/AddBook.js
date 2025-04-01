import React, { useState } from "react";
import axios from "axios";
import { API_ENDPOINTS } from "../config";

const AddBook = () => {
  const [bookData, setBookData] = useState({
    title: "",
    publisher: "",
    subject: "",
    language: "",
    bookCoverImgLink: "",
  });
  const [successMessage, setSuccessMessage] = useState("");

  const handleChange = (e) => {
    setBookData({ ...bookData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await axios.post(API_ENDPOINTS.ADD_BOOK, bookData);

      if (response.status === 201) {
        setSuccessMessage("✅ Book details have been added successfully!");
        
        // Wait for 2 seconds before refreshing the page
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error("Error adding book:", error);
      alert("❌ Failed to add book. Please try again.");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-[600px]">
        <h2 className="text-2xl font-semibold text-center mb-4">Add a New Book</h2>

        {successMessage && (
          <div className="bg-green-100 text-green-700 p-2 rounded-md text-center mb-4">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="title"
            placeholder="Book Title"
            value={bookData.title}
            onChange={handleChange}
            className="w-full p-2 border rounded-lg"
            required
          />

          <input
            type="text"
            name="publisher"
            placeholder="Publisher"
            value={bookData.publisher}
            onChange={handleChange}
            className="w-full p-2 border rounded-lg"
            required
          />

          <input
            type="text"
            name="subject"
            placeholder="Subject"
            value={bookData.subject}
            onChange={handleChange}
            className="w-full p-2 border rounded-lg"
            required
          />

          <input
            type="text"
            name="language"
            placeholder="Language"
            value={bookData.language}
            onChange={handleChange}
            className="w-full p-2 border rounded-lg"
            required
          />

          <input
            type="text"
            name="bookCoverImgLink"
            placeholder="Book Cover Image URL"
            value={bookData.bookCoverImgLink}
            onChange={handleChange}
            className="w-full p-2 border rounded-lg"
            required
          />

          <button
            type="submit"
            className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600"
          >
            Add Book
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddBook;
