const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  usn: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  department: { type: String, trim: true },
  lab: {
    type: String,
    required: true,
    enum: ['iot', 'coding'],
  },
  password: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  isRegistered: { type: Boolean, default: false },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  otp: { type: String, default: null },
  otpExpiry: { type: Date, default: null },
}, { timestamps: true });

studentSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

studentSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Student', studentSchema);
