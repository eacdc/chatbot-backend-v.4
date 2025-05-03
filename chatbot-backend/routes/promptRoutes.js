const express = require("express");
const router = express.Router();
const Prompt = require("../models/Prompt");
const authenticateAdmin = require("../middleware/adminAuthMiddleware");
const { processQuestionBatch } = require('../scripts/processQuestionBatch');

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

// Get all system wide configuration
router.get("/configs", authenticateAdmin, async (req, res) => {
  try {
    const Config = require("../models/Config");
    const configs = await Config.find({}, { _id: 0, __v: 0 });
    res.json(configs);
  } catch (error) {
    console.error("Error fetching configs:", error);
    res.status(500).json({ error: "Failed to fetch configs" });
  }
});

// Update a configuration setting
router.put("/configs/:key", authenticateAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: "Value is required" });
    }

    const Config = require("../models/Config");
    
    // If key is questionMode, value must be boolean
    if (key === 'questionMode' && typeof value !== 'boolean') {
      return res.status(400).json({ error: "Value for questionMode must be boolean" });
    }
    
    const config = await Config.findOneAndUpdate(
      { key }, 
      { value }, 
      { new: true, runValidators: true }
    );
    
    if (!config) {
      return res.status(404).json({ error: `Config with key ${key} not found` });
    }
    
    res.json({ 
      message: `${key} configuration updated successfully`,
      config
    });
  } catch (error) {
    console.error(`Error updating config:`, error);
    res.status(500).json({ error: "Failed to update config" });
  }
});

// Process batch questions for a chapter
router.post("/chapters/:chapterId/process-questions", authenticateAdmin, async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { batchText } = req.body;

    if (!batchText) {
      return res.status(400).json({ error: "Question batch text is required" });
    }

    console.log(`Processing question batch for chapter ${chapterId}`);
    
    // Find the chapter
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res.status(404).json({ error: "Chapter not found" });
    }

    // Process the batch text into structured question objects
    // Pass the chapter ID so it can be used in the questionId generation
    const questions = processQuestionBatch(batchText, chapterId);
    
    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: "No valid questions found in the batch" });
    }

    // Update or create the questionPrompt array for the chapter
    chapter.questionPrompt = questions;
    
    // Save the updated chapter
    await chapter.save();
    
    console.log(`Updated chapter ${chapterId} with ${questions.length} processed questions`);
    
    res.json({
      success: true,
      message: `Successfully processed ${questions.length} questions for the chapter`,
      questions: questions
    });
    
  } catch (error) {
    console.error("Error processing batch questions:", error);
    res.status(500).json({ error: "Error processing batch questions", message: error.message });
  }
});

module.exports = router; 