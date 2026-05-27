const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const protect = require('../middleware/auth');

const upload = multer({ dest: 'uploads/' });

// GET /api/shortlist?lab=iot|coding
router.get('/', protect(['admin']), async (req, res) => {
  try {
    const filter = req.query.lab ? { lab: req.query.lab } : {};
    const students = await Student.find(filter).sort({ name: 1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/shortlist  — add single student
router.post('/', protect(['admin']), async (req, res) => {
  try {
    const { usn, name, email, phone, lab, password } = req.body;
    if (!usn || !name || !lab)
      return res.status(400).json({ message: 'USN, name and lab are required' });

    const exists = await Student.findOne({ usn: usn.toUpperCase() });
    if (exists) return res.status(409).json({ message: 'USN already exists' });

    const defaultPassword = password || usn.toUpperCase();
    const student = await Student.create({
      usn: usn.toUpperCase(),
      name,
      email,
      phone,
      lab,
      password: defaultPassword,
      addedBy: req.user._id,
    });

    res.status(201).json({ message: 'Student added', student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/shortlist/upload-csv — bulk CSV upload
// CSV format: usn,name,email,phone,lab,password
router.post('/upload-csv', protect(['admin']), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'CSV file required' });

  const results = [];
  const errors = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => results.push(row))
    .on('end', async () => {
      fs.unlinkSync(req.file.path);
      let added = 0;
      let skipped = 0;

      for (const row of results) {
        try {
          const usn = (row.usn || '').toUpperCase().trim();
          const lab = (row.lab || '').toLowerCase().trim();
          if (!usn || !row.name || !['iot', 'coding'].includes(lab)) {
            errors.push({ usn, reason: 'Missing/invalid fields' });
            skipped++;
            continue;
          }
          const exists = await Student.findOne({ usn });
          if (exists) { skipped++; continue; }

          const defaultPassword = row.password || usn;
          await Student.create({
            usn,
            name: row.name.trim(),
            email: row.email ? row.email.trim() : undefined,
            phone: row.phone ? row.phone.trim() : undefined,
            lab,
            password: defaultPassword,
            addedBy: req.user._id,
          });
          added++;
        } catch (e) {
          errors.push({ usn: row.usn, reason: e.message });
          skipped++;
        }
      }
      res.json({ added, skipped, errors });
    });
});

// PUT /api/shortlist/:id  — update student
router.put('/:id', protect(['admin']), async (req, res) => {
  try {
    const { name, email, phone, lab, isActive, password } = req.body;
    const update = { name, email, phone, lab, isActive };
    if (password) {
      update.password = await bcrypt.hash(password, 12);
    }
    const student = await Student.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/shortlist/:id
router.delete('/:id', protect(['admin']), async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: 'Student removed from shortlist' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;