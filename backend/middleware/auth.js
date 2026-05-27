const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Student = require('../models/Student');

/**
 * Auth middleware — protects routes with JWT.
 * Usage:
 *   protect()           → any authenticated user
 *   protect(['admin'])  → admin only
 *   protect(['student'])→ student only
 */
const protect = (roles = []) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Not authorized — no token' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.role === 'admin') {
        const admin = await Admin.findById(decoded.id).select('-password');
        if (!admin) return res.status(401).json({ message: 'Admin not found' });
        req.user = admin;
        req.userRole = 'admin';
      } else if (decoded.role === 'student') {
        const student = await Student.findById(decoded.id).select('-password');
        if (!student) return res.status(401).json({ message: 'Student not found' });
        req.user = student;
        req.userRole = 'student';
      } else {
        return res.status(401).json({ message: 'Invalid token role' });
      }

      // Role check
      if (roles.length > 0 && !roles.includes(req.userRole)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      next();
    } catch (err) {
      return res.status(401).json({ message: 'Token invalid or expired' });
    }
  };
};

module.exports = protect;
