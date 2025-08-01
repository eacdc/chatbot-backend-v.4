import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom"; // For navigation
import { API_ENDPOINTS } from "../config";

const Signup = () => {
    const navigate = useNavigate();
    
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
    const [publisherValue, setPublisherValue] = useState("EXCELLENCE PUBLICATION");
    
    // OTP verification states
    const [otpStep, setOtpStep] = useState(false); // false = signup form, true = OTP verification
    const [otpCode, setOtpCode] = useState("");
    const [otpLoading, setOtpLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [userEmail, setUserEmail] = useState("");
    const [isDummyMode, setIsDummyMode] = useState(false); // Track if using dummy OTP
    const [usernameError, setUsernameError] = useState(""); // Track username validation
    const [checkingUsername, setCheckingUsername] = useState(false); // Track loading state for username check

    // Detect if the app is being accessed from CP domain
    useEffect(() => {
        const hostname = window.location.hostname;
        console.log("Current hostname:", hostname);
        
        // Check for CP domain
                const isCPDomain = hostname === 'chatbot-backend-v-4.onrender.com' ||
            hostname.includes('chatbot-backend-v-4.onrender.com');
        
        if (isCPDomain) {
            console.log("CP domain detected, setting publisher to CP");
            setPublisherValue("CP");
        } else {
            console.log("Standard domain detected, setting publisher to EXCELLENCE PUBLICATION");
        }
    }, []);

    // Countdown timer for resend OTP
    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(""); // Clear error when user types
        
        // Clear username error when user starts typing in username field
        if (e.target.name === 'username') {
            setUsernameError("");
        }
    };

    // Check username availability
    const checkUsernameAvailability = async (username) => {
        if (!username || !username.trim()) {
            setUsernameError("");
            return;
        }

        setCheckingUsername(true);
        setUsernameError("");

        try {
            const response = await fetch(API_ENDPOINTS.CHECK_USERNAME, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username: username.trim() })
            });

            const data = await response.json();

            if (response.status === 409) {
                // Username taken
                setUsernameError(data.message);
            } else if (response.status === 200) {
                // Username available
                setUsernameError("");
            } else {
                // Other error
                setUsernameError(data.message || "Error checking username");
            }
        } catch (error) {
            console.error("Error checking username:", error);
            setUsernameError("Error checking username availability");
        } finally {
            setCheckingUsername(false);
        }
    };

    const handleOtpChange = (e) => {
        setOtpCode(e.target.value);
        setError(""); // Clear error when user types
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        // Check if username is available before proceeding
        if (usernameError) {
            setError("Please choose a different username.");
            setLoading(false);
            return;
        }

        // Basic form validation
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match.");
            setLoading(false);
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email.trim())) {
            setError("Please provide a valid email address.");
            setLoading(false);
            return;
        }

        try {
            // Create a copy of formData to modify
            const userData = { ...formData };
            
            // Set the publisher based on domain
            userData.publisher = publisherValue;
            
            console.log("Sending OTP to:", userData.email);
            
            // Send OTP request
            const response = await axios.post(API_ENDPOINTS.SEND_OTP, userData);
            
            console.log("OTP sent successfully:", response.data);
            
            // Store email for OTP verification
            setUserEmail(formData.email);
            
            // Check if in dummy mode
            setIsDummyMode(response.data.developmentMode || false);
            
            // Switch to OTP verification step
            setOtpStep(true);
            setCountdown(60); // 60 seconds before allowing resend
            setError(""); // Clear any existing errors
            
        } catch (error) {
            console.error("Send OTP Error:", error.response?.data?.message || error.message);
            setError(error.response?.data?.message || "Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setOtpLoading(true);

        if (!otpCode.trim()) {
            setError("Please enter the OTP code.");
            setOtpLoading(false);
            return;
        }

        if (otpCode.trim().length !== 6) {
            setError("OTP must be 6 digits.");
            setOtpLoading(false);
            return;
        }

        try {
            console.log("Verifying OTP:", otpCode);
            
            const response = await axios.post(API_ENDPOINTS.VERIFY_OTP, {
                email: userEmail,
                otp: otpCode.trim()
            });
            
            console.log("OTP verified successfully:", response.data);
            
            // Show success message
            alert("Registration completed successfully! Redirecting to login...");
            navigate("/login");
            
        } catch (error) {
            console.error("OTP Verification Error:", error.response?.data?.message || error.message);
            setError(error.response?.data?.message || "Invalid OTP. Please try again.");
        } finally {
            setOtpLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setError("");
        setResendLoading(true);

        try {
            console.log("Resending OTP to:", userEmail);
            
            const response = await axios.post(API_ENDPOINTS.RESEND_OTP, {
                email: userEmail
            });
            
            console.log("OTP resent successfully:", response.data);
            setCountdown(60); // Reset countdown
            setOtpCode(""); // Clear OTP input
            
            // Update dummy mode status
            setIsDummyMode(response.data.developmentMode || false);
            
            // Show success message
            if (response.data.developmentMode) {
                alert("Development Mode: Use OTP 123456 to verify!");
            } else {
                alert("New OTP sent to your email!");
            }
            
        } catch (error) {
            console.error("Resend OTP Error:", error.response?.data?.message || error.message);
            setError(error.response?.data?.message || "Failed to resend OTP. Please try again.");
        } finally {
            setResendLoading(false);
        }
    };

    const handleBackToSignup = () => {
        setOtpStep(false);
        setOtpCode("");
        setUserEmail("");
        setCountdown(0);
        setError("");
    };

    // OTP Verification Step
    if (otpStep) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-blue-50 via-white to-blue-50 p-4">
                <div className="max-w-md w-full space-y-8 bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-200">
                    <div className="text-center">
                        <div className="flex justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h2 className="mt-4 text-3xl font-extrabold text-gray-900">Verify Your Email</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            {isDummyMode ? (
                                "Development Mode: Use dummy OTP below"
                            ) : (
                                "We've sent a 6-digit OTP to"
                            )}
                        </p>
                        <p className="text-blue-600 font-medium">{userEmail}</p>
                        
                        {isDummyMode && (
                            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-yellow-800">Development Mode</p>
                                        <p className="text-sm text-yellow-700">Use OTP: <span className="font-bold font-mono">123456</span></p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <form className="mt-8 space-y-6" onSubmit={handleOtpSubmit}>
                        <div>
                            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">Enter OTP Code</label>
                            <input
                                id="otp"
                                name="otp"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength="6"
                                required
                                className="appearance-none relative block w-full px-3 py-3 border border-gray-300 rounded-lg placeholder-gray-500 text-gray-900 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10"
                                placeholder="000000"
                                value={otpCode}
                                onChange={handleOtpChange}
                            />
                            <p className="mt-1 text-xs text-gray-500">Check your email inbox and spam folder</p>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={otpLoading}
                                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white ${
                                    otpLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200`}
                            >
                                {otpLoading ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Verifying...
                                    </span>
                                ) : (
                                    'Verify & Complete Registration'
                                )}
                            </button>
                        </div>

                        <div className="flex flex-col space-y-4 text-center text-sm">
                            <div>
                                {countdown > 0 ? (
                                    <p className="text-gray-500">
                                        Resend OTP in {countdown} seconds
                                    </p>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleResendOtp}
                                        disabled={resendLoading}
                                        className="font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200 disabled:opacity-50"
                                    >
                                        {resendLoading ? 'Sending...' : 'Resend OTP'}
                                    </button>
                                )}
                            </div>
                            
                            <button
                                type="button"
                                onClick={handleBackToSignup}
                                className="font-medium text-gray-600 hover:text-gray-500 transition-colors duration-200"
                            >
                                ← Back to signup form
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // Original Signup Form
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-blue-50 via-white to-blue-50 p-4">
            <div className="max-w-md w-full space-y-8 bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-200">
                <div className="text-center">
                    <div className="flex justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <h2 className="mt-4 text-3xl font-extrabold text-gray-900">Create your account</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Already have an account?{' '}
                        <a href="/login" className="font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200">
                            Sign in
                        </a>
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4 rounded-md">
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Username <span className="text-blue-600 font-medium">(Used for login)</span></label>
                            <div className="relative">
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    className={`appearance-none relative block w-full px-3 py-2 border ${usernameError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'} rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:z-10 sm:text-sm`}
                                    placeholder="Choose a username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    onBlur={(e) => checkUsernameAvailability(e.target.value)}
                                />
                                {checkingUsername && (
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                        <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                )}
                            </div>
                            {usernameError ? (
                                <p className="mt-1 text-xs text-red-600">{usernameError}</p>
                            ) : (
                                <p className="mt-1 text-xs text-gray-500">You'll use this username to log in to your account.</p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="fullname" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input
                                id="fullname"
                                name="fullname"
                                type="text"
                                required
                                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Your full name"
                                value={formData.fullname}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email address <span className="text-red-500">*</span></label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                            <p className="mt-1 text-xs text-gray-500">Required for OTP verification</p>
                        </div>
                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                            <input
                                id="phone"
                                name="phone"
                                type="tel"
                                required
                                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Your phone number"
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select
                                id="role"
                                name="role"
                                required
                                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                value={formData.role}
                                onChange={handleChange}
                            >
                                <option value="">Select your role</option>
                                <option value="teacher">Teacher</option>
                                <option value="student">Student</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="grade" className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
                            <select
                                id="grade"
                                name="grade"
                                required
                                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                value={formData.grade}
                                onChange={handleChange}
                            >
                                {gradeOptions.map((grade) => (
                                    <option key={grade} value={grade}>
                                        Grade {grade}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Create a strong password"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 rounded-lg placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Confirm your password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white ${
                                loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200`}
                        >
                            {loading ? (
                                <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending OTP...
                                </span>
                            ) : (
                                <span className="flex items-center">
                                    Send OTP to Email
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </span>
                            )}
                        </button>
                    </div>
                    <div className="text-center text-xs text-gray-500">
                        By signing up, you agree to our terms of service and privacy policy.
                        <br />
                        <strong>Note:</strong> You'll receive an OTP on your email to verify and complete registration.
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Signup;
