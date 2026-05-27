const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Admin = require('../models/Admin');
const Student = require('../models/Student');
const { sendOTP } = require('../utils/sendEmail');

const router = express.Router();

const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// POST /api/auth/login — unified login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Credentials required' });
    }

    // Try admin login (identifier is email)
    const admin = await Admin.findOne({ email: identifier.toLowerCase().trim() });
    if (admin) {
      const isMatch = await admin.comparePassword(password);
      if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

      const token = signToken(admin._id, 'admin');
      return res.json({
        token,
        role: 'admin',
        user: { _id: admin._id, name: admin.name, email: admin.email },
      });
    }

    // Try student login (identifier is USN or email)
    let student;
    if (identifier.includes('@')) {
      // Search by email
      student = await Student.findOne({ email: identifier.toLowerCase().trim(), isActive: true });
    } else {
      // Search by USN
      student = await Student.findOne({ usn: identifier.toUpperCase().trim(), isActive: true });
    }
    if (student) {
      if (!student.isRegistered) {
        return res.status(403).json({ message: 'Please create your account first' });
      }
      const isMatch = await student.comparePassword(password);
      if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

      const token = signToken(student._id, 'student');
      return res.json({
        token,
        role: 'student',
        user: {
          _id: student._id,
          usn: student.usn,
          name: student.name,
          lab: student.lab,
          email: student.email,
          phone: student.phone,
          department: student.department,
        },
      });
    }

    return res.status(401).json({ message: 'Account not found. Check your email/USN or create an account.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/register — student creates account
// Only shortlisted USNs can register
router.post('/register', async (req, res) => {
  try {
    const { usn, name, email, phone, department, password } = req.body;
    if (!usn || !name || !email || !password) {
      return res.status(400).json({ message: 'USN, name, email and password are required' });
    }

    // Check if USN is in shortlist
    const student = await Student.findOne({ usn: usn.toUpperCase().trim() });
    if (!student) {
      return res.status(403).json({ message: 'Your USN is not in the shortlist. Contact admin.' });
    }

    if (student.isRegistered) {
      return res.status(409).json({ message: 'Account already exists. Please login.' });
    }

    // Update student with registration details
    student.name = name.trim();
    student.email = email.toLowerCase().trim();
    student.phone = phone ? phone.trim() : student.phone;
    student.department = department ? department.trim() : student.department;
    student.password = password;
    student.isRegistered = true;
    await student.save();

    const token = signToken(student._id, 'student');
    res.status(201).json({
      message: 'Account created successfully',
      token,
      role: 'student',
      user: {
        _id: student._id,
        usn: student.usn,
        name: student.name,
        lab: student.lab,
        email: student.email,
        phone: student.phone,
        department: student.department,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/forgot-password — send OTP to email
router.post('/forgot-password', async (req, res) => {
  try {
    const { usn } = req.body;
    if (!usn) return res.status(400).json({ message: 'USN is required' });

    const student = await Student.findOne({ usn: usn.toUpperCase().trim() });
    if (!student || !student.isRegistered) {
      return res.status(404).json({ message: 'Account not found. Register first.' });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    student.otp = otp;
    student.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await student.save({ validateModifiedOnly: true });

    // Send OTP via email
    await sendOTP(student.email, otp);

    // Mask email for response
    const maskedEmail = student.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    res.json({ message: `OTP sent to ${maskedEmail}`, email: maskedEmail });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Failed to send OTP. Try again.' });
  }
});

// POST /api/auth/verify-otp — verify OTP and reset password
router.post('/verify-otp', async (req, res) => {
  try {
    const { usn, otp, newPassword } = req.body;
    if (!usn || !otp || !newPassword) {
      return res.status(400).json({ message: 'USN, OTP and new password are required' });
    }

    const student = await Student.findOne({ usn: usn.toUpperCase().trim() });
    if (!student) return res.status(404).json({ message: 'Account not found' });

    if (!student.otp || student.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (new Date() > student.otpExpiry) {
      return res.status(400).json({ message: 'OTP expired. Request a new one.' });
    }

    // Reset password
    student.password = newPassword;
    student.otp = null;
    student.otpExpiry = null;
    await student.save();

    res.json({ message: 'Password reset successful. You can now login.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
