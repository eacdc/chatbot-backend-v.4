const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
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
  userData: {
    username: { type: String, required: true },
    fullname: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, required: true },
    grade: { type: String, required: true },
    publisher: { type: String },
    password: { type: String, required: true }
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

// Index for automatic cleanup
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP; 