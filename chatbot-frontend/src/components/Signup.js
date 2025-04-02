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
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(""); // Clear error when user types
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match!");
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post(API_ENDPOINTS.USER_SIGNUP, {
                username: formData.username,
                email: formData.email,
                password: formData.password,
                confirmPassword: formData.confirmPassword,
                fullname: formData.fullname,
                phone: formData.phone,
                role: formData.role
            });

            // Show success message
            setError(""); // Clear any existing errors
            alert("Signup successful! Redirecting to login...");
            navigate("/login");
        } catch (error) {
            console.error("Signup Error:", error.response?.data?.message || error.message);
            setError(error.response?.data?.message || "Signup failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100 p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 sm:p-8">
                <div className="text-center mb-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Sign up for an account</h2>
                    <p className="mt-2 text-sm sm:text-base text-gray-600">
                        Or{' '}
                        <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                            sign in to your account
                        </a>
                    </p>
                </div>

                {error && (
                    <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="space-y-3">
                            <div>
                                <label htmlFor="username" className="sr-only">Username</label>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 text-sm sm:text-base"
                                    placeholder="Username"
                                    value={formData.username}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="fullName" className="sr-only">Full Name</label>
                                <input
                                    id="fullName"
                                    name="fullName"
                                    type="text"
                                    required
                                    className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 text-sm sm:text-base"
                                    placeholder="Full Name"
                                    value={formData.fullname}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className="sr-only">Email address</label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 text-sm sm:text-base"
                                    placeholder="Email address"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="phone" className="sr-only">Phone Number</label>
                                <input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    required
                                    className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 text-sm sm:text-base"
                                    placeholder="Phone Number"
                                    value={formData.phone}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="role" className="sr-only">Role</label>
                                <select
                                    id="role"
                                    name="role"
                                    required
                                    className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 text-sm sm:text-base"
                                    value={formData.role}
                                    onChange={handleChange}
                                >
                                    <option value="">Select Role</option>
                                    <option value="teacher">Teacher</option>
                                    <option value="student">Student</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="password" className="sr-only">Password</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 text-sm sm:text-base"
                                    placeholder="Password"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    required
                                    className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 text-sm sm:text-base"
                                    placeholder="Confirm Password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm sm:text-base font-medium text-white ${loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                        >
                            {loading ? (
                                <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing up...
                                </span>
                            ) : (
                                'Sign up'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Signup;
