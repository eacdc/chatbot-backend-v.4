import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if admin is logged in
    const adminToken = localStorage.getItem("adminToken");
    if (!adminToken) {
      // Redirect to admin login if not logged in
      navigate("/admin-login");
    }
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-4xl px-6">
        <h1 className="text-3xl font-bold mb-2 text-gray-800 text-center">Admin Dashboard</h1>
        <p className="text-gray-600 mb-8 text-center">Manage books and content</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Add Book Button */}
          <div 
            className="bg-blue-500 text-white px-6 py-4 rounded-lg shadow-lg cursor-pointer hover:bg-blue-600 transition duration-300"
            onClick={() => navigate("/admin/add-book")}
          >
            <h2 className="text-xl font-semibold">📚 Add Book</h2>
            <p className="text-sm mt-2">Click to add book details</p>
          </div>

          {/* Add Chapter Button */}
          <div 
            className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg cursor-pointer hover:bg-green-600 transition duration-300"
            onClick={() => navigate("/admin/add-chapter")}
          >
            <h2 className="text-xl font-semibold">📖 Add Chapter</h2>
            <p className="text-sm mt-2">Click to add chapters</p>
          </div>
          
          {/* View Collections Button */}
          <div 
            className="bg-purple-500 text-white px-6 py-4 rounded-lg shadow-lg cursor-pointer hover:bg-purple-600 transition duration-300"
            onClick={() => navigate("/admin/collections")}
          >
            <h2 className="text-xl font-semibold">🔍 View Collections</h2>
            <p className="text-sm mt-2">Browse all books and chapters</p>
          </div>
        </div>

        {/* Logout Button */}
        <button 
          className="mx-auto block bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition duration-300"
          onClick={() => {
            localStorage.removeItem("adminToken");
            navigate("/admin-login");
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;
