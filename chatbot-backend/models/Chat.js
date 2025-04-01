const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", default: null },
    messages: [
        {
            role: { type: String, required: true, enum: ["system", "user", "assistant"] },
            content: { type: String, required: true },
            timestamp: { type: Date, default: Date.now }
        }
    ]
}, { timestamps: true });

// Compound index for efficient lookups
chatSchema.index({ userId: 1, chapterId: 1 });

module.exports = mongoose.model("Chat", chatSchema);