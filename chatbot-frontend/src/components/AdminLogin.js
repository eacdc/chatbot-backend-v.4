import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

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
      const response = await axios.post("http://localhost:5000/api/admins/login", {
        email,
        password,
      });

      if (response.data.status === "Pending") {
        setError("Your admin account is pending approval.");
        setLoading(false);
        return;
      }

      if (response.data.token) {
        localStorage.setItem("adminToken", response.data.token);
        navigate("/admin/dashboard"); // ✅ Redirect to Admin Dashboard
      }
    } catch (err) {
      setError("Invalid credentials or approval pending.");
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
      </div>
    </div>
  );
};

export default AdminLogin;
