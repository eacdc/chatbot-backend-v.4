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
  const [activeTab, setActiveTab] = useState("profile"); // Default to profile tab

  // Add debugging
  useEffect(() => {
    console.log("Profile component mounted");
    console.log("Current active tab:", activeTab);
  }, [activeTab]);

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
    setLoadingScores(true);
    try {
      console.log('Fetching user answer history...');
      const res = await axios.get(`/api/chat/answers/${userId}`);
      console.log('Answers response:', res.data);
      
      if (res.data && Array.isArray(res.data)) {
        // Group answers by chapter
        const answersByChapter = {};
        
        res.data.forEach(answer => {
          const chapterId = answer.chapterId?._id || answer.chapterId;
          if (!answersByChapter[chapterId]) {
            answersByChapter[chapterId] = {
              chapterId: chapterId,
              chapterTitle: answer.chapterId?.title || 'Unknown Chapter',
              bookTitle: answer.bookId?.title || 'Unknown Book',
              subject: answer.bookId?.subject || 'N/A',
              grade: answer.bookId?.grade || 'N/A',
              answers: [],
              totalMarks: 0,
              earnedMarks: 0,
              latestAttempt: answer.createdAt,
            };
          }
          
          // Add answer to the chapter group
          answersByChapter[chapterId].answers.push(answer);
          answersByChapter[chapterId].totalMarks += answer.questionMarks || 0;
          answersByChapter[chapterId].earnedMarks += answer.score || 0;
          
          // Update latest attempt if this answer is more recent
          if (new Date(answer.createdAt) > new Date(answersByChapter[chapterId].latestAttempt)) {
            answersByChapter[chapterId].latestAttempt = answer.createdAt;
          }
        });
        
        // Convert grouped data to array and add calculated fields
        const processedScores = Object.values(answersByChapter).map(chapter => {
          // Calculate percentage
          const percentage = chapter.totalMarks > 0 ? 
            (chapter.earnedMarks / chapter.totalMarks) * 100 : 0;
          
          // Determine completion status
          let completionStatus = 'partial';
          // We don't have total questions info here, so use answers count as indicator
          if (chapter.answers.length >= 5) {  // Assuming a minimum of 5 questions indicates completion
            completionStatus = 'complete';
          } else if (chapter.answers.length === 0) {
            completionStatus = 'abandoned';
          }
          
          return {
            ...chapter,
            scoreDate: new Date(chapter.latestAttempt).toLocaleDateString(),
            scoreTime: new Date(chapter.latestAttempt).toLocaleTimeString(),
            scorePercentage: percentage.toFixed(1) + '%',
            questionsAnswered: chapter.answers.length,
            completionStatus,
            completionLabel: getCompletionLabel(completionStatus),
            questionsProgress: `${chapter.answers.length}`,
            marksProgress: `${chapter.earnedMarks}/${chapter.totalMarks}`
          };
        });
        
        // Sort by most recent
        processedScores.sort((a, b) => new Date(b.latestAttempt) - new Date(a.latestAttempt));
        
        console.log('Processed chapter scores:', processedScores);
        setScores(processedScores);
      } else {
        console.log('No answers or invalid data format received');
        setScores([]);
      }
    } catch (error) {
      console.error('Error fetching answers:', error);
      toast.error('Failed to load score history');
    } finally {
      setLoadingScores(false);
    }
  };

  // Helper function to get completion label based on status
  const getCompletionLabel = (status) => {
    switch(status) {
      case 'complete':
        return 'Completed';
      case 'partial':
        return 'In Progress';
      case 'abandoned':
        return 'Not Started';
      default:
        return 'Not Started';
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
          {/* Profile Header with Avatar - Always visible at the top */}
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
          
          {/* Personal Information Card - Always visible below the header */}
          <div className="relative px-8 -mt-12 mb-6 z-10">
            <div className="bg-white rounded-xl shadow-md p-6">
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
          </div>
          
          {/* Tabs - For switching between profile info and scores */}
          <div className="px-8">
            <div className="bg-white rounded-lg shadow flex overflow-x-auto">
              <button
                onClick={() => setActiveTab("profile")}
                className={`py-3 px-6 flex-1 text-center font-medium ${
                  activeTab === "profile" 
                    ? "text-blue-600 border-b-2 border-blue-600" 
                    : "text-gray-600 hover:text-blue-500"
                }`}
              >
                Additional Info
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
          
          {/* Tab content */}
          <div className="px-8 py-6">
            {activeTab === "scores" && (
              <div className="scores-container">
                {loadingScores ? (
                  <div className="loading">Loading your scores...</div>
                ) : scores.length > 0 ? (
                  <div className="scores-list">
                    <h3>Your Assessment Scores</h3>
                    {scores.map((score, index) => (
                      <div key={index} className="score-card">
                        <div className="score-header">
                          <h4>{score.chapterId?.title || 'Unknown Chapter'}</h4>
                          <span className={`completion-badge ${score.completionStatus}`}>
                            {score.completionLabel}
                          </span>
                        </div>
                        <div className="score-details">
                          <p>Book: {score.bookId?.title || 'Unknown'}</p>
                          <p>Subject: {score.bookId?.subject || 'N/A'}</p>
                          <p>Grade: {score.bookId?.grade || 'N/A'}</p>
                          <p>Questions: {score.questionsProgress}</p>
                          <p>Marks: {score.marksProgress}</p>
                          <p>Score: {score.scorePercentage}</p>
                          <p>Date: {score.scoreDate} at {score.scoreTime}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-scores">
                    <p>You haven't taken any assessments yet.</p>
                    <p>Complete chapter assessments to see your scores here.</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-center mt-6">
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