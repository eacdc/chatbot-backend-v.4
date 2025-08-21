const mongoose = require('mongoose');

const passwordResetOTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  otp: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Document expires after 10 minutes (600 seconds)
  },
  verified: {
    type: Boolean,
    default: false
  }
});

const PasswordResetOTP = mongoose.model('PasswordResetOTP', passwordResetOTPSchema);

module.exports = PasswordResetOTP;
