const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const Student = require('../models/Student');
const protect = require('../middleware/auth');

// PUT /api/student/profile — student updates their own details
router.put('/profile', protect(['student']), async (req, res) => {
  try {
    const { name, email, phone, department } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (email) update.email = email.toLowerCase().trim();
    if (phone !== undefined) update.phone = phone.trim();
    if (department !== undefined) update.department = department.trim();

    const student = await Student.findByIdAndUpdate(req.user._id, update, { new: true }).select('-password');
    if (!student) return res.status(404).json({ message: 'Student not found' });

    res.json({
      message: 'Profile updated',
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

// PUT /api/student/change-password
router.put('/change-password', protect(['student']), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const student = await Student.findById(req.user._id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const isMatch = await student.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });

    student.password = newPassword;
    await student.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
