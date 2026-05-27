const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const protect = require('../middleware/auth');

// GET /api/sessions?lab=iot|coding
router.get('/', protect(['admin']), async (req, res) => {
  try {
    const filter = req.query.lab ? { lab: req.query.lab } : {};
    const sessions = await Session.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sessions/active?lab=iot|coding
router.get('/active', protect(), async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.lab) filter.lab = req.query.lab;
    const sessions = await Session.find(filter).sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/sessions — open a new session
router.post('/', protect(['admin']), async (req, res) => {
  try {
    const { lab, title } = req.body;
    if (!lab) return res.status(400).json({ message: 'Lab is required' });

    const today = new Date().toISOString().split('T')[0];
    const session = await Session.create({
      lab,
      title: title || `${lab.toUpperCase()} session - ${today}`,
      date: today,
      createdBy: req.user._id,
    });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/sessions/:id/close
router.patch('/:id/close', protect(['admin']), async (req, res) => {
  try {
    const session = await Session.findByIdAndUpdate(
      req.params.id,
      { isActive: false, closedAt: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
