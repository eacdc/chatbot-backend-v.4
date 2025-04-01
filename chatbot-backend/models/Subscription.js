const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
  bookTitle: { type: String, required: true },
  subscribedAt: { type: Date, default: Date.now }
});

// Ensure a user can only subscribe to the same book once
SubscriptionSchema.index({ userId: 1, bookId: 1 }, { unique: true });

module.exports = mongoose.model("Subscription", SubscriptionSchema);
