import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../utils/axios';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';

const ChapterCard = ({ chapter, onChapterSelect }) => {
  const [isResetting, setIsResetting] = useState(false);
  const { authToken } = useAuth();
  
  const handleResetProgress = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm("Are you sure you want to reset your progress for this chapter? All your answered questions will be reset.")) {
      return;
    }
    
    setIsResetting(true);
    
    try {
      const response = await axios.post(`/api/chat/reset-questions/${chapter._id}`, {}, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      
      if (response.data && response.data.success) {
        toast.success("Progress reset successfully!");
      } else {
        toast.error("Failed to reset progress");
      }
    } catch (error) {
      console.error("Error resetting progress:", error);
      toast.error(error.response?.data?.error || "Failed to reset progress");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden transform transition-all hover:scale-[1.02] cursor-pointer">
      <div className="p-4 h-full flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{chapter.title}</h3>
          <p className="text-sm text-gray-600 line-clamp-2 mt-1">
            {chapter.description || "No description available"}
          </p>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="flex space-x-2">
            <Link 
              to={`/chat/${chapter._id}`} 
              className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                if (onChapterSelect) onChapterSelect(chapter);
              }}
            >
              Test
            </Link>
            
            <button
              className={`px-3 py-1.5 text-sm rounded transition-colors ${isResetting ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'}`}
              onClick={handleResetProgress}
              disabled={isResetting}
            >
              {isResetting ? 'Resetting...' : 'Reset'}
            </button>
          </div>
          
          {chapter.questionPrompt && chapter.questionPrompt.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              {chapter.questionPrompt.length} Questions
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChapterCard; 