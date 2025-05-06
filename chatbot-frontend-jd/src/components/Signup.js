import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom"; // For navigation
import { API_ENDPOINTS } from "../config";
import { useAuth } from '../contexts/AuthContext';
import { config } from '../config';
import './Login.css';

const Signup = () => {
    const navigate = useNavigate();
    const { signup } = useAuth();
    
    // Grade options for the dropdown
    const gradeOptions = [
        "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "College Student"
    ];
    
    const [formData, setFormData] = useState({
        username: "",
        fullname: "",
        email: "",
        phone: "",
        role: "",
        grade: "1", // Default grade
        password: "",
        confirmPassword: ""
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(""); // Clear error when user types
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        try {
            setLoading(true);
            // Add JD Editions as the default publisher
            const signupData = {
                ...formData,
                publisher: "JD Editions" // Always set JD Editions as publisher
            };
            
            // First create the user account
            await signup(signupData.email, signupData.password);
            
            // Then make the API call to create the user profile
            const token = localStorage.getItem("token");
            if (!token) {
                throw new Error("No authentication token found");
            }

            await axios.post(API_ENDPOINTS.CREATE_USER, signupData, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            navigate('/chat');
        } catch (err) {
            console.error("Signup error:", err);
            setError(err.response?.data?.error || 'Failed to create an account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h1>{config.appName}</h1>
                <h2>Create Account</h2>
                {error && <div className="error-message">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Full Name</label>
                        <input
                            type="text"
                            value={formData.fullname}
                            onChange={handleChange}
                            name="fullname"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            name="email"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Phone</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={handleChange}
                            name="phone"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Grade</label>
                        <select
                            value={formData.grade}
                            onChange={handleChange}
                            name="grade"
                            required
                        >
                            {gradeOptions.map((grade) => (
                                <option key={grade} value={grade}>
                                    {grade}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={handleChange}
                            name="password"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input
                            type="password"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            name="confirmPassword"
                            required
                        />
                    </div>
                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? "Creating Account..." : "Sign Up"}
                    </button>
                </form>
                <p className="signup-link">
                    Already have an account? <Link to="/login">Log in</Link>
                </p>
            </div>
        </div>
    );
};

export default Signup;
