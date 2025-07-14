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

  // Add edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    fullname: "",
    email: "",
    phone: "",
    grade: "",
    publisher: ""
  });
  const [updateLoading, setUpdateLoading] = useState(false);
  
  // Profile picture states
  const [profilePictureLoading, setProfilePictureLoading] = useState(false);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [profilePictureFile, setProfilePictureFile] = useState(null);

  // Add debugging
  useEffect(() => {
    console.log("Profile component mounted");
    console.log("Current active tab:", activeTab);
  }, [activeTab]);

  // Initialize edit form data when userData changes
  useEffect(() => {
    if (userData) {
      setEditFormData({
        fullname: userData.fullname || "",
        email: userData.email || "",
        phone: userData.phone || "",
        grade: userData.grade || "",
        publisher: userData.publisher || ""
      });
    }
  }, [userData]);

  // Auto-switch to scores tab if assessment data is available (only once)
  const [hasAutoSwitched, setHasAutoSwitched] = useState(false);
  useEffect(() => {
    if (scores.length > 0 && activeTab === "profile" && !hasAutoSwitched) {
      console.log("Assessment data available, switching to scores tab");
      setActiveTab("scores");
      setHasAutoSwitched(true);
    }
  }, [scores, activeTab, hasAutoSwitched]);

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

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle edit mode toggle
  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel edit - reset form data
      setEditFormData({
        fullname: userData.fullname || "",
        email: userData.email || "",
        phone: userData.phone || "",
        grade: userData.grade || "",
        publisher: userData.publisher || ""
      });
    }
    setIsEditing(!isEditing);
  };

  // Handle profile update
  const handleUpdateProfile = async () => {
    setUpdateLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login again");
        navigate("/login");
        return;
      }

      const response = await axios.put(
        API_ENDPOINTS.UPDATE_USER_PROFILE,
        editFormData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.message) {
        toast.success(response.data.message);
      } else {
        toast.success("Profile updated successfully");
      }

      // Update local userData with the new data
      setUserData(response.data.user);
      setIsEditing(false);
      
    } catch (error) {
      console.error("Error updating profile:", error);
      const errorMessage = error.response?.data?.message || "Failed to update profile";
      toast.error(errorMessage);
    } finally {
      setUpdateLoading(false);
    }
  };

  // Handle profile picture selection
  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("Please select a valid image file");
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      
      setProfilePictureFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePicturePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = async () => {
    if (!profilePictureFile) return;
    
    setProfilePictureLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login again");
        navigate("/login");
        return;
      }

      const formData = new FormData();
      formData.append('profilePicture', profilePictureFile);

      const response = await axios.post(
        API_ENDPOINTS.UPLOAD_PROFILE_PICTURE,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.message) {
        toast.success(response.data.message);
      } else {
        toast.success("Profile picture updated successfully");
      }

      // Update local userData with the new data
      setUserData(response.data.user);
      setProfilePictureFile(null);
      setProfilePicturePreview(null);
      
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      const errorMessage = error.response?.data?.error || "Failed to upload profile picture";
      toast.error(errorMessage);
    } finally {
      setProfilePictureLoading(false);
    }
  };

  // Handle profile picture deletion
  const handleProfilePictureDelete = async () => {
    setProfilePictureLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login again");
        navigate("/login");
        return;
      }

      const response = await axios.delete(
        API_ENDPOINTS.DELETE_PROFILE_PICTURE,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.message) {
        toast.success(response.data.message);
      } else {
        toast.success("Profile picture deleted successfully");
      }

      // Update local userData with the new data
      setUserData(response.data.user);
      
    } catch (error) {
      console.error("Error deleting profile picture:", error);
      const errorMessage = error.response?.data?.error || "Failed to delete profile picture";
      toast.error(errorMessage);
    } finally {
      setProfilePictureLoading(false);
    }
  };

  // Cancel profile picture selection
  const handleProfilePictureCancelSelection = () => {
    setProfilePictureFile(null);
    setProfilePicturePreview(null);
  };

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
      console.log('Fetching user statistics for userId:', userId);
      const token = localStorage.getItem("token");
      const statsUrl = `${API_ENDPOINTS.GET_USER_STATS}/${userId}`;
      console.log('Stats URL:', statsUrl);
      console.log('Token available:', !!token);
      
      const res = await axios.get(statsUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('Stats response:', res.data);
      console.log('Stats response status:', res.status);
      
      if (res.data && res.data.success && res.data.data) {
        const statsData = res.data.data;
        console.log('Stats data received:', statsData);
        console.log('Chapter stats count:', statsData.chapterStats?.length || 0);
        console.log('Total questions answered:', statsData.totalQuestionsAnswered || 0);
        
        // Convert chapter stats to the format expected by the UI
        const processedScores = statsData.chapterStats.map(chapter => ({
          chapterId: chapter.chapterId,
          chapterTitle: chapter.chapterTitle,
          bookId: chapter.bookId,
          bookTitle: chapter.bookTitle,
          subject: chapter.subject,
          grade: chapter.grade,
          questionsAnswered: chapter.questionsAnswered,
          totalQuestions: chapter.totalQuestions,
          earnedMarks: chapter.marksEarned,
          totalMarks: chapter.marksAvailable,
          scorePercentage: chapter.percentage.toFixed(1) + '%',
          correctAnswers: chapter.correctAnswers,
          partialAnswers: chapter.partialAnswers,
          incorrectAnswers: chapter.incorrectAnswers,
          timeSpentMinutes: chapter.timeSpentMinutes,
          lastAttempted: chapter.lastAttempted,
          firstAttempted: chapter.firstAttempted,
          completionStatus: chapter.completionStatus,
          completionLabel: getCompletionLabel(chapter.completionStatus),
          questionsProgress: `${chapter.questionsAnswered}/${chapter.totalQuestions}`,
          marksProgress: `${chapter.marksEarned}/${chapter.marksAvailable}`,
          scoreDate: chapter.lastAttempted ? new Date(chapter.lastAttempted).toLocaleDateString() : 'N/A',
          scoreTime: chapter.lastAttempted ? new Date(chapter.lastAttempted).toLocaleTimeString() : 'N/A'
        }));
        
        console.log('Processed chapter scores:', processedScores);
        setScores(processedScores);
        
        // Store overall stats for potential use
        setUserData(prev => ({
          ...prev,
          overallStats: {
            totalBooksAttempted: statsData.totalBooksAttempted,
            totalChaptersAttempted: statsData.totalChaptersAttempted,
            totalQuestionsAnswered: statsData.totalQuestionsAnswered,
            totalMarksEarned: statsData.totalMarksEarned,
            totalMarksAvailable: statsData.totalMarksAvailable,
            overallPercentage: statsData.overallPercentage,
            bookStats: statsData.bookStats,
            recentActivity: statsData.recentActivity
          }
        }));
      } else {
        console.log('No stats data received or invalid response structure');
        console.log('Response data:', res.data);
        setScores([]);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      toast.error('Failed to load statistics');
    } finally {
      setLoadingScores(false);
    }
  };

  // Helper function to get completion label based on status
  const getCompletionLabel = (status) => {
    switch(status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'not_started':
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
              <div className="relative h-24 w-24 rounded-full bg-white p-1 shadow-xl">
                {userData?.profilePicture ? (
                  <img
                    src={userData.profilePicture}
                    alt="Profile"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : profilePicturePreview ? (
                  <img
                    src={profilePicturePreview}
                    alt="Profile Preview"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                <div className="h-full w-full rounded-full bg-blue-200 flex items-center justify-center text-blue-800 text-3xl font-bold">
                  {userData?.username?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
                
                {/* Profile Picture Upload/Change Button */}
                <div className="absolute -bottom-1 -right-1">
                  <label className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 cursor-pointer shadow-lg transition-colors duration-200 block">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              
              <div className="ml-6 flex-1">
                <h2 className="text-2xl font-bold">{userData?.fullname}</h2>
                <p className="text-blue-100 font-medium">{getRoleDisplay(userData?.role)}</p>
                
                {/* Profile Picture Management Buttons */}
                {(profilePictureFile || userData?.profilePicture) && (
                  <div className="mt-3 flex space-x-2">
                    {profilePictureFile && (
                      <>
                        <button
                          onClick={handleProfilePictureUpload}
                          disabled={profilePictureLoading}
                          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200"
                        >
                          {profilePictureLoading ? 'Uploading...' : 'Save Picture'}
                        </button>
                        <button
                          onClick={handleProfilePictureCancelSelection}
                          disabled={profilePictureLoading}
                          className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    
                    {userData?.profilePicture && !profilePictureFile && (
                      <button
                        onClick={handleProfilePictureDelete}
                        disabled={profilePictureLoading}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200"
                      >
                        {profilePictureLoading ? 'Deleting...' : 'Remove Picture'}
                      </button>
                    )}
                  </div>
                )}
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
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                
                {/* Edit/Save/Cancel buttons */}
                <div className="flex space-x-2">
                  {!isEditing ? (
                    <button
                      onClick={handleEditToggle}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Profile
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleUpdateProfile}
                        disabled={updateLoading}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {updateLoading ? (
                          <svg className="animate-spin h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {updateLoading ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleEditToggle}
                        disabled={updateLoading}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Username</label>
                  <p className="text-gray-900 text-lg">{userData?.username || "Not set"}</p>
                  <p className="text-xs text-gray-400 mt-1">Username cannot be changed</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="fullname"
                      value={editFormData.fullname}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your full name"
                    />
                  ) : (
                  <p className="text-gray-900 text-lg">{userData?.fullname || "Not set"}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                  {isEditing ? (
                    <input
                      type="email"
                      name="email"
                      value={editFormData.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your email address"
                    />
                  ) : (
                  <p className="text-gray-900 text-lg">{userData?.email || "Not set"}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      name="phone"
                      value={editFormData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your phone number"
                    />
                  ) : (
                  <p className="text-gray-900 text-lg">{userData?.phone || "Not set"}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Grade</label>
                  {isEditing ? (
                    <select
                      name="grade"
                      value={editFormData.grade}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select grade</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(grade => (
                        <option key={grade} value={grade.toString()}>{grade}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900 text-lg">{userData?.grade || "Not set"}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Publisher</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="publisher"
                      value={editFormData.publisher}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter publisher preference"
                    />
                  ) : (
                    <p className="text-gray-900 text-lg">{userData?.publisher || "Not set"}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Account Type</label>
                  <p className="text-gray-900 text-lg">{getRoleDisplay(userData?.role) || "Not set"}</p>
                  <p className="text-xs text-gray-400 mt-1">Account type cannot be changed</p>
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
              <div className="space-y-6">
                {/* Overall Statistics Summary */}
                {userData?.overallStats && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">📊 Overall Performance</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{userData.overallStats.totalBooksAttempted}</div>
                        <div className="text-sm text-gray-600">Books Started</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{userData.overallStats.totalChaptersAttempted}</div>
                        <div className="text-sm text-gray-600">Chapters</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{userData.overallStats.totalQuestionsAnswered}</div>
                        <div className="text-sm text-gray-600">Questions</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{userData.overallStats.overallPercentage.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600">Overall Score</div>
                      </div>
                    </div>
                    <div className="mt-4 text-center">
                      <div className="text-lg text-gray-700">
                        <span className="font-semibold">{userData.overallStats.totalMarksEarned}</span> out of{' '}
                        <span className="font-semibold">{userData.overallStats.totalMarksAvailable}</span> total marks earned
                      </div>
                    </div>
                  </div>
                )}

                {loadingScores ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading your progress...</span>
                  </div>
                ) : scores.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">📚 Chapter Progress</h3>
                    {scores.map((score, index) => (
                      <div key={index} className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors duration-200 overflow-hidden">
                        <div className="p-6">
                          {/* Header */}
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <h4 className="text-lg font-semibold text-gray-900">{score.chapterTitle}</h4>
                              <p className="text-sm text-gray-600">{score.bookTitle} • {score.subject} • Grade {score.grade}</p>
                            </div>
                            <div className="flex items-center ml-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                score.completionStatus === 'completed' ? 'bg-green-100 text-green-800' :
                                score.completionStatus === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {score.completionLabel}
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-4">
                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                              <span>Progress</span>
                              <span>{score.scorePercentage}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                                style={{ width: score.scorePercentage }}
                              ></div>
                            </div>
                          </div>

                          {/* Detailed Stats */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="text-center p-3 bg-blue-50 rounded-lg">
                              <div className="text-lg font-semibold text-blue-600">{score.questionsProgress}</div>
                              <div className="text-xs text-gray-600">Questions</div>
                            </div>
                            <div className="text-center p-3 bg-green-50 rounded-lg">
                              <div className="text-lg font-semibold text-green-600">{score.marksProgress}</div>
                              <div className="text-xs text-gray-600">Marks</div>
                            </div>
                            <div className="text-center p-3 bg-purple-50 rounded-lg">
                              <div className="text-lg font-semibold text-purple-600">
                                {score.correctAnswers || 0}✓ {score.incorrectAnswers || 0}✗
                              </div>
                              <div className="text-xs text-gray-600">Correct/Wrong</div>
                            </div>
                            <div className="text-center p-3 bg-orange-50 rounded-lg">
                              <div className="text-lg font-semibold text-orange-600">
                                {score.timeSpentMinutes > 0 ? `${score.timeSpentMinutes}m` : 'N/A'}
                              </div>
                              <div className="text-xs text-gray-600">Time Spent</div>
                            </div>
                          </div>

                          {/* Last Attempt */}
                          <div className="flex justify-between items-center text-sm text-gray-500 pt-4 border-t border-gray-100">
                            <span>Last attempted: {score.scoreDate} at {score.scoreTime}</span>
                            {score.partialAnswers > 0 && (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                                {score.partialAnswers} partial answers
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Assessment Data</h3>
                    <p className="text-gray-600 mb-4">You haven't taken any assessments yet.</p>
                    <p className="text-sm text-gray-500">Complete chapter assessments to see your detailed progress here.</p>
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