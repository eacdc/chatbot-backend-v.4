import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { isAdmin, getAdminToken } from "../../utils/auth";
import { API_ENDPOINTS } from "../../config/api";
import { FaEdit, FaSave, FaSync } from "react-icons/fa";
import "./SystemPrompts.css";

const SystemPrompts = () => {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState({});

  useEffect(() => {
    if (!isAdmin()) {
      setError("Admin access required");
      setLoading(false);
      return;
    }
    
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const token = getAdminToken();
      const response = await axios.get(API_ENDPOINTS.GET_SYSTEM_PROMPTS, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPrompts(response.data);
      // Initialize edit mode state for each prompt
      const initialEditMode = {};
      response.data.forEach(prompt => {
        initialEditMode[prompt._id] = false;
      });
      setEditMode(initialEditMode);
      setError(null);
    } catch (err) {
      setError("Failed to fetch system prompts: " + (err.response?.data?.error || err.message));
      toast.error("Error loading prompts");
    } finally {
      setLoading(false);
    }
  };

  const handleEditToggle = (promptId) => {
    setEditMode(prev => ({
      ...prev,
      [promptId]: !prev[promptId]
    }));
  };

  const handlePromptChange = (promptId, field, value) => {
    setPrompts(prev => 
      prev.map(prompt => 
        prompt._id === promptId 
          ? { ...prompt, [field]: value } 
          : prompt
      )
    );
  };

  const handleSavePrompt = async (promptId) => {
    try {
      const token = getAdminToken();
      const promptToUpdate = prompts.find(p => p._id === promptId);
      
      await axios.post(API_ENDPOINTS.UPDATE_SYSTEM_PROMPT, {
        type: promptToUpdate.type,
        prompt: promptToUpdate.prompt,
        isActive: promptToUpdate.isActive
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Prompt updated successfully");
      setEditMode(prev => ({
        ...prev,
        [promptId]: false
      }));
    } catch (err) {
      toast.error("Failed to update prompt: " + (err.response?.data?.error || err.message));
    }
  };

  const getPromptTypeLabel = (type) => {
    switch(type) {
      case "goodText": return "Good Text Processing";
      case "qna": return "QnA Generation";
      case "finalPrompt": return "Final Prompt";
      default: return type;
    }
  };

  if (loading) return <div className="loading-container">Loading system prompts...</div>;
  if (error) return <div className="error-container">{error}</div>;

  return (
    <div className="system-prompts-container">
      <div className="prompts-header">
        <h2>System Prompts Management</h2>
        <button 
          className="refresh-button"
          onClick={fetchPrompts} 
          title="Refresh prompts"
        >
          <FaSync />
        </button>
      </div>
      
      <div className="prompts-description">
        <p>
          System prompts control how the AI generates content. Edit these prompts carefully as they
          directly impact the quality and format of generated content.
        </p>
        <p>
          <strong>Note:</strong> Use {"{placeholders}"} for dynamic values:
          <ul>
            <li>{"{grade}"} - Student grade level</li>
            <li>{"{subject}"} - Subject being studied</li>
            <li>{"{chapterTitle}"} - Chapter title</li>
            <li>{"{qnaOutput}"} - Questions and answers content</li>
          </ul>
        </p>
      </div>
      
      <div className="prompts-list">
        {prompts.length === 0 ? (
          <div className="no-prompts">No system prompts found. Please run the seed script.</div>
        ) : (
          prompts.map(prompt => (
            <div key={prompt._id} className="prompt-card">
              <div className="prompt-header">
                <h3>{getPromptTypeLabel(prompt.type)}</h3>
                <div className="prompt-controls">
                  <div className="active-status">
                    <label>
                      Active:
                      <input 
                        type="checkbox" 
                        checked={prompt.isActive} 
                        onChange={(e) => handlePromptChange(prompt._id, "isActive", e.target.checked)}
                        disabled={!editMode[prompt._id]}
                      />
                    </label>
                  </div>
                  
                  {editMode[prompt._id] ? (
                    <button 
                      className="save-button"
                      onClick={() => handleSavePrompt(prompt._id)}
                      title="Save changes"
                    >
                      <FaSave />
                    </button>
                  ) : (
                    <button 
                      className="edit-button"
                      onClick={() => handleEditToggle(prompt._id)}
                      title="Edit prompt"
                    >
                      <FaEdit />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="prompt-content">
                {editMode[prompt._id] ? (
                  <textarea
                    value={prompt.prompt}
                    onChange={(e) => handlePromptChange(prompt._id, "prompt", e.target.value)}
                    rows={15}
                  />
                ) : (
                  <pre>{prompt.prompt}</pre>
                )}
              </div>
              
              <div className="prompt-footer">
                <span className="last-updated">
                  Last Updated: {new Date(prompt.lastUpdated).toLocaleString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SystemPrompts; 