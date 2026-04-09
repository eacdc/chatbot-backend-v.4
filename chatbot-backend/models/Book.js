const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    isUsed: { type: Boolean, default: false },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    usedAt: { type: Date, default: null },
    generatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const bookSchema = new mongoose.Schema({
  bookId: { type: String, unique: true },
  title: { type: String, required: true },
  publisher: { type: String, required: true },
  subject: { type: String, required: true },
  language: { type: String, required: true },
  grade: { type: String, required: true, default: "1" },
  bookCoverImgLink: { type: String, required: true },
  coupons: { type: [couponSchema], default: [] }
}, { timestamps: true });

bookSchema.index({ "coupons.code": 1 }, { unique: true, sparse: true });

// Auto-generate bookId before saving
bookSchema.pre("save", async function (next) {
  if (!this.bookId) {
    this.bookId = "BOOK-" + Math.floor(100000 + Math.random() * 900000);
  }
  next();
});

module.exports = mongoose.model("Book", bookSchema);
