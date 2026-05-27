import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';

const LAB_LABELS = { iot: 'Samsung IoT', coding: 'Samsung Coding' };

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState('scan');
  const [lab, setLab] = useState('iot');

  // Scan state
  const [usnInput, setUsnInput] = useState('');
  const [markLoading, setMarkLoading] = useState(false);
  const [lastMarked, setLastMarked] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [recentMarked, setRecentMarked] = useState([]);
  const usnRef = useRef(null);

  // Scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Physical scanner state (detects rapid keystrokes)
  const [physicalScannerActive, setPhysicalScannerActive] = useState(true);
  const physicalBuffer = useRef('');
  const physicalTimer = useRef(null);
  const lastScanTime = useRef(0);

  // Dashboard state
  const [tab, setTab] = useState('attendance');
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [newStudent, setNewStudent] = useState({ usn: '', name: '', email: '', phone: '', department: '', lab: 'iot' });
  const [uploadFile, setUploadFile] = useState(null);

  // Reports state
  const [report, setReport] = useState(null);
  const [reportLab, setReportLab] = useState('iot');
  const [reportDate, setReportDate] = useState('');
  const [reportSearch, setReportSearch] = useState('');

  useEffect(() => { fetchActiveSessions(); }, [lab]);
  useEffect(() => { fetchStudents(); fetchAttendanceLogs(); }, [lab]);
  useEffect(() => { if (view === 'dashboard' && tab === 'sessions') fetchSessions(); }, [view, tab, lab]);

  const fetchAttendanceLogs = async () => {
    try {
      const { data } = await api.get(`/attendance/logs?lab=${lab}`);
      const logs = data.map((l) => ({
        usn: l.usn,
        name: l.studentName,
        lab: l.lab,
        timestamp: l.timestamp,
        logId: l._id,
        date: l.session?.date || new Date(l.timestamp).toISOString().split('T')[0],
      }));
      setRecentMarked(logs);
    } catch {}
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  // Physical barcode scanner listener
  // Physical scanners type characters very fast (<50ms between keys) and end with Enter
  useEffect(() => {
    if (view !== 'scan' || !physicalScannerActive) return;

    const handleKeyDown = (e) => {
      // Ignore if user is typing in a regular input (except our USN input)
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'select') return;
      if (tag === 'input' && e.target !== usnRef.current) return;

      const now = Date.now();

      if (e.key === 'Enter') {
        // If buffer has content and was typed fast, it's a physical scan
        const buffer = physicalBuffer.current.trim().toUpperCase();
        if (buffer.length >= 3) {
          e.preventDefault();
          setUsnInput(buffer);
          doMarkAttendance(buffer);
        }
        physicalBuffer.current = '';
        clearTimeout(physicalTimer.current);
        return;
      }

      // Only capture printable characters
      if (e.key.length === 1) {
        const timeDiff = now - lastScanTime.current;
        
        // If too much time passed, reset buffer (user is typing manually)
        if (timeDiff > 100 && physicalBuffer.current.length > 0) {
          physicalBuffer.current = '';
        }

        physicalBuffer.current += e.key;
        lastScanTime.current = now;

        // Auto-clear buffer after 200ms of no input (safety)
        clearTimeout(physicalTimer.current);
        physicalTimer.current = setTimeout(() => {
          physicalBuffer.current = '';
        }, 200);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, physicalScannerActive, selectedSession]);

  const startScanner = async () => {
    setScannerOpen(true);
    setScannerReady(false);
    // Wait for DOM element to render
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode('scanner-container');
        html5QrCodeRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 160 }, aspectRatio: 1.5 },
          (decodedText) => { handleScanResult(decodedText); },
          () => {}
        );
        setScannerReady(true);
      } catch (err) {
        console.error('Scanner error:', err);
        toast.error('Could not access camera. Check permissions.');
        setScannerOpen(false);
      }
    }, 300);
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
    } catch {}
    setScannerOpen(false);
    setScannerReady(false);
  };

  const handleScanResult = useCallback((text) => {
    // Extract USN from scanned text (could be just USN or a URL/string containing it)
    const usn = text.trim().toUpperCase();
    if (!usn) return;
    // Prevent rapid duplicate scans
    setUsnInput(usn);
    doMarkAttendance(usn);
  }, [selectedSession]);

  const doMarkAttendance = async (usn) => {
    if (!usn) return;
    if (!selectedSession) { toast.error('Open a session first'); return; }
    setMarkLoading(true);
    setLastMarked(null);
    try {
      const { data } = await api.post('/attendance/mark', { usn, sessionId: selectedSession, method: 'scan' });
      setLastMarked(data.student);
      setRecentMarked((p) => [{ ...data.student, timestamp: new Date(), logId: data.log._id, date: new Date().toISOString().split('T')[0] }, ...p.slice(0, 199)]);
      setUsnInput('');
      toast.success(`${data.student.name} — marked!`);
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setMarkLoading(false); }
  };

  const markAttendance = () => doMarkAttendance(usnInput.trim().toUpperCase());

  const fetchActiveSessions = async () => {
    try {
      const { data } = await api.get(`/sessions/active?lab=${lab}`);
      setActiveSessions(data);
      if (data.length > 0 && !selectedSession) setSelectedSession(data[0]._id);
    } catch {}
  };
  const fetchSessions = async () => {
    try { const { data } = await api.get(`/sessions?lab=${lab}`); setSessions(data); } catch {}
  };
  const fetchStudents = async () => {
    try { const { data } = await api.get(`/shortlist?lab=${lab}`); setStudents(data); } catch {}
  };
  const openSession = async () => {
    try {
      const { data } = await api.post('/sessions', { lab });
      toast.success('Session opened');
      setActiveSessions((p) => [data, ...p]);
      setSelectedSession(data._id);
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };
  const closeSession = async (id) => {
    try {
      await api.patch(`/sessions/${id}/close`);
      toast.success('Session closed');
      fetchActiveSessions();
      if (selectedSession === id) setSelectedSession('');
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };
  const addStudent = async () => {
    try {
      await api.post('/shortlist', newStudent);
      toast.success('Student added');
      setNewStudent({ usn: '', name: '', email: '', phone: '', department: '', lab });
      fetchStudents();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };
  const uploadBulk = async () => {
    if (!uploadFile) return toast.error('Select a file');
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('lab', lab); // send currently selected lab
    try {
      const { data } = await api.post('/shortlist/upload', fd);
      toast.success(`Added ${data.added}, skipped ${data.skipped}`);
      fetchStudents(); setUploadFile(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
  };
  const removeStudent = async (id) => {
    if (!window.confirm('Remove this student?')) return;
    try { await api.delete(`/shortlist/${id}`); toast.success('Removed'); fetchStudents(); } catch {}
  };

  const deleteAttendance = async (logId, studentName) => {
    if (!window.confirm(`Delete attendance for ${studentName}?`)) return;
    if (!window.confirm(`Are you sure? This cannot be undone.`)) return;
    try {
      await api.delete(`/attendance/${logId}`);
      setRecentMarked((p) => p.filter((r) => r.logId !== logId));
      toast.success('Attendance deleted');
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };
  const [editStudent, setEditStudent] = useState(null);
  const saveEdit = async () => {
    if (!editStudent) return;
    try {
      await api.put(`/shortlist/${editStudent._id}`, {
        name: editStudent.name,
        email: editStudent.email,
        phone: editStudent.phone,
        department: editStudent.department,
        lab: editStudent.lab,
        isActive: editStudent.isActive,
      });
      toast.success('Student updated');
      setEditStudent(null);
      fetchStudents();
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
  };
  const toggleActive = async (st) => {
    try {
      await api.put(`/shortlist/${st._id}`, { ...st, isActive: !st.isActive });
      toast.success(st.isActive ? 'Student deactivated' : 'Student activated');
      fetchStudents();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };
  const fetchReport = async () => {
    try {
      let url = `/attendance/report?lab=${reportLab}`;
      if (reportDate) url += `&date=${reportDate}`;
      if (reportSearch) url += `&search=${encodeURIComponent(reportSearch)}`;
      const { data } = await api.get(url);
      setReport(data);
    } catch { toast.error('Failed to load report'); }
  };
  const exportExcel = async () => {
    try {
      let url = `/attendance/export?lab=${reportLab}`;
      if (reportDate) url += `&date=${reportDate}`;
      if (reportSearch) url += `&search=${encodeURIComponent(reportSearch)}`;
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `attendance_${reportLab}_${reportDate || 'all'}.xlsx`;
      link.click();
      toast.success('Excel downloaded');
    } catch { toast.error('Export failed'); }
  };

  const exportFullReport = async () => {
    try {
      const response = await api.get(`/attendance/full-report?lab=${reportLab}`, { responseType: 'blob' });
      const blob = new Blob([response.data]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `full_report_${reportLab}.xlsx`;
      link.click();
      toast.success('Full report downloaded');
    } catch { toast.error('Export failed'); }
  };

  const exportAttendanceLog = async () => {
    try {
      const response = await api.get(`/attendance/export?lab=${lab}`, { responseType: 'blob' });
      const blob = new Blob([response.data]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `attendance_log_${lab}.xlsx`;
      link.click();
      toast.success('Excel downloaded');
    } catch { toast.error('Export failed'); }
  };

  // ─── SCAN VIEW ───
  if (view === 'scan') {
    return (
      <div style={s.scanPage}>
        <div style={s.blob1} />
        <div style={s.blob2} />
        <div style={s.scanTopbar}>
          <div style={s.scanBrand}><div style={s.brandDot} /><span style={s.brandName}>Samsung Lab</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={s.adminName}>{user?.name}</span>
            <button style={s.logoutBtn} onClick={() => { stopScanner(); logout(); navigate('/'); }}>Sign out</button>
          </div>
        </div>
        <div style={s.scanControls}>
          <div style={s.labPills}>
            {['iot', 'coding'].map((l) => (
              <button key={l} style={{ ...s.labPill, ...(lab === l ? s.labPillActive : {}) }}
                onClick={() => { setLab(l); setSelectedSession(''); setLastMarked(null); }}>
                {LAB_LABELS[l]}
              </button>
            ))}
          </div>
          <div style={s.sessionRow}>
            {activeSessions.length === 0 ? (
              <button style={s.openSessionBtn} onClick={openSession}>+ Open Session</button>
            ) : (
              <>
                <select style={s.sessionSelect} value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}>
                  {activeSessions.map((ss) => <option key={ss._id} value={ss._id}>{ss.title}</option>)}
                </select>
                <button style={s.openSessionBtn} onClick={openSession}>+</button>
                <button style={s.closeSessionBtn} onClick={() => closeSession(selectedSession)}>Close</button>
              </>
            )}
          </div>
        </div>

        <div style={s.scanCenter}>
          <h1 style={s.scanTitle}>Mark Attendance</h1>
          <p style={s.scanSubtitle}>Scan QR code / barcode or type USN manually</p>

          {/* Physical scanner indicator */}
          <div style={s.physicalScannerBar}>
            <div style={{ ...s.physicalDot, background: physicalScannerActive ? '#4ade80' : '#555' }} />
            <span style={s.physicalText}>
              Physical Scanner: {physicalScannerActive ? 'Active — just scan, it auto-detects' : 'Off'}
            </span>
            <button style={s.physicalToggle} onClick={() => setPhysicalScannerActive(!physicalScannerActive)}>
              {physicalScannerActive ? 'Disable' : 'Enable'}
            </button>
          </div>

          {/* Scanner toggle button */}
          <div style={s.scannerToggle}>
            {!scannerOpen ? (
              <button style={s.scannerOpenBtn} onClick={startScanner}>
                📷 Open Scanner
              </button>
            ) : (
              <button style={s.scannerCloseBtn} onClick={stopScanner}>
                ✕ Close Scanner
              </button>
            )}
          </div>

          {/* Camera scanner area */}
          {scannerOpen && (
            <div style={s.scannerWrap}>
              <div id="scanner-container" style={s.scannerBox} ref={scannerRef} />
              {!scannerReady && <p style={s.scannerLoading}>Starting camera...</p>}
              <p style={s.scannerHint}>Point camera at QR code or barcode on student ID</p>
            </div>
          )}

          {/* Manual USN input */}
          <div style={s.scanInputWrap}>
            <input ref={usnRef} style={s.scanInput} placeholder="Or type USN here..." value={usnInput}
              onChange={(e) => setUsnInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && markAttendance()} autoFocus />
            <button style={{ ...s.scanBtn, opacity: markLoading ? 0.6 : 1 }} disabled={markLoading} onClick={markAttendance}>
              {markLoading ? '...' : 'Mark'}
            </button>
          </div>

          {/* Success message */}
          {lastMarked && (
            <div style={s.successCard}>
              <div style={s.successIcon}>✓</div>
              <h2 style={s.successTitle}>Hello, {lastMarked.name}!</h2>
              <p style={s.successText}>Your attendance is marked for {LAB_LABELS[lastMarked.lab]}</p>
              <span style={s.successUsn}>{lastMarked.usn}</span>
            </div>
          )}
        </div>

        {/* Recent list */}
        {recentMarked.length > 0 && (
          <div style={s.recentWrap}>
            <h3 style={s.recentTitle}>Recently Marked ({recentMarked.length})</h3>
            <div style={s.recentList}>
              {recentMarked.map((r, i) => (
                <div key={i} style={s.recentItem}>
                  <span style={s.recentName}>{r.name}</span>
                  <span style={s.recentUsn}>{r.usn}</span>
                  <span style={s.recentTime}>{new Date(r.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={s.goDashWrap}>
          <button style={s.goDashBtn} onClick={() => { stopScanner(); setView('dashboard'); }}>Go to My Dashboard →</button>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD VIEW ───
  const TABS = [
    { key: 'attendance', label: 'Attendance Log' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'reports', label: 'Reports' },
  ];

  return (
    <div style={s.dashPage}>
      <aside style={s.sidebar}>
        <div>
          <div style={s.sidebarBrand}><div style={s.brandDot} /><span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Samsung Lab</span></div>
          <div style={s.labPillsSide}>
            {['iot', 'coding'].map((l) => (
              <button key={l} style={{ ...s.labPillSide, ...(lab === l ? s.labPillSideActive : {}) }} onClick={() => setLab(l)}>{LAB_LABELS[l]}</button>
            ))}
          </div>
          <nav style={s.nav}>
            <button style={s.navBtn} onClick={() => setView('scan')}>← Back to Scan</button>
            {TABS.map((t) => (
              <button key={t.key} style={{ ...s.navItem, ...(tab === t.key ? s.navItemActive : {}) }} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
            <button style={{ ...s.navItem, ...s.shortlistNavBtn, ...(tab === 'shortlist' ? s.navItemActive : {}) }} onClick={() => { setTab('shortlist'); fetchStudents(); }}>
              📋 Shortlisted Students
            </button>
          </nav>
        </div>
        <div>
          <div style={s.sideUser}>{user?.name}</div>
          <button style={s.logoutBtn} onClick={() => { logout(); navigate('/'); }}>Sign out</button>
        </div>
      </aside>

      <main style={s.dashMain}>
        <h1 style={s.dashTitle}>
          {tab === 'attendance' && `Today's Attendance — ${LAB_LABELS[lab]}`}
          {tab === 'sessions' && `Sessions — ${LAB_LABELS[lab]}`}
          {tab === 'reports' && 'Attendance Reports'}
          {tab === 'shortlist' && `Shortlisted Students — ${LAB_LABELS[lab]}`}
        </h1>

        {/* ATTENDANCE LOG TAB (default) */}
        {tab === 'attendance' && (
          <div>
            <div style={s.card}>
              <div style={s.listHeader}>
                <h3 style={s.cardTitle}>Attendance Log ({recentMarked.length})</h3>
                <button style={s.btnExport} onClick={exportAttendanceLog}>⬇ Export Excel</button>
              </div>
              {recentMarked.length === 0 ? (
                <p style={{ ...s.muted, textAlign: 'center', padding: 30 }}>No attendance marked yet. Go to scan page to start marking.</p>
              ) : (
                <table style={s.table}>
                  <thead><tr>{['#', 'USN', 'Name', 'Lab', 'Date', 'Time', ''].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {recentMarked.map((r, i) => (
                      <tr key={i}>
                        <td style={s.td}>{i + 1}</td>
                        <td style={{ ...s.td, fontWeight: 600, fontFamily: 'monospace' }}>{r.usn}</td>
                        <td style={s.td}>{r.name}</td>
                        <td style={s.td}><span style={{ ...s.badge, background: r.lab === 'iot' ? '#0e3a6e' : '#1e3a1e' }}>{LAB_LABELS[r.lab]}</span></td>
                        <td style={s.td}>{r.date || new Date(r.timestamp).toLocaleDateString()}</td>
                        <td style={s.td}>{new Date(r.timestamp).toLocaleTimeString()}</td>
                        <td style={s.td}><button style={s.deleteBtn} onClick={() => deleteAttendance(r.logId, r.name)} title="Delete">🗑</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* SESSIONS TAB */}
        {tab === 'sessions' && (
          <div>
            <button style={{ ...s.btnPrimary, marginBottom: 16 }} onClick={openSession}>+ Open new session</button>
            <div style={s.card}>
              <table style={s.table}>
                <thead><tr>{['Title', 'Date', 'Lab', 'Status', ''].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {sessions.map((ss) => (
                    <tr key={ss._id}>
                      <td style={s.td}>{ss.title}</td>
                      <td style={s.td}>{ss.date}</td>
                      <td style={s.td}>{LAB_LABELS[ss.lab]}</td>
                      <td style={s.td}><span style={{ color: ss.isActive ? '#4ade80' : '#666', fontSize: 12 }}>{ss.isActive ? 'Active' : 'Closed'}</span></td>
                      <td style={s.td}>{ss.isActive && <button style={s.btnSm} onClick={() => closeSession(ss._id)}>Close</button>}</td>
                    </tr>
                  ))}
                  {sessions.length === 0 && <tr><td colSpan={5} style={{ ...s.td, color: '#555', textAlign: 'center' }}>No sessions</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SHORTLISTED STUDENTS TAB (right side nav) */}
        {tab === 'shortlist' && (
          <div>
            <div style={s.row}>
              <div style={s.card}>
                <h3 style={s.cardTitle}>Add Student</h3>
                {[
                  { key: 'usn', placeholder: 'USN *', type: 'text' },
                  { key: 'name', placeholder: 'Full name *', type: 'text' },
                  { key: 'email', placeholder: 'Email', type: 'email' },
                  { key: 'department', placeholder: 'Department', type: 'text' },
                  { key: 'phone', placeholder: 'Phone', type: 'text' },
                ].map((f) => (
                  <input key={f.key} style={{ ...s.input, marginBottom: 10 }} placeholder={f.placeholder} type={f.type}
                    value={newStudent[f.key]} onChange={(e) => setNewStudent({ ...newStudent, [f.key]: e.target.value })} />
                ))}
                <select style={{ ...s.select, marginBottom: 12 }} value={newStudent.lab} onChange={(e) => setNewStudent({ ...newStudent, lab: e.target.value })}>
                  <option value="iot">Samsung IoT</option>
                  <option value="coding">Samsung Coding</option>
                </select>
                <button style={s.btnPrimary} onClick={addStudent}>Add to shortlist</button>
              </div>
              <div style={s.card}>
                <h3 style={s.cardTitle}>Bulk Upload</h3>
                <p style={s.muted}>Supports <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong></p>
                <p style={s.muted}>Columns: usn, name, email, phone, department, lab, password</p>
                <p style={s.muted}>lab: <code>iot</code> or <code>coding</code> | password defaults to USN</p>
                <input type="file" accept=".csv,.xlsx,.xls" style={{ margin: '14px 0', color: '#aaa' }} onChange={(e) => setUploadFile(e.target.files[0])} />
                <button style={s.btnPrimary} onClick={uploadBulk}>Upload File</button>
              </div>
            </div>

            {/* Edit modal */}
            {editStudent && (
              <div style={s.editOverlay}>
                <div style={s.editModal}>
                  <h3 style={s.cardTitle}>Edit Student — {editStudent.usn}</h3>
                  {[
                    { key: 'name', label: 'Name', type: 'text' },
                    { key: 'email', label: 'Email', type: 'email' },
                    { key: 'department', label: 'Department', type: 'text' },
                    { key: 'phone', label: 'Phone', type: 'text' },
                  ].map((f) => (
                    <div key={f.key} style={{ marginBottom: 10 }}>
                      <label style={s.editLabel}>{f.label}</label>
                      <input style={s.input} type={f.type} value={editStudent[f.key] || ''}
                        onChange={(e) => setEditStudent({ ...editStudent, [f.key]: e.target.value })} />
                    </div>
                  ))}
                  <div style={{ marginBottom: 10 }}>
                    <label style={s.editLabel}>Lab</label>
                    <select style={s.select} value={editStudent.lab} onChange={(e) => setEditStudent({ ...editStudent, lab: e.target.value })}>
                      <option value="iot">Samsung IoT</option>
                      <option value="coding">Samsung Coding</option>
                    </select>
                  </div>
                  <div style={s.editActions}>
                    <button style={s.btnPrimary} onClick={saveEdit}>Save Changes</button>
                    <button style={s.btnSm} onClick={() => setEditStudent(null)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {/* Student list */}
            <div style={s.card}>
              <div style={s.listHeader}>
                <h3 style={s.cardTitle}>Shortlisted Students ({students.length})</h3>
                <span style={s.listHint}>Only active students are eligible for scanning</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>{['#', 'USN', 'Name', 'Department', 'Lab', 'Registered', 'Eligible', 'Actions'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {students.map((st, idx) => (
                      <tr key={st._id} style={{ background: !st.isActive ? 'rgba(248,113,113,0.03)' : 'transparent' }}>
                        <td style={s.td}>{idx + 1}</td>
                        <td style={{ ...s.td, fontWeight: 600, fontFamily: 'monospace' }}>{st.usn}</td>
                        <td style={s.td}>{st.name}</td>
                        <td style={s.td}>{st.department || '—'}</td>
                        <td style={s.td}><span style={{ ...s.badge, background: st.lab === 'iot' ? '#0e3a6e' : '#1e3a1e' }}>{LAB_LABELS[st.lab]}</span></td>
                        <td style={s.td}><span style={{ color: st.isRegistered ? '#60a5fa' : '#666', fontSize: 12 }}>{st.isRegistered ? 'Yes' : 'No'}</span></td>
                        <td style={s.td}>
                          <span style={{ ...s.eligibleBadge, background: st.isActive ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: st.isActive ? '#4ade80' : '#f87171' }}>
                            {st.isActive ? '✓ Eligible' : '✕ Not eligible'}
                          </span>
                        </td>
                        <td style={s.td}>
                          <div style={s.actionBtns}>
                            <button style={s.editBtn} onClick={() => setEditStudent({ ...st })} title="Edit">✎</button>
                            <button style={{ ...s.toggleBtn, color: st.isActive ? '#facc15' : '#4ade80' }} onClick={() => toggleActive(st)} title={st.isActive ? 'Deactivate' : 'Activate'}>
                              {st.isActive ? '⏸' : '▶'}
                            </button>
                            <button style={s.deleteBtn} onClick={() => removeStudent(st._id)} title="Delete">🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && <tr><td colSpan={8} style={{ ...s.td, color: '#555', textAlign: 'center' }}>No students uploaded yet. Add manually or upload a file.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {tab === 'reports' && (
          <div>
            <div style={s.card}>
              <h3 style={s.cardTitle}>Search & Filter</h3>
              <div style={s.filterRow}>
                <select style={s.select} value={reportLab} onChange={(e) => { setReportLab(e.target.value); setReport(null); }}>
                  <option value="iot">Samsung IoT</option>
                  <option value="coding">Samsung Coding</option>
                </select>
                <input style={s.filterInput} type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
                <input style={{ ...s.filterInput, minWidth: 200 }} type="text" placeholder="Search name or USN..." value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} />
                <button style={s.btnPrimary} onClick={fetchReport}>Search</button>
                <button style={s.btnExport} onClick={exportExcel}>⬇ Export Excel</button>
                <button style={s.btnFullReport} onClick={exportFullReport}>📊 Generate Full Report</button>
              </div>
            </div>
            {report && (
              <div style={{ ...s.card, marginTop: 16 }}>
                <div style={s.reportHeader}>
                  <h3 style={s.cardTitle}>Attendance — {LAB_LABELS[report.lab] || 'All'} {report.date !== 'all' ? `| ${report.date}` : '| All dates'}</h3>
                  <span style={s.reportMeta}>{report.totalStudents} students · {report.totalSessions} sessions</span>
                </div>
                <table style={s.table}>
                  <thead><tr>{['S.No', 'USN', 'Name', 'Department', 'Date', 'Status', 'Sessions', '%'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {report.report.map((r, i) => (
                      <tr key={i}>
                        <td style={s.td}>{i + 1}</td>
                        <td style={{ ...s.td, fontWeight: 600, fontFamily: 'monospace' }}>{r.usn}</td>
                        <td style={s.td}>{r.name}</td>
                        <td style={s.td}>{r.department}</td>
                        <td style={s.td}>{report.date !== 'all' ? report.date : (r.dates && r.dates.length > 0 ? r.dates[0].date : '—')}</td>
                        <td style={s.td}>
                          <span style={{ ...s.statusBadge, background: r.status === 'Present' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: r.status === 'Present' ? '#4ade80' : '#f87171' }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={s.td}>{r.sessionsAttended}/{r.totalSessions}</td>
                        <td style={s.td}><span style={{ color: r.percentage >= 75 ? '#4ade80' : r.percentage >= 50 ? '#facc15' : '#f87171', fontWeight: 600 }}>{r.percentage}%</span></td>
                      </tr>
                    ))}
                    {report.report.length === 0 && <tr><td colSpan={8} style={{ ...s.td, color: '#555', textAlign: 'center' }}>No data found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const s = {
  scanPage: { minHeight: '100vh', background: '#050505', fontFamily: "'Inter','DM Sans',sans-serif", color: '#e0e0e0', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  blob1: { position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,136,252,0.06) 0%, transparent 70%)', top: -200, right: -150 },
  blob2: { position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)', bottom: -100, left: -100 },
  scanTopbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', position: 'relative', zIndex: 1 },
  scanBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  brandDot: { width: 10, height: 10, borderRadius: '50%', background: 'linear-gradient(135deg, #1488fc, #6366f1)' },
  brandName: { fontSize: 15, fontWeight: 700, color: '#fff' },
  adminName: { fontSize: 13, color: '#666' },
  logoutBtn: { padding: '7px 14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  scanControls: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '12px 32px', position: 'relative', zIndex: 1, flexWrap: 'wrap' },
  labPills: { display: 'flex', gap: 6 },
  labPill: { padding: '8px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#888', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' },
  labPillActive: { background: 'rgba(20,136,252,0.15)', borderColor: '#1488fc', color: '#1488fc' },
  sessionRow: { display: 'flex', gap: 8, alignItems: 'center' },
  sessionSelect: { padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#ccc', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  openSessionBtn: { padding: '8px 14px', background: 'rgba(20,136,252,0.15)', border: '1px solid rgba(20,136,252,0.3)', borderRadius: 8, color: '#1488fc', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  closeSessionBtn: { padding: '8px 14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, color: '#f87171', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  scanCenter: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', position: 'relative', zIndex: 1 },
  scanTitle: { fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '-0.5px' },
  scanSubtitle: { fontSize: 14, color: '#666', marginBottom: 24 },

  // Scanner styles
  scannerToggle: { marginBottom: 20 },
  scannerOpenBtn: { padding: '14px 28px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', gap: 10 },
  scannerCloseBtn: { padding: '14px 28px', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 12, color: '#f87171', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  scannerWrap: { width: '100%', maxWidth: 400, marginBottom: 24, textAlign: 'center' },
  scannerBox: { width: '100%', borderRadius: 16, overflow: 'hidden', border: '2px solid rgba(99,102,241,0.3)', background: '#000' },
  scannerLoading: { fontSize: 13, color: '#888', marginTop: 10 },
  scannerHint: { fontSize: 12, color: '#555', marginTop: 10 },

  // Physical scanner styles
  physicalScannerBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, marginBottom: 20 },
  physicalDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  physicalText: { fontSize: 12, color: '#888', flex: 1 },
  physicalToggle: { padding: '4px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#aaa', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },

  // Input styles
  scanInputWrap: { display: 'flex', gap: 0, width: '100%', maxWidth: 500, marginTop: 8 },
  scanInput: { flex: 1, padding: '16px 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px 0 0 12px', color: '#fff', fontSize: 18, fontFamily: 'monospace', letterSpacing: 2, outline: 'none' },
  scanBtn: { padding: '16px 28px', background: 'linear-gradient(135deg, #1488fc, #6366f1)', border: 'none', borderRadius: '0 12px 12px 0', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },

  // Success
  successCard: { marginTop: 24, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 20, padding: '28px 40px', textAlign: 'center', animation: 'fadeIn 0.3s ease' },
  successIcon: { width: 52, height: 52, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#4ade80', marginBottom: 12 },
  successTitle: { fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 6px' },
  successText: { fontSize: 14, color: '#aaa', margin: 0 },
  successUsn: { display: 'inline-block', marginTop: 10, padding: '4px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 8, fontSize: 13, color: '#888', fontFamily: 'monospace' },

  // Recent
  recentWrap: { width: '100%', maxWidth: 500, margin: '0 auto', padding: '0 20px', position: 'relative', zIndex: 1 },
  recentTitle: { fontSize: 13, color: '#666', marginBottom: 10, fontWeight: 600 },
  recentList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' },
  recentItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10 },
  recentName: { fontSize: 13, color: '#ccc', fontWeight: 500 },
  recentUsn: { fontSize: 12, color: '#666', fontFamily: 'monospace' },
  recentTime: { fontSize: 11, color: '#555' },
  goDashWrap: { padding: '20px 32px', position: 'relative', zIndex: 1, textAlign: 'center' },
  goDashBtn: { padding: '14px 32px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#aaa', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },

  // Dashboard styles
  dashPage: { display: 'flex', minHeight: '100vh', background: '#080808', fontFamily: "'Inter','DM Sans',sans-serif", color: '#e0e0e0' },
  sidebar: { width: 230, background: '#0d0d0d', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px 16px', position: 'sticky', top: 0, height: '100vh' },
  sidebarBrand: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, paddingLeft: 4 },
  labPillsSide: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 },
  labPillSide: { padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#666', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' },
  labPillSideActive: { background: 'rgba(20,136,252,0.1)', borderColor: 'rgba(20,136,252,0.3)', color: '#1488fc' },
  nav: { display: 'flex', flexDirection: 'column', gap: 4 },
  navBtn: { padding: '9px 12px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.03)', color: '#1488fc', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', marginBottom: 8 },
  navItem: { padding: '9px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: '#777', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' },
  navItemActive: { background: 'rgba(255,255,255,0.04)', color: '#fff' },
  shortlistNavBtn: { marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 },
  sideUser: { fontSize: 12, color: '#555', marginBottom: 8, paddingLeft: 4 },
  dashMain: { flex: 1, padding: '32px 36px', overflow: 'auto' },
  dashTitle: { fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24, letterSpacing: '-0.3px' },
  row: { display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
  card: { flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '22px' },
  cardTitle: { fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 14 },
  muted: { fontSize: 12, color: '#555', marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box', padding: '11px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  select: { padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#aaa', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  filterRow: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  filterInput: { padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  btnPrimary: { padding: '10px 18px', background: 'linear-gradient(135deg, #1488fc, #6366f1)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnExport: { padding: '10px 18px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 10, color: '#4ade80', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnFullReport: { padding: '10px 18px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 10, color: '#60a5fa', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnSm: { padding: '5px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#555', borderBottom: '1px solid rgba(255,255,255,0.05)', textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { padding: '12px 12px', fontSize: 13, color: '#ccc', borderBottom: '1px solid rgba(255,255,255,0.03)' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, color: '#aaa' },
  statusBadge: { display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500 },
  reportHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  reportMeta: { fontSize: 12, color: '#666' },

  // Edit modal
  editOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  editModal: { background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '28px 32px', width: 400, maxHeight: '80vh', overflowY: 'auto' },
  editLabel: { fontSize: 11, color: '#888', marginBottom: 4, display: 'block' },
  editActions: { display: 'flex', gap: 10, marginTop: 16 },

  // Student list
  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 },
  listHint: { fontSize: 11, color: '#555' },
  eligibleBadge: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500 },
  actionBtns: { display: 'flex', gap: 6 },
  editBtn: { width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.1)', color: '#60a5fa', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  toggleBtn: { width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(250,204,21,0.3)', background: 'rgba(250,204,21,0.08)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
