const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
  bookId: { type: String, unique: true }, // Auto-generated
  title: { type: String, required: true },
  publisher: { type: String, required: true },
  subject: { type: String, required: true },
  language: { type: String, required: true },
  bookCoverImgLink: { type: String, required: true },
}, { timestamps: true });

// Auto-generate bookId before saving
bookSchema.pre("save", async function (next) {
  if (!this.bookId) {
    this.bookId = "BOOK-" + Math.floor(100000 + Math.random() * 900000); // Unique ID
  }
  next();
});

module.exports = mongoose.model("Book", bookSchema);
