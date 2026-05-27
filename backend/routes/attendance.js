const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const Student = require('../models/Student');
const Session = require('../models/Session');
const AttendanceLog = require('../models/AttendanceLog');
const protect = require('../middleware/auth');

// POST /api/attendance/mark
router.post('/mark', protect(['admin']), async (req, res) => {
  try {
    const { usn, sessionId, method } = req.body;
    if (!usn || !sessionId) {
      return res.status(400).json({ message: 'USN and session are required' });
    }

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (!session.isActive) return res.status(400).json({ message: 'Session is closed' });

    // SHORTLIST GATE
    const student = await Student.findOne({
      usn: usn.toUpperCase(),
      lab: session.lab,
      isActive: true,
    });

    if (!student) {
      return res.status(403).json({
        message: `USN ${usn.toUpperCase()} is NOT in the ${session.lab.toUpperCase()} shortlist.`,
      });
    }

    const existing = await AttendanceLog.findOne({ usn: usn.toUpperCase(), session: sessionId });
    if (existing) {
      return res.status(409).json({ message: `${student.name} already marked for this session` });
    }

    const log = await AttendanceLog.create({
      usn: student.usn,
      studentName: student.name,
      lab: session.lab,
      session: session._id,
      markedBy: req.user._id,
      method: method || 'manual',
    });

    res.status(201).json({
      message: 'Attendance marked',
      student: { usn: student.usn, name: student.name, lab: student.lab },
      log,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Already marked for this session' });
    }
    res.status(500).json({ message: err.message });
  }
});

// GET /api/attendance/student/:usn
router.get('/student/:usn', protect(), async (req, res) => {
  try {
    const usn = req.params.usn.toUpperCase();
    const student = await Student.findOne({ usn }).select('-password');
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const totalSessions = await Session.countDocuments({ lab: student.lab });
    const logs = await AttendanceLog.find({ usn })
      .populate('session', 'title date lab')
      .sort({ timestamp: -1 });

    const present = logs.length;
    const absent = totalSessions - present;
    const percentage = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0;

    res.json({
      student: { usn: student.usn, name: student.name, lab: student.lab, email: student.email, phone: student.phone, department: student.department },
      stats: { present, absent, totalSessions, percentage },
      logs,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/attendance/logs?lab= — get all attendance logs for a lab
router.get('/logs', protect(['admin']), async (req, res) => {
  try {
    const filter = {};
    if (req.query.lab) filter.lab = req.query.lab;
    const logs = await AttendanceLog.find(filter)
      .populate('session', 'title date lab')
      .sort({ timestamp: -1 })
      .limit(200);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/attendance/report?lab=&date=&search=
// Logic:
//   date only → show all students present/absent for that date
//   search only → show that student's attendance across all days
//   date + search → show that student's attendance on that specific date
//   no filters → show all attendance logs
router.get('/report', protect(['admin']), async (req, res) => {
  try {
    const { lab, date, search } = req.query;

    // If searching by name/USN only (no date) → show that student's full history
    if (search && !date) {
      const studentFilter = {};
      if (lab) studentFilter.lab = lab;
      studentFilter.$or = [
        { usn: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
      const students = await Student.find(studentFilter).select('usn name lab department');
      const usns = students.map((s) => s.usn);

      const logFilter = { usn: { $in: usns } };
      if (lab) logFilter.lab = lab;
      const logs = await AttendanceLog.find(logFilter).populate('session', 'title date lab').sort({ timestamp: -1 });

      const totalSessions = await Session.countDocuments(lab ? { lab } : {});

      const report = students.map((st) => {
        const studentLogs = logs.filter((l) => l.usn === st.usn);
        return {
          usn: st.usn,
          name: st.name,
          department: st.department || '—',
          lab: st.lab,
          status: studentLogs.length > 0 ? 'Present' : 'Absent',
          sessionsAttended: studentLogs.length,
          totalSessions,
          percentage: totalSessions > 0 ? Math.round((studentLogs.length / totalSessions) * 100) : 0,
          dates: studentLogs.map((l) => ({ date: l.session?.date || new Date(l.timestamp).toISOString().split('T')[0], time: l.timestamp })),
        };
      });

      return res.json({ report, logs, totalStudents: students.length, totalSessions, date: 'all', lab: lab || 'all' });
    }

    // If date is provided → show everyone's status for that date
    const sessionFilter = {};
    if (lab) sessionFilter.lab = lab;
    if (date) sessionFilter.date = date;
    const sessions = await Session.find(sessionFilter);
    const sessionIds = sessions.map((s) => s._id);

    // If no sessions found for that date
    if (date && sessionIds.length === 0) {
      // Still show all students as absent
      const studentFilter = {};
      if (lab) studentFilter.lab = lab;
      if (search) {
        studentFilter.$or = [
          { usn: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
        ];
      }
      const students = await Student.find(studentFilter).select('usn name lab department').sort({ name: 1 });
      const report = students.map((st) => ({
        usn: st.usn, name: st.name, department: st.department || '—', lab: st.lab,
        status: 'Absent', sessionsAttended: 0, totalSessions: 0, percentage: 0,
      }));
      return res.json({ report, logs: [], totalStudents: students.length, totalSessions: 0, date: date || 'all', lab: lab || 'all' });
    }

    // Get logs for these sessions
    const logFilter = { session: { $in: sessionIds } };
    if (lab) logFilter.lab = lab;
    const logs = await AttendanceLog.find(logFilter).populate('session', 'title date lab').sort({ timestamp: -1 });

    const presentSet = new Set(logs.map((l) => l.usn));

    // Get students (filtered by search if provided)
    const studentFilter = {};
    if (lab) studentFilter.lab = lab;
    if (search) {
      studentFilter.$or = [
        { usn: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }
    const students = await Student.find(studentFilter).select('usn name lab department').sort({ name: 1 });

    const totalSessions = date ? sessions.length : await Session.countDocuments(lab ? { lab } : {});

    const report = students.map((st) => {
      const studentLogs = logs.filter((l) => l.usn === st.usn);
      return {
        usn: st.usn,
        name: st.name,
        department: st.department || '—',
        lab: st.lab,
        status: presentSet.has(st.usn) ? 'Present' : 'Absent',
        sessionsAttended: studentLogs.length,
        totalSessions: date ? sessions.length : totalSessions,
        percentage: (date ? sessions.length : totalSessions) > 0 ? Math.round((studentLogs.length / (date ? sessions.length : totalSessions)) * 100) : 0,
      };
    });

    res.json({ report, logs, totalStudents: students.length, totalSessions: date ? sessions.length : totalSessions, date: date || 'all', lab: lab || 'all' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/attendance/export?lab=&date=&search=
// Export attendance as Excel file
router.get('/export', protect(['admin']), async (req, res) => {
  try {
    const { lab, date, search } = req.query;

    const studentFilter = {};
    if (lab) studentFilter.lab = lab;
    if (search) {
      studentFilter.$or = [
        { usn: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }
    const students = await Student.find(studentFilter).select('usn name lab department').sort({ name: 1 });

    const sessionFilter = {};
    if (lab) sessionFilter.lab = lab;
    if (date) sessionFilter.date = date;
    const sessions = await Session.find(sessionFilter).sort({ date: -1 });
    const sessionIds = sessions.map((s) => s._id);

    const logFilter = {};
    if (sessionIds.length > 0) logFilter.session = { $in: sessionIds };
    if (lab) logFilter.lab = lab;
    const logs = await AttendanceLog.find(logFilter).populate('session', 'date');

    const presentSet = new Set(logs.map((l) => l.usn));

    // Build Excel data
    const data = students.map((st, i) => {
      const studentLogs = logs.filter((l) => l.usn === st.usn);
      const lastAttended = studentLogs.length > 0 ? (studentLogs[0].session?.date || new Date(studentLogs[0].timestamp).toISOString().split('T')[0]) : '—';
      return {
        'S.No': i + 1,
        'USN': st.usn,
        'Name': st.name,
        'Department': st.department || '',
        'Lab': st.lab === 'iot' ? 'Samsung IoT' : 'Samsung Coding',
        'Date': date || lastAttended,
        'Status': presentSet.has(st.usn) ? 'Present' : 'Absent',
        'Sessions Attended': studentLogs.length,
        'Total Sessions': sessions.length,
        'Percentage': sessions.length > 0 ? Math.round((studentLogs.length / sessions.length) * 100) + '%' : '0%',
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 25 }, { wch: 20 },
      { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `attendance_${lab || 'all'}_${date || 'all'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/attendance/full-report?lab= — generates full report with dates as columns
router.get('/full-report', protect(['admin']), async (req, res) => {
  try {
    const XLSX_STYLE = require('xlsx-js-style');
    const { lab } = req.query;
    const sessionFilter = {};
    if (lab) sessionFilter.lab = lab;

    const sessions = await Session.find(sessionFilter).sort({ date: 1 });
    const dates = [...new Set(sessions.map((s) => s.date))];

    const studentFilter = {};
    if (lab) studentFilter.lab = lab;
    const students = await Student.find(studentFilter).select('usn name lab department').sort({ name: 1 });

    const sessionIds = sessions.map((s) => s._id);
    const logFilter = { session: { $in: sessionIds } };
    if (lab) logFilter.lab = lab;
    const logs = await AttendanceLog.find(logFilter).populate('session', 'date');

    // Build attendance map: usn -> { date -> true }
    const attendanceMap = {};
    logs.forEach((log) => {
      const d = log.session?.date;
      if (!d) return;
      if (!attendanceMap[log.usn]) attendanceMap[log.usn] = {};
      attendanceMap[log.usn][d] = true;
    });

    // Build headers
    const headers = ['Sl no.', 'USN', 'Student Name', 'Department', ...dates, 'Total Present', 'Total Sessions', 'Percentage'];

    // Build rows with styling
    const rows = [headers];
    students.forEach((st, i) => {
      const row = [i + 1, st.usn, st.name, st.department || ''];
      let presentCount = 0;
      dates.forEach((d) => {
        const isPresent = attendanceMap[st.usn] && attendanceMap[st.usn][d];
        row.push(isPresent ? 'P' : 'AB');
        if (isPresent) presentCount++;
      });
      row.push(presentCount, dates.length, dates.length > 0 ? Math.round((presentCount / dates.length) * 100) + '%' : '0%');
      rows.push(row);
    });

    // Create worksheet
    const ws = XLSX_STYLE.utils.aoa_to_sheet(rows);

    // Style header row
    const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '2E5090' } }, alignment: { horizontal: 'center' } };
    for (let c = 0; c < headers.length; c++) {
      const cell = ws[XLSX_STYLE.utils.encode_cell({ r: 0, c })];
      if (cell) cell.s = headerStyle;
    }

    // Style data cells — red background for AB
    for (let r = 1; r <= students.length; r++) {
      for (let c = 4; c < 4 + dates.length; c++) {
        const cell = ws[XLSX_STYLE.utils.encode_cell({ r, c })];
        if (cell && cell.v === 'AB') {
          cell.s = { fill: { fgColor: { rgb: 'FF4444' } }, font: { color: { rgb: 'FFFFFF' }, bold: true }, alignment: { horizontal: 'center' } };
        } else if (cell && cell.v === 'P') {
          cell.s = { font: { color: { rgb: '228B22' }, bold: true }, alignment: { horizontal: 'center' } };
        }
      }
    }

    // Column widths
    const cols = [{ wch: 6 }, { wch: 14 }, { wch: 28 }, { wch: 15 }];
    dates.forEach(() => cols.push({ wch: 12 }));
    cols.push({ wch: 12 }, { wch: 12 }, { wch: 10 });
    ws['!cols'] = cols;

    const wb = XLSX_STYLE.utils.book_new();
    XLSX_STYLE.utils.book_append_sheet(wb, ws, 'Full Report');

    const buffer = XLSX_STYLE.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `full_attendance_report_${lab || 'all'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/attendance/:id — delete an attendance log
router.delete('/:id', protect(['admin']), async (req, res) => {
  try {
    const log = await AttendanceLog.findByIdAndDelete(req.params.id);
    if (!log) return res.status(404).json({ message: 'Attendance record not found' });
    res.json({ message: 'Attendance record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
