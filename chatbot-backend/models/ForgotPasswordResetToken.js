const mongoose = require("mongoose");

const forgotPasswordResetTokenSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    purpose: { type: String, required: true, default: "forgot_password" },
    deviceFingerprint: { type: String, required: false, trim: true },
    usedAt: { type: Date, default: null, index: true },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

// Auto-delete token records once expired.
forgotPasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("ForgotPasswordResetToken", forgotPasswordResetTokenSchema);

