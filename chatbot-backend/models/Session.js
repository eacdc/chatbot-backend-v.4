const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true 
    },
    chapterId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Chapter", 
      required: true,
      index: true 
    },
    bookId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Book", 
      required: true,
      index: true 
    },
    sessionType: {
      type: String,
      enum: ["Quiz", "Learning"],
      required: true
    },
    startedAt: {
      type: Date,
      required: true
    },
    endAt: {
      type: Date,
      default: null
    },
    timeTaken: {
      type: Number, // Time in minutes
      default: null
    },
    status: {
      type: String,
      enum: ["started", "closed"],
      default: "started"
    }
  },
  { 
    timestamps: true 
  }
);

// Create compound index for efficient lookups
sessionSchema.index({ userId: 1, chapterId: 1, status: 1 });
sessionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Session", sessionSchema);

