import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

const LAB_LABELS = { iot: 'Samsung IoT', coding: 'Samsung Coding' };

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('mark');
  const [lab, setLab] = useState('iot');

  // Sessions
  const [sessions, setSessions] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');

  // Attendance marking
  const [usnInput, setUsnInput] = useState('');
  const [markLoading, setMarkLoading] = useState(false);
  const [recentMarked, setRecentMarked] = useState([]);
  const usnRef = useRef(null);

  // Shortlist
  const [students, setStudents] = useState([]);
  const [newStudent, setNewStudent] = useState({ usn: '', name: '', email: '', phone: '', lab: 'iot' });
  const [csvFile, setCsvFile] = useState(null);

  // Reports
  const [report, setReport] = useState(null);
  const [reportLab, setReportLab] = useState('iot');

  useEffect(() => { fetchActiveSessions(); }, [lab]);
  useEffect(() => { if (tab === 'shortlist') fetchStudents(); }, [tab, lab]);
  useEffect(() => { if (tab === 'sessions') fetchSessions(); }, [tab, lab]);

  const fetchActiveSessions = async () => {
    try {
      const { data } = await api.get(`/sessions/active?lab=${lab}`);
      setActiveSessions(data);
      if (data.length > 0 && !selectedSession) setSelectedSession(data[0]._id);
    } catch {}
  };

  const fetchSessions = async () => {
    try {
      const { data } = await api.get(`/sessions?lab=${lab}`);
      setSessions(data);
    } catch {}
  };

  const fetchStudents = async () => {
    try {
      const { data } = await api.get(`/shortlist?lab=${lab}`);
      setStudents(data);
    } catch {}
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

  const markAttendance = async (method = 'manual') => {
    if (!usnInput.trim()) return;
    if (!selectedSession) return toast.error('Select or open a session first');
    setMarkLoading(true);
    try {
      const { data } = await api.post('/attendance/mark', {
        usn: usnInput.trim(),
        sessionId: selectedSession,
        method,
      });
      toast.success(`${data.student.name} marked present`);
      setRecentMarked((p) => [{ ...data.student, timestamp: new Date() }, ...p.slice(0, 9)]);
      setUsnInput('');
      usnRef.current?.focus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error marking attendance');
    } finally { setMarkLoading(false); }
  };

  const addStudent = async () => {
    try {
      await api.post('/shortlist', newStudent);
      toast.success('Student added');
      setNewStudent({ usn: '', name: '', email: '', phone: '', lab });
      fetchStudents();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const uploadCSV = async () => {
    if (!csvFile) return toast.error('Select a CSV file');
    const fd = new FormData();
    fd.append('file', csvFile);
    try {
      const { data } = await api.post('/shortlist/upload-csv', fd);
      toast.success(`Added ${data.added}, skipped ${data.skipped}`);
      fetchStudents();
      setCsvFile(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
  };

  const removeStudent = async (id) => {
    if (!window.confirm('Remove this student?')) return;
    try {
      await api.delete(`/shortlist/${id}`);
      toast.success('Removed');
      fetchStudents();
    } catch {}
  };

  const fetchReport = async () => {
    try {
      const { data } = await api.get(`/attendance/report?lab=${reportLab}`);
      setReport(data);
    } catch (err) { toast.error('Failed to load report'); }
  };

  const TABS = [
    { key: 'mark', label: 'Mark Attendance' },
    { key: 'shortlist', label: 'Shortlist' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'reports', label: 'Reports' },
  ];

  return (
    <div style={s.page}>
      <aside style={s.sidebar}>
        <div>
          <div style={s.brand}>
            <span style={s.brandText}>Samsung Lab</span>
            <span style={s.brandRole}>Admin Panel</span>
          </div>
          <div style={s.labSwitch}>
            {['iot', 'coding'].map((l) => (
              <button
                key={l}
                style={{ ...s.labBtn, ...(lab === l ? s.labBtnActive : {}) }}
                onClick={() => { setLab(l); setSelectedSession(''); setRecentMarked([]); }}
              >
                {LAB_LABELS[l]}
              </button>
            ))}
          </div>
          <nav style={s.nav}>
            {TABS.map((t) => (
              <button
                key={t.key}
                style={{ ...s.navBtn, ...(tab === t.key ? s.navBtnActive : {}) }}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div>
          <div style={s.userInfo}>{user?.name}</div>
          <button style={s.logoutBtn} onClick={() => { logout(); navigate('/'); }}>Sign out</button>
        </div>
      </aside>

      <main style={s.main}>
        <div style={s.topbar}>
          <h1 style={s.pageTitle}>
            {tab === 'mark' && `Mark Attendance — ${LAB_LABELS[lab]}`}
            {tab === 'shortlist' && `Shortlisted Students — ${LAB_LABELS[lab]}`}
            {tab === 'sessions' && `Sessions — ${LAB_LABELS[lab]}`}
            {tab === 'reports' && 'Reports'}
          </h1>
        </div>

        {/* ── MARK ATTENDANCE ── */}
        {tab === 'mark' && (
          <div style={s.content}>
            <div style={s.row}>
              {/* Session selector */}
              <div style={s.card}>
                <h3 style={s.cardTitle}>Active Session</h3>
                {activeSessions.length === 0 ? (
                  <p style={s.muted}>No active session. Open one to start marking.</p>
                ) : (
                  <select
                    style={s.select}
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                  >
                    {activeSessions.map((ss) => (
                      <option key={ss._id} value={ss._id}>{ss.title}</option>
                    ))}
                  </select>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button style={s.btnPrimary} onClick={openSession}>+ Open session</button>
                  {selectedSession && (
                    <button style={s.btnDanger} onClick={() => closeSession(selectedSession)}>
                      Close session
                    </button>
                  )}
                </div>
              </div>

              {/* USN entry */}
              <div style={s.card}>
                <h3 style={s.cardTitle}>Enter USN / Scan ID</h3>
                <p style={s.muted}>Scan barcode or type USN — press Enter to mark</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <input
                    ref={usnRef}
                    style={{ ...s.input, flex: 1, fontSize: 18, letterSpacing: 1 }}
                    placeholder="USN / scan here"
                    value={usnInput}
                    onChange={(e) => setUsnInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && markAttendance('scan')}
                    autoFocus
                  />
                  <button
                    style={{ ...s.btnPrimary, padding: '0 20px' }}
                    disabled={markLoading}
                    onClick={() => markAttendance('manual')}
                  >
                    {markLoading ? '…' : 'Mark'}
                  </button>
                </div>
              </div>
            </div>

            {/* Recent marked */}
            {recentMarked.length > 0 && (
              <div style={s.card}>
                <h3 style={s.cardTitle}>Recently Marked ({recentMarked.length})</h3>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['USN', 'Name', 'Lab', 'Time'].map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentMarked.map((r, i) => (
                      <tr key={i} style={i === 0 ? s.trNew : {}}>
                        <td style={s.td}>{r.usn}</td>
                        <td style={s.td}>{r.name}</td>
                        <td style={s.td}>{LAB_LABELS[r.lab]}</td>
                        <td style={s.td}>{new Date(r.timestamp).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── SHORTLIST ── */}
        {tab === 'shortlist' && (
          <div style={s.content}>
            <div style={s.row}>
              {/* Add manually */}
              <div style={s.card}>
                <h3 style={s.cardTitle}>Add Student</h3>
                {[
                  { key: 'usn', placeholder: 'USN*', type: 'text' },
                  { key: 'name', placeholder: 'Full name*', type: 'text' },
                  { key: 'email', placeholder: 'Email', type: 'email' },
                  { key: 'phone', placeholder: 'Phone', type: 'text' },
                ].map((f) => (
                  <input
                    key={f.key}
                    style={{ ...s.input, marginBottom: 8 }}
                    placeholder={f.placeholder}
                    type={f.type}
                    value={newStudent[f.key]}
                    onChange={(e) => setNewStudent({ ...newStudent, [f.key]: e.target.value })}
                  />
                ))}
                <select
                  style={{ ...s.select, marginBottom: 12 }}
                  value={newStudent.lab}
                  onChange={(e) => setNewStudent({ ...newStudent, lab: e.target.value })}
                >
                  <option value="iot">Samsung IoT</option>
                  <option value="coding">Samsung Coding</option>
                </select>
                <button style={s.btnPrimary} onClick={addStudent}>Add to shortlist</button>
              </div>

              {/* CSV upload */}
              <div style={s.card}>
                <h3 style={s.cardTitle}>Bulk Upload (CSV)</h3>
                <p style={s.muted}>Columns: usn, name, email, phone, lab, password</p>
                <p style={s.muted}>lab values: <code>iot</code> or <code>coding</code></p>
                <p style={s.muted}>Default password = USN if blank</p>
                <input
                  type="file"
                  accept=".csv"
                  style={{ margin: '12px 0', color: '#aaa' }}
                  onChange={(e) => setCsvFile(e.target.files[0])}
                />
                <button style={s.btnPrimary} onClick={uploadCSV}>Upload CSV</button>
              </div>
            </div>

            <div style={s.card}>
              <h3 style={s.cardTitle}>Shortlisted Students ({students.length})</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['USN', 'Name', 'Lab', 'Email', 'Status', ''].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => (
                    <tr key={st._id}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{st.usn}</td>
                      <td style={s.td}>{st.name}</td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, background: st.lab === 'iot' ? '#0e3a6e' : '#1e3a1e' }}>
                          {LAB_LABELS[st.lab]}
                        </span>
                      </td>
                      <td style={s.td}>{st.email || '—'}</td>
                      <td style={s.td}>
                        <span style={{ color: st.isActive ? '#4ade80' : '#f87171', fontSize: 12 }}>
                          {st.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={s.td}>
                        <button style={s.btnSm} onClick={() => removeStudent(st._id)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr><td colSpan={6} style={{ ...s.td, color: '#555', textAlign: 'center' }}>No students</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SESSIONS ── */}
        {tab === 'sessions' && (
          <div style={s.content}>
            <div style={{ marginBottom: 16 }}>
              <button style={s.btnPrimary} onClick={openSession}>+ Open new session</button>
            </div>
            <div style={s.card}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Title', 'Date', 'Lab', 'Status', ''].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((ss) => (
                    <tr key={ss._id}>
                      <td style={s.td}>{ss.title}</td>
                      <td style={s.td}>{ss.date}</td>
                      <td style={s.td}>{LAB_LABELS[ss.lab]}</td>
                      <td style={s.td}>
                        <span style={{ color: ss.isActive ? '#4ade80' : '#666', fontSize: 12 }}>
                          {ss.isActive ? 'Active' : 'Closed'}
                        </span>
                      </td>
                      <td style={s.td}>
                        {ss.isActive && (
                          <button style={s.btnSm} onClick={() => closeSession(ss._id)}>Close</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {sessions.length === 0 && (
                    <tr><td colSpan={5} style={{ ...s.td, color: '#555', textAlign: 'center' }}>No sessions yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── REPORTS ── */}
        {tab === 'reports' && (
          <div style={s.content}>
            <div style={s.card}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  style={s.select}
                  value={reportLab}
                  onChange={(e) => setReportLab(e.target.value)}
                >
                  <option value="iot">Samsung IoT</option>
                  <option value="coding">Samsung Coding</option>
                </select>
                <button style={s.btnPrimary} onClick={fetchReport}>Load report</button>
              </div>
            </div>

            {report && (
              <>
                <div style={{ ...s.card, marginTop: 16 }}>
                  <h3 style={s.cardTitle}>Student Summary</h3>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        {['USN', 'Name', 'Lab', 'Sessions present'].map((h) => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.summary.map((r, i) => (
                        <tr key={i}>
                          <td style={{ ...s.td, fontWeight: 600 }}>{r.usn}</td>
                          <td style={s.td}>{r.name}</td>
                          <td style={s.td}>{LAB_LABELS[r.lab]}</td>
                          <td style={s.td}>{r.present}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ ...s.card, marginTop: 16 }}>
                  <h3 style={s.cardTitle}>Detailed Logs ({report.total})</h3>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        {['USN', 'Name', 'Lab', 'Session', 'Method', 'Time'].map((h) => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.logs.map((l, i) => (
                        <tr key={i}>
                          <td style={s.td}>{l.usn}</td>
                          <td style={s.td}>{l.studentName}</td>
                          <td style={s.td}>{LAB_LABELS[l.lab]}</td>
                          <td style={s.td}>{l.session?.title || '—'}</td>
                          <td style={s.td}>{l.method}</td>
                          <td style={s.td}>{new Date(l.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const s = {
  page: { display: 'flex', minHeight: '100vh', background: '#0d0d0d', fontFamily: "'DM Sans', sans-serif", color: '#e0e0e0' },
  sidebar: {
    width: 220, background: '#111', borderRight: '1px solid #1e1e1e',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: '24px 16px', position: 'sticky', top: 0, height: '100vh',
  },
  brand: { marginBottom: 24, paddingLeft: 4 },
  brandText: { display: 'block', fontSize: 16, fontWeight: 700, color: '#fff' },
  brandRole: { display: 'block', fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },
  labSwitch: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 },
  labBtn: { padding: '8px 10px', borderRadius: 8, border: '1px solid #222', background: 'transparent', color: '#666', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: "'DM Sans', sans-serif" },
  labBtnActive: { background: '#1a2a3a', borderColor: '#1488fc', color: '#1488fc' },
  nav: { display: 'flex', flexDirection: 'column', gap: 4 },
  navBtn: { padding: '9px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: '#777', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s' },
  navBtnActive: { background: '#1a1a1a', color: '#fff' },
  userInfo: { fontSize: 12, color: '#555', marginBottom: 8, paddingLeft: 4 },
  logoutBtn: { width: '100%', padding: '8px 0', border: '1px solid #222', borderRadius: 8, background: 'transparent', color: '#666', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' },
  topbar: { padding: '20px 28px 0', borderBottom: '1px solid #1a1a1a', marginBottom: 0 },
  pageTitle: { fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 20 },
  content: { padding: '24px 28px' },
  row: { display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  card: { flex: 1, background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '20px 20px' },
  cardTitle: { fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 },
  muted: { fontSize: 12, color: '#555', marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none' },
  select: { padding: '9px 12px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#aaa', fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none' },
  btnPrimary: { padding: '9px 16px', background: '#1488fc', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  btnDanger: { padding: '9px 16px', background: '#3a1010', border: '1px solid #7f1d1d', borderRadius: 8, color: '#f87171', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  btnSm: { padding: '5px 10px', background: 'transparent', border: '1px solid #333', borderRadius: 6, color: '#888', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#555', borderBottom: '1px solid #1e1e1e', textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { padding: '10px 10px', fontSize: 13, color: '#ccc', borderBottom: '1px solid #181818' },
  trNew: { background: '#0d2010' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, color: '#aaa' },
};