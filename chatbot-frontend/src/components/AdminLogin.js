import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "../config";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // ✅ Loading state
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError(""); // Clear previous errors
    setLoading(true); // Show loading

    try {
      const response = await axios.post(API_ENDPOINTS.ADMIN_LOGIN, {
        email,
        password,
      });

      console.log("Admin login response:", response.data);

      if (response.data.status === "Pending") {
        setError("Your admin account is pending approval.");
        setLoading(false);
        return;
      }

      if (response.data.token) {
        // Clear any previous token
        localStorage.removeItem("adminToken");
        
        // Store the new token and admin ID
        localStorage.setItem("adminToken", response.data.token);
        if (response.data.adminId) {
          localStorage.setItem("adminId", response.data.adminId);
        }
        
        // Add a slight delay to ensure localStorage is updated
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Navigate to admin dashboard
        navigate("/admin/dashboard");
      } else {
        setError("Invalid response from server. Please try again.");
      }
    } catch (err) {
      console.error("Admin login error:", err);
      if (err.response) {
        const errorMsg = err.response.data?.message || "Authentication failed";
        setError(errorMsg);
      } else {
        setError("Failed to connect to server. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gradient-to-r from-blue-500 to-indigo-600">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-4">Admin Login</h2>

        {error && <p className="text-red-500 text-center mb-3">{error}</p>}

        <input
          type="email"
          placeholder="Email ID"
          className="w-full p-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full text-white py-2 rounded-lg transition duration-300 ${
            loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="text-center mt-4">
          <a href="/admin-register" className="text-blue-500 hover:underline">
            Register as Admin
          </a>
        </p>
        
        <div className="border-t border-gray-200 mt-4 pt-4">
          <p className="text-center text-gray-600">
            Not an admin? <a href="/login" className="text-blue-500 hover:underline">Go to User Login</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
