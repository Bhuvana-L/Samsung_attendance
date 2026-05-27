const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
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

// POST /api/shortlist — add single student
router.post('/', protect(['admin']), async (req, res) => {
  try {
    const { usn, name, email, phone, department, lab, password } = req.body;
    if (!usn || !name || !lab) {
      return res.status(400).json({ message: 'USN, name and lab are required' });
    }

    const exists = await Student.findOne({ usn: usn.toUpperCase() });
    if (exists) return res.status(409).json({ message: 'USN already exists in shortlist' });

    const defaultPassword = password || usn.toUpperCase();
    const student = await Student.create({
      usn: usn.toUpperCase(),
      name,
      email: email || `${usn.toLowerCase()}@placeholder.com`,
      phone,
      department,
      lab,
      password: defaultPassword,
      isRegistered: false,
      addedBy: req.user._id,
    });

    res.status(201).json({ message: 'Student added to shortlist', student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Helper: process rows from CSV or Excel
// Supports multiple column name formats
async function processRows(rows, adminId, defaultLab) {
  let added = 0, skipped = 0;
  const errors = [];

  for (const row of rows) {
    try {
      // Flexible column name matching
      const usn = (row.usn || row.USN || row['Usn'] || row['USN '] || '').toString().toUpperCase().trim();
      const name = (row.name || row.Name || row.NAME || row['Student Name'] || row['STUDENT NAME'] || '').toString().trim();
      const department = (row.department || row.Department || row.DEPARTMENT || row.DEPT || row.Dept || row.dept || '').toString().trim();
      const email = (row.email || row.Email || row.EMAIL || row['Email Address'] || row['email address'] || row['Email address'] || '').toString().trim();
      const phone = (row.phone || row.Phone || row.PHONE || row.MOBILE || row.Mobile || row.mobile || row['Phone Number'] || row['Mobile Number'] || '').toString().trim();
      const lab = (row.lab || row.Lab || row.LAB || '').toString().toLowerCase().trim();
      const password = (row.password || row.Password || '').toString();

      if (!usn || !name) {
        errors.push({ usn: usn || '(empty)', reason: 'Missing USN or Name' });
        skipped++;
        continue;
      }

      // Use lab from file, or fall back to defaultLab passed from frontend
      const finalLab = ['iot', 'coding'].includes(lab) ? lab : defaultLab;
      if (!finalLab || !['iot', 'coding'].includes(finalLab)) {
        errors.push({ usn, reason: 'No lab specified (add a "lab" column with iot or coding)' });
        skipped++;
        continue;
      }

      const exists = await Student.findOne({ usn });
      if (exists) { skipped++; continue; }

      await Student.create({
        usn,
        name,
        email: email || `${usn.toLowerCase()}@placeholder.com`,
        phone: phone || undefined,
        department: department || undefined,
        lab: finalLab,
        password: password || usn,
        isRegistered: false,
        addedBy: adminId,
      });
      added++;
    } catch (e) {
      errors.push({ usn: row.usn || row.USN || '?', reason: e.message });
      skipped++;
    }
  }

  return { added, skipped, errors };
}

// POST /api/shortlist/upload — bulk upload (CSV or Excel)
router.post('/upload', protect(['admin']), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'File required' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  const defaultLab = (req.body.lab || '').toLowerCase().trim(); // lab selected by admin in UI

  try {
    let rows = [];

    if (ext === '.csv') {
      rows = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on('data', (row) => results.push(row))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    } else if (['.xlsx', '.xls'].includes(ext)) {
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Only .csv, .xlsx, .xls files are supported' });
    }

    fs.unlinkSync(req.file.path);

    const result = await processRows(rows, req.user._id, defaultLab);
    res.json(result);
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/shortlist/:id — update student
router.put('/:id', protect(['admin']), async (req, res) => {
  try {
    const { name, email, phone, department, lab, isActive, password } = req.body;
    const update = { name, email, phone, department, lab, isActive };
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
