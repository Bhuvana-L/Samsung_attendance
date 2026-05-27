/**
 * Seed script — creates a default admin account.
 * Run: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

const ADMIN_EMAIL = 'admin@samsung.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME = 'Samsung Lab Admin';

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const existing = await Admin.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      console.log(`Admin already exists: ${ADMIN_EMAIL}`);
    } else {
      await Admin.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });
      console.log(`Admin created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    }

    await mongoose.disconnect();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

seed();
