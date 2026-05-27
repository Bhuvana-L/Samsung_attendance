const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  lab: {
    type: String,
    required: true,
    enum: ['iot', 'coding'],
  },
  title: { type: String, required: true },
  date: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  closedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
