const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    role: { type: String, enum: ["user", "assistant", "system"] },
    content: { type: String },
    timestamp: { type: Date, default: Date.now },
    isAudio: { type: Boolean, default: false },
    audioFileId: { type: String, default: null },
    messageId: { type: String, default: null }
});

const chatAskSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", required: true },
    messages: [messageSchema],
    metadata: {
        totalQuestions: { type: Number, default: 0 },
        lastActive: { type: Date, default: Date.now }
    }
}, { timestamps: true });

// Compound index for efficient lookups
chatAskSchema.index({ userId: 1, chapterId: 1 });

module.exports = mongoose.model("ChatAsk", chatAskSchema, "chats_ask");

