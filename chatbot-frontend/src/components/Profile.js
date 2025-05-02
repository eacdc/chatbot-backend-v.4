import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_ENDPOINTS } from "../config";
import { updateLastActivity, isAuthenticated } from "../utils/auth";
import { toast } from "react-toastify";

const Profile = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scores, setScores] = useState([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  // Update activity timestamp on component mount
  useEffect(() => {
    // Check if user is authenticated and update activity timestamp
    if (isAuthenticated()) {
      updateLastActivity();
    } else {
      // Redirect to login if not authenticated
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        setLoading(true);
        const response = await axios.get(API_ENDPOINTS.GET_USER, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        console.log("User profile data:", response.data);
        setUserData(response.data);
        setLoading(false);

        // Once we have user data, fetch scores
        if (response.data && response.data._id) {
          fetchUserScores(response.data._id);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setError("Failed to load profile data. Please try again later.");
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [navigate]);

  const fetchUserScores = async (userId) => {
    try {
      setLoadingScores(true);
      const token = localStorage.getItem("token");
      
      const response = await axios.get(`/api/chat/scores/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log("User scores:", response.data);
      setScores(response.data);
      setLoadingScores(false);
    } catch (error) {
      console.error("Error fetching user scores:", error);
      toast.error("Failed to load score data");
      setLoadingScores(false);
    }
  };

  // Get role display text with proper capitalization
  const getRoleDisplay = (role) => {
    if (!role) return "";
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const handleBackToChat = () => {
    navigate("/chat");
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-gray-100 p-4">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-gray-100 p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 max-w-md w-full border border-red-100">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Profile</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button 
              onClick={handleBackToChat} 
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              Back to Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Your Profile</h1>
          <p className="mt-2 text-gray-600">View and manage your account information</p>
        </div>

        <div className="bg-white shadow-lg rounded-2xl overflow-hidden">
          {/* Profile Header with Avatar */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 pt-8 pb-20 px-8 text-white relative">
            <div className="flex items-center">
              <div className="h-24 w-24 rounded-full bg-white p-1 shadow-xl">
                <div className="h-full w-full rounded-full bg-blue-200 flex items-center justify-center text-blue-800 text-3xl font-bold">
                  {userData?.username?.charAt(0).toUpperCase() || "U"}
                </div>
              </div>
              <div className="ml-6">
                <h2 className="text-2xl font-bold">{userData?.fullname}</h2>
                <p className="text-blue-100 font-medium">{getRoleDisplay(userData?.role)}</p>
              </div>
            </div>
            
            <button 
              onClick={handleBackToChat}
              className="absolute top-4 right-4 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-2 transition-colors duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Tabs */}
          <div className="px-8 -mt-8 mb-4">
            <div className="bg-white rounded-lg shadow flex overflow-x-auto">
              <button
                onClick={() => setActiveTab("profile")}
                className={`py-3 px-6 flex-1 text-center font-medium ${
                  activeTab === "profile" 
                    ? "text-blue-600 border-b-2 border-blue-600" 
                    : "text-gray-600 hover:text-blue-500"
                }`}
              >
                Personal Info
              </button>
              <button
                onClick={() => setActiveTab("scores")}
                className={`py-3 px-6 flex-1 text-center font-medium ${
                  activeTab === "scores" 
                    ? "text-blue-600 border-b-2 border-blue-600" 
                    : "text-gray-600 hover:text-blue-500"
                }`}
              >
                Scores & Progress
              </button>
            </div>
          </div>
          
          {/* Profile Details */}
          <div className="px-8 py-10 -mt-6">
            {activeTab === "profile" && (
              <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Personal Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Username</label>
                    <p className="text-gray-900 text-lg">{userData?.username || "Not set"}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
                    <p className="text-gray-900 text-lg">{userData?.fullname || "Not set"}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                    <p className="text-gray-900 text-lg">{userData?.email || "Not set"}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
                    <p className="text-gray-900 text-lg">{userData?.phone || "Not set"}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Account Type</label>
                    <p className="text-gray-900 text-lg">{getRoleDisplay(userData?.role) || "Not set"}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Member Since</label>
                    <p className="text-gray-900 text-lg">
                      {userData?.createdAt 
                        ? new Date(userData.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          }) 
                        : "Unknown"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "scores" && (
              <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Your Progress & Scores</h3>
                
                {loadingScores ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-blue-600"></div>
                  </div>
                ) : scores && scores.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b">
                          <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Chapter</th>
                          <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Subject</th>
                          <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Date</th>
                          <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Score</th>
                          <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {scores.map((score) => (
                          <tr key={score._id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm text-gray-800">
                              {score.chapterId && typeof score.chapterId === 'object' 
                                ? score.chapterId.title 
                                : 'Unknown Chapter'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-800">
                              {score.bookId && typeof score.bookId === 'object' 
                                ? `${score.bookId.subject || 'Unknown'} (Grade ${score.bookId.grade || 'N/A'})` 
                                : 'Unknown Book'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {formatDate(score.createdAt)}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center">
                                <span className="font-medium text-sm">
                                  {score.totalMarksObtained}/{score.totalQuestionMarks}
                                </span>
                                <span className="ml-2 px-2 py-1 text-xs rounded-full font-medium" 
                                  style={{ 
                                    backgroundColor: score.scorePercentage >= 80 
                                      ? '#dcfce7' 
                                      : score.scorePercentage >= 60 
                                        ? '#fef9c3' 
                                        : '#fee2e2',
                                    color: score.scorePercentage >= 80 
                                      ? '#166534' 
                                      : score.scorePercentage >= 60 
                                        ? '#854d0e' 
                                        : '#991b1b'
                                  }}>
                                  {Math.round(score.scorePercentage)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                score.completionStatus === 'complete' 
                                  ? 'bg-green-100 text-green-800' 
                                  : score.completionStatus === 'partial' 
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                              }`}>
                                {score.completionStatus === 'complete' 
                                  ? 'Completed' 
                                  : score.completionStatus === 'partial' 
                                    ? 'In Progress'
                                    : 'Abandoned'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <h4 className="text-lg font-medium text-gray-800 mb-2">No Scores Yet</h4>
                    <p className="text-gray-600 mb-4">You haven't completed any chapter assessments yet.</p>
                    <button 
                      onClick={handleBackToChat}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Start Learning
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-center">
              <button 
                onClick={handleBackToChat}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back to Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile; 