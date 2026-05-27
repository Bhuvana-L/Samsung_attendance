require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/shortlist', require('./routes/shortlist'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/student', require('./routes/student'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n  Server running on port ${PORT}`);
  console.log(`  ➜ Backend API: http://localhost:${PORT}/api`);
  console.log(`  ➜ Frontend:    http://localhost:3000\n`);
});
