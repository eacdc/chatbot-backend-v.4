const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // For hashing passwords

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true }, // ✅ Primary identifier
    fullname: { type: String, required: true },
    email: { type: String, required: false, sparse: true, lowercase: true, trim: true }, // Optional field with sparse indexing
    phone: { type: String, required: true },
    grade: { type: String, required: true, default: "1" }, // Grade level for filtering content
    publisher: { type: String, required: false, trim: true }, // Publisher preference for filtering content
    profilePicture: { type: String, required: false }, // URL/path to profile picture
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
