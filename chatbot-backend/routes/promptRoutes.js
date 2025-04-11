const express = require("express");
const router = express.Router();
const SystemPrompt = require("../models/SystemPrompt");
const authenticateAdmin = require("../middleware/adminAuthMiddleware");

// Get all system prompts
router.get("/", authenticateAdmin, async (req, res) => {
  try {
    const prompts = await SystemPrompt.find().sort({ type: 1 });
    res.json(prompts);
  } catch (error) {
    console.error("Error fetching system prompts:", error);
    res.status(500).json({ error: "Failed to fetch system prompts" });
  }
});

// Get a specific prompt by type
router.get("/:type", async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!["goodText", "qna", "finalPrompt"].includes(type)) {
      return res.status(400).json({ error: "Invalid prompt type" });
    }
    
    const prompt = await SystemPrompt.findOne({ type, isActive: true });
    
    if (!prompt) {
      return res.status(404).json({ error: "Prompt not found" });
    }
    
    res.json(prompt);
  } catch (error) {
    console.error(`Error fetching ${req.params.type} prompt:`, error);
    res.status(500).json({ error: "Failed to fetch prompt" });
  }
});

// Create or update a system prompt
router.post("/", authenticateAdmin, async (req, res) => {
  try {
    const { type, prompt } = req.body;
    
    if (!type || !prompt) {
      return res.status(400).json({ error: "Type and prompt are required" });
    }
    
    if (!["goodText", "qna", "finalPrompt"].includes(type)) {
      return res.status(400).json({ error: "Invalid prompt type" });
    }
    
    // Check if prompt exists
    let existingPrompt = await SystemPrompt.findOne({ type });
    
    if (existingPrompt) {
      // Update existing prompt
      existingPrompt.prompt = prompt;
      existingPrompt.lastUpdated = Date.now();
      await existingPrompt.save();
      res.json(existingPrompt);
    } else {
      // Create new prompt
      const newPrompt = new SystemPrompt({
        type,
        prompt
      });
      await newPrompt.save();
      res.status(201).json(newPrompt);
    }
  } catch (error) {
    console.error("Error creating/updating system prompt:", error);
    res.status(500).json({ error: "Failed to create/update system prompt" });
  }
});

// Delete a system prompt
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await SystemPrompt.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ error: "Prompt not found" });
    }
    
    res.json({ message: "Prompt deleted successfully" });
  } catch (error) {
    console.error("Error deleting system prompt:", error);
    res.status(500).json({ error: "Failed to delete system prompt" });
  }
});

module.exports = router; 