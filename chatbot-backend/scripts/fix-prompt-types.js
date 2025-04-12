require("dotenv").config();
const mongoose = require("mongoose");
const Prompt = require("../models/Prompt");

async function fixPromptTypes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Get all prompts
    const prompts = await Prompt.find();
    console.log(`Found ${prompts.length} prompts in the database`);

    // Update prompt types
    for (const prompt of prompts) {
      let newType = prompt.prompt_type;
      let updated = false;

      if (prompt.prompt_type === "Good Text") {
        newType = "goodText";
        updated = true;
      } else if (prompt.prompt_type === "QnA") {
        newType = "qna";
        updated = true;
      } else if (prompt.prompt_type === "Final Prompt") {
        newType = "finalPrompt";
        updated = true;
      }

      if (updated) {
        await Prompt.updateOne(
          { _id: prompt._id },
          { $set: { prompt_type: newType } }
        );
        console.log(`Updated prompt type from "${prompt.prompt_type}" to "${newType}"`);
      }
    }

    // Verify the changes
    console.log("\nVerifying changes:");
    const updatedPrompts = await Prompt.find();
    updatedPrompts.forEach((prompt) => {
      console.log(`Prompt Type: ${prompt.prompt_type} (Active: ${prompt.isActive})`);
    });

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  } catch (error) {
    console.error("Error fixing prompt types:", error);
    process.exit(1);
  }
}

fixPromptTypes(); 