const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    role: { type: String, enum: ["user", "assistant", "system"] },
    content: { type: String },
    timestamp: { type: Date, default: Date.now },
    isAudio: { type: Boolean, default: false },
    audioFileId: { type: String, default: null },
    messageId: { type: String, default: null }
});

const chatSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", default: null },
    messages: [messageSchema],
    metadata: {
        answeredQuestions: [String],
        totalMarks: { type: Number, default: 0 },
        earnedMarks: { type: Number, default: 0 },
        lastQuestionAsked: String,
        lastActive: { type: Date, default: Date.now }
    }
}, { timestamps: true });

// Compound index for efficient lookups
chatSchema.index({ userId: 1, chapterId: 1 });

module.exports = mongoose.model("Chat", chatSchema);