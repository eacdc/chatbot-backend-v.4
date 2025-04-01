import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom"; // For navigation
import { API_ENDPOINTS } from "../config";

const Signup = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: "",
        fullname: "",
        email: "",
        phone: "",
        role: "",
        password: "",
        confirmPassword: ""
    });

    const [error, setError] = useState("");

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        console.log("📡 Sending request to:", API_ENDPOINTS.USER_SIGNUP);
        console.log("📝 Data:", formData); // Debugging

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match!");
            return;
        }

        try {
            const response = await axios.post(API_ENDPOINTS.USER_SIGNUP, {
                username: formData.username,
                email: formData.email,
                password: formData.password,
                confirmPassword: formData.confirmPassword,
            });
            console.log("✅ Server Response:", response.data);
            alert("Signup successful! Redirecting to login...");
            navigate("/login"); // Redirect to login page
        } catch (error) {
            console.error("❌ Signup Error:", error.response?.data?.message || "Error");
            setError(error.response?.data?.message || "Signup failed.");
        }
    };

    return (
        <div className="signup-container">
            <h2>Sign Up</h2>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    name="username"
                    placeholder="Username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                />
                <input
                    type="text"
                    name="fullname"
                    placeholder="Full Name"
                    value={formData.fullname}
                    onChange={handleChange}
                    required
                />
                <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                />
                <input
                    type="text"
                    name="phone"
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                />
                <select name="role" value={formData.role} onChange={handleChange} required>
                    <option value="">Select Role</option>
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="school admin">School Admin</option>
                    <option value="publisher admin">Publisher Admin</option>
                    <option value="admin">Admin</option>
                </select>
                <input
                    type="password"
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                />
                <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                />
                <button type="submit">Sign Up</button>
            </form>

            {/* 🔹 Login Link */}
            <p className="login-link">
                Already have an account? <span onClick={() => navigate("/login")}>Login</span>
            </p>
        </div>
    );
};

export default Signup;
