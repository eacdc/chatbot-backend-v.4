import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Login = () => {
  const [email, setEmail] = useState("");  
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    console.log("Email entered:", e.target.value); // ✅ Logs the email on every change
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    console.log("Password entered:", e.target.value); // ✅ Logs the password on every change
  };

  const handleLogin = async () => {
    const loginData = { email, password };

    console.log("Login request data:", loginData); // ✅ Logs the final email and password before sending

    try {
      const response = await axios.post("http://localhost:5000/api/users/login", loginData);

      if (response.data && response.data.token && response.data.userId) {
        console.log("Login successful! Token:", response.data.token); // ✅ Logs the received token
        console.log("User ID:", response.data.userId); // ✅ Logs the received userId

        localStorage.setItem("token", response.data.token);
        localStorage.setItem("userId", response.data.userId); // ✅ Store userId
        localStorage.setItem("isAuthenticated", "true");

        navigate("/chat");
      } else {
        setError("Login failed. Please try again.");
      }
    } catch (err) {
      console.error("Login error:", err.response || err);

      if (err.response) {
        if (err.response.status === 404) {
          setError("Server not found. Make sure the backend is running.");
        } else {
          setError(err.response.data.message || "Invalid Email or Password");
        }
      } else {
        setError("Network error. Please check your connection.");
      }
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-semibold text-center mb-4">Login</h2>

        {error && <p className="text-red-500 text-center mb-2">{error}</p>}

        <input
          type="email"
          placeholder="Email ID"
          className="w-full p-2 border rounded-lg mb-3"
          value={email}
          onChange={handleEmailChange}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 border rounded-lg mb-3"
          value={password}
          onChange={handlePasswordChange}
          required
        />

        <button
          onClick={handleLogin}
          className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition duration-300"
        >
          Login
        </button>

        <p className="text-center mt-3">
          New here? <a href="/signup" className="text-blue-500 hover:underline">Sign up</a>
        </p>

        <p className="text-center mt-2">
          <a href="/admin-login" className="text-red-500 font-semibold hover:underline">
            Login as Admin
          </a>
        </p>
      </div>
    </div>
  );
};

export default Login;
