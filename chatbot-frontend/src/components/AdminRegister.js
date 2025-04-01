import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "../config";

const AdminRegister = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    contactNumber: "",
    designation: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async () => {
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const response = await axios.post(API_ENDPOINTS.ADMIN_REGISTER, {
        username: formData.fullName,
        email: formData.email,
        contactNumber: formData.contactNumber,
        designation: formData.designation,
        password: formData.password,
      });

      setMessage(response.data.message);
      navigate("/admin-login");
    } catch (error) {
      setError("Error registering admin.");
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-semibold text-center mb-4">Register as Admin</h2>

        {error && <p className="text-red-500 text-center">{error}</p>}
        {message && <p className="text-green-500 text-center">{message}</p>}

        <input
          type="text"
          name="fullName"
          placeholder="Full Name"
          className="w-full p-2 border rounded-lg mb-3"
          value={formData.fullName}
          onChange={handleChange}
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Email ID"
          className="w-full p-2 border rounded-lg mb-3"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="contactNumber"
          placeholder="Contact Number"
          className="w-full p-2 border rounded-lg mb-3"
          value={formData.contactNumber}
          onChange={handleChange}
          required
        />

        <input
          type="text"
          name="designation"
          placeholder="Designation"
          className="w-full p-2 border rounded-lg mb-3"
          value={formData.designation}
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          className="w-full p-2 border rounded-lg mb-3"
          value={formData.password}
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          className="w-full p-2 border rounded-lg mb-3"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
        />

        <button
          onClick={handleRegister}
          className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
        >
          Register
        </button>

        <p className="text-center mt-3">
          Already an admin?{" "}
          <a href="/admin-login" className="text-blue-500">Login</a>
        </p>
      </div>
    </div>
  );
};

export default AdminRegister;
