const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema({
  usn: { type: String, required: true, uppercase: true, trim: true },
  studentName: { type: String },
  lab: { type: String, required: true, enum: ['iot', 'coding'] },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  method: { type: String, enum: ['scan', 'manual'], default: 'manual' },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

// One student can only be marked once per session
attendanceLogSchema.index({ usn: 1, session: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);
