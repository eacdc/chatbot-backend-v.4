import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "../config";

const ForgotPassword = () => {
    const navigate = useNavigate();
    
    const [formData, setFormData] = useState({
        email: "",
        otp: "",
        newPassword: "",
        confirmPassword: ""
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState("");
    
    // OTP verification states
    const [otpStep, setOtpStep] = useState(false); // false = email form, true = OTP verification
    const [otpLoading, setOtpLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [userEmail, setUserEmail] = useState("");

    // Countdown timer for resend OTP
    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError(""); // Clear error when user starts typing
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!formData.email.trim()) {
            setError("Please enter your email address.");
            setLoading(false);
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email.trim())) {
            setError("Please enter a valid email address.");
            setLoading(false);
            return;
        }

        try {
            console.log("Requesting password reset OTP for:", formData.email);
            
            const response = await axios.post(API_ENDPOINTS.FORGOT_PASSWORD, {
                email: formData.email.trim()
            });
            
            console.log("Password reset OTP sent successfully:", response.data);
            
            setUserEmail(formData.email.trim());
            setOtpStep(true);
            setCountdown(60); // Start 60-second countdown for resend
            setSuccess("OTP sent to your email address. Please check your inbox.");
            
        } catch (error) {
            console.error("Password Reset Request Error:", error.response?.data?.message || error.message);
            setError(error.response?.data?.message || "Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setOtpLoading(true);

        if (!formData.otp.trim()) {
            setError("Please enter the OTP code.");
            setOtpLoading(false);
            return;
        }

        if (formData.otp.trim().length !== 6) {
            setError("OTP must be 6 digits.");
            setOtpLoading(false);
            return;
        }

        if (!formData.newPassword.trim()) {
            setError("Please enter your new password.");
            setOtpLoading(false);
            return;
        }

        if (formData.newPassword.length < 6) {
            setError("Password must be at least 6 characters long.");
            setOtpLoading(false);
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            setError("Passwords do not match.");
            setOtpLoading(false);
            return;
        }

        try {
            console.log("Verifying password reset OTP:", formData.otp);
            
            const response = await axios.post(API_ENDPOINTS.RESET_PASSWORD, {
                email: userEmail,
                otp: formData.otp.trim(),
                newPassword: formData.newPassword.trim()
            });
            
            console.log("Password reset successful:", response.data);
            
            // Show success message
            alert("Password reset successfully! You can now login with your new password.");
            navigate("/login");
            
        } catch (error) {
            console.error("Password Reset Error:", error.response?.data?.message || error.message);
            setError(error.response?.data?.message || "Invalid OTP. Please try again.");
        } finally {
            setOtpLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setError("");
        setResendLoading(true);

        try {
            console.log("Resending password reset OTP for:", userEmail);
            
            const response = await axios.post(API_ENDPOINTS.RESEND_PASSWORD_RESET_OTP, {
                email: userEmail
            });
            
            console.log("Password reset OTP resent successfully:", response.data);
            
            setCountdown(60); // Reset countdown
            setSuccess("New OTP sent to your email address.");
            
        } catch (error) {
            console.error("Resend OTP Error:", error.response?.data?.message || error.message);
            setError(error.response?.data?.message || "Failed to resend OTP. Please try again.");
        } finally {
            setResendLoading(false);
        }
    };

    const goBackToEmail = () => {
        setOtpStep(false);
        setFormData(prev => ({ ...prev, otp: "", newPassword: "", confirmPassword: "" }));
        setError("");
        setSuccess("");
        setCountdown(0);
    };

    if (otpStep) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8">
                    <div>
                        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                            Reset Your Password
                        </h2>
                        <p className="mt-2 text-center text-sm text-gray-600">
                            Enter the OTP sent to {userEmail}
                        </p>
                    </div>
                    
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                            {success}
                        </div>
                    )}
                    
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <form className="mt-8 space-y-6" onSubmit={handleOtpSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                                    OTP Code
                                </label>
                                <input
                                    id="otp"
                                    name="otp"
                                    type="text"
                                    maxLength="6"
                                    required
                                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                    placeholder="Enter 6-digit OTP"
                                    value={formData.otp}
                                    onChange={handleInputChange}
                                />
                            </div>
                            
                            <div>
                                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                                    New Password
                                </label>
                                <input
                                    id="newPassword"
                                    name="newPassword"
                                    type="password"
                                    required
                                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                    placeholder="Enter new password"
                                    value={formData.newPassword}
                                    onChange={handleInputChange}
                                />
                            </div>
                            
                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                                    Confirm New Password
                                </label>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    required
                                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                    placeholder="Confirm new password"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={otpLoading}
                                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {otpLoading ? "Resetting Password..." : "Reset Password"}
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={goBackToEmail}
                                className="text-sm text-indigo-600 hover:text-indigo-500"
                            >
                                ← Back to Email
                            </button>
                            
                            <button
                                type="button"
                                onClick={handleResendOtp}
                                disabled={resendLoading || countdown > 0}
                                className="text-sm text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                            >
                                {resendLoading ? "Sending..." : countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Forgot Your Password?
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Enter your email address and we'll send you an OTP to reset your password.
                    </p>
                </div>
                
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                        {error}
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                            Email Address
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                            placeholder="Enter your email address"
                            value={formData.email}
                            onChange={handleInputChange}
                        />
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {loading ? "Sending OTP..." : "Send Reset OTP"}
                        </button>
                    </div>

                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => navigate("/login")}
                            className="text-sm text-indigo-600 hover:text-indigo-500"
                        >
                            ← Back to Login
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ForgotPassword;
