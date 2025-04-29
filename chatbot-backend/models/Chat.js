const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    role: { type: String, enum: ["user", "assistant", "system"] },
    content: { type: String },
    timestamp: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter", default: null },
    messages: [messageSchema],
    metadata: {
        type: Object,
        default: {
            status: "Start"
        }
    }
}, { timestamps: true });

// Compound index for efficient lookups
chatSchema.index({ userId: 1, chapterId: 1 });

module.exports = mongoose.model("Chat", chatSchema);