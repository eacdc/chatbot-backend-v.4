const express = require("express");
const router = express.Router();
const Prompt = require("../models/Prompt");
const authenticateAdmin = require("../middleware/adminAuthMiddleware");

// Get all prompts
router.get("/", authenticateAdmin, async (req, res) => {
  try {
    const prompts = await Prompt.find().sort({ prompt_type: 1 });
    res.json(prompts);
  } catch (error) {
    console.error("Error fetching prompts:", error);
    res.status(500).json({ error: "Failed to fetch prompts" });
  }
});

// Get a specific prompt by type
router.get("/:type", async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!["goodText", "qna", "finalPrompt"].includes(type)) {
      return res.status(400).json({ error: "Invalid prompt type" });
    }
    
    const prompt = await Prompt.findOne({ prompt_type: type, isActive: true });
    
    if (!prompt) {
      return res.status(404).json({ error: "Prompt not found" });
    }
    
    res.json(prompt);
  } catch (error) {
    console.error(`Error fetching ${req.params.type} prompt:`, error);
    res.status(500).json({ error: "Failed to fetch prompt" });
  }
});

// Create or update a prompt
router.post("/", authenticateAdmin, async (req, res) => {
  try {
    const { prompt_type, prompt, isActive } = req.body;
    
    if (!prompt_type || !prompt) {
      return res.status(400).json({ error: "Type and prompt are required" });
    }
    
    if (!["goodText", "qna", "finalPrompt"].includes(prompt_type)) {
      return res.status(400).json({ error: "Invalid prompt type" });
    }
    
    // Check if prompt exists
    let existingPrompt = await Prompt.findOne({ prompt_type });
    
    if (existingPrompt) {
      // Update existing prompt
      existingPrompt.prompt = prompt;
      if (isActive !== undefined) {
        existingPrompt.isActive = isActive;
      }
      existingPrompt.lastUpdated = Date.now();
      await existingPrompt.save();
      res.json(existingPrompt);
    } else {
      // Create new prompt
      const newPrompt = new Prompt({
        prompt_type,
        prompt,
        isActive: isActive !== undefined ? isActive : true
      });
      await newPrompt.save();
      res.status(201).json(newPrompt);
    }
  } catch (error) {
    console.error("Error creating/updating prompt:", error);
    res.status(500).json({ error: "Failed to create/update prompt" });
  }
});

// Delete a prompt
router.delete("/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Prompt.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ error: "Prompt not found" });
    }
    
    res.json({ message: "Prompt deleted successfully" });
  } catch (error) {
    console.error("Error deleting prompt:", error);
    res.status(500).json({ error: "Failed to delete prompt" });
  }
});

module.exports = router; 