const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
  bookId: { type: String, unique: true },
  title: { type: String, required: true },
  publisher: { type: String, required: true },
  subject: { type: String, required: true },
  language: { type: String, required: true },
  grade: { type: String, required: true, default: "1" },
  bookCoverImgLink: { type: String, required: true }
}, { timestamps: true });

// Auto-generate bookId before saving
bookSchema.pre("save", async function (next) {
  if (!this.bookId) {
    this.bookId = "BOOK-" + Math.floor(100000 + Math.random() * 900000);
  }
  next();
});

module.exports = mongoose.model("Book", bookSchema);
