const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // For hashing passwords

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true }, // ✅ Trim added
    fullname: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true }, // ✅ Lowercase & trim
    phone: { type: String, required: true },
    role: { 
        type: String, 
        enum: ["student", "teacher", "school admin", "publisher admin", "admin"], 
        required: true 
    },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// ✅ Hash password before saving (only if modified)
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

module.exports = mongoose.model("User", userSchema);
