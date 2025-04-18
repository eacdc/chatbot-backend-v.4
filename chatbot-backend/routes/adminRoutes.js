const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
require("dotenv").config();

const router = express.Router();

// Admin Registration (Pending Approval)
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new Admin({
      name,
      email,
      password: hashedPassword,
      status: "pending", // 🚀 Pending approval
    });

    await newAdmin.save();
    res.status(201).json({ message: "Admin registered. Awaiting approval." });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Approve/Reject Admin (Super Admin Only)
router.put("/approve/:adminId", async (req, res) => {
  const { adminId } = req.params;
  const { status } = req.body; // "approved" or "rejected"

  try {
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    admin.status = status;
    await admin.save();

    res.json({ message: `Admin ${status} successfully.` });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Admin Login (Only Approved Admins Can Login)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    if (admin.status !== "approved") {
      return res.status(403).json({ message: "Admin approval pending." });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const payload = {
      adminId: admin._id,
      name: admin.name,
      email: admin.email,
      role: "admin"
    };

    // Sign token with same JWT_SECRET as user auth
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "1d" }, // Token expires in 1 day
      (err, token) => {
        if (err) throw err;
        res.json({
          message: "Login successful",
          token,
          adminId: admin._id
        });
      }
    );
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
