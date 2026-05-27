import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const LAB_LABELS = { iot: 'Samsung IoT', coding: 'Samsung Coding' };

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.usn) fetchMyAttendance();
  }, [user]);

  const fetchMyAttendance = async () => {
    try {
      const { data: res } = await api.get(`/attendance/student/${user.usn}`);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const pct = data?.stats?.percentage ?? 0;
  const color = pct >= 75 ? '#4ade80' : pct >= 50 ? '#facc15' : '#f87171';

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <div>
          <span style={s.brand}>Samsung Lab</span>
          <span style={s.labTag}>{LAB_LABELS[user?.lab] || ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={s.userName}>{user?.name}</span>
          <button style={s.logoutBtn} onClick={() => { logout(); navigate('/'); }}>Sign out</button>
        </div>
      </div>

      {loading ? (
        <div style={s.center}>Loading…</div>
      ) : !data ? (
        <div style={s.center}>Could not load data</div>
      ) : (
        <div style={s.content}>
          {/* Stats row */}
          <div style={s.statsRow}>
            <div style={s.statCard}>
              <span style={{ ...s.statValue, color }}>{pct}%</span>
              <span style={s.statLabel}>Attendance</span>
            </div>
            <div style={s.statCard}>
              <span style={{ ...s.statValue, color: '#4ade80' }}>{data.stats.present}</span>
              <span style={s.statLabel}>Present</span>
            </div>
            <div style={s.statCard}>
              <span style={{ ...s.statValue, color: '#f87171' }}>{data.stats.absent}</span>
              <span style={s.statLabel}>Absent</span>
            </div>
            <div style={s.statCard}>
              <span style={{ ...s.statValue, color: '#60a5fa' }}>{data.stats.totalSessions}</span>
              <span style={s.statLabel}>Total sessions</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={s.cardTitle}>Attendance progress</span>
              <span style={{ fontSize: 13, color }}>{pct}%</span>
            </div>
            <div style={s.progressBg}>
              <div style={{ ...s.progressFill, width: `${pct}%`, background: color }} />
            </div>
            {pct < 75 && (
              <p style={s.warn}>Attendance below 75%. Please attend more sessions.</p>
            )}
          </div>

          {/* Student info */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>My details</h3>
            <div style={s.infoGrid}>
              {[
                ['USN', data.student.usn],
                ['Name', data.student.name],
                ['Lab', LAB_LABELS[data.student.lab]],
                ['Email', data.student.email || '—'],
                ['Phone', data.student.phone || '—'],
              ].map(([k, v]) => (
                <div key={k} style={s.infoRow}>
                  <span style={s.infoKey}>{k}</span>
                  <span style={s.infoVal}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Session history */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>Session history</h3>
            {data.logs.length === 0 ? (
              <p style={s.muted}>No attendance records yet.</p>
            ) : (
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Session', 'Date', 'Lab', 'Time', 'Status'].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log, i) => (
                    <tr key={i}>
                      <td style={s.td}>{log.session?.title || '—'}</td>
                      <td style={s.td}>{log.session?.date || '—'}</td>
                      <td style={s.td}>{LAB_LABELS[log.lab]}</td>
                      <td style={s.td}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td style={s.td}>
                        <span style={s.present}>Present</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#0d0d0d', fontFamily: "'DM Sans', sans-serif", color: '#e0e0e0' },
  topbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 28px', background: '#111', borderBottom: '1px solid #1e1e1e',
  },
  brand: { fontSize: 16, fontWeight: 700, color: '#fff', marginRight: 10 },
  labTag: { fontSize: 12, background: '#0e3a6e', color: '#7ec8ff', padding: '3px 10px', borderRadius: 20 },
  userName: { fontSize: 13, color: '#666' },
  logoutBtn: { padding: '7px 14px', border: '1px solid #222', borderRadius: 8, background: 'transparent', color: '#666', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#555' },
  content: { padding: '28px', maxWidth: 900, margin: '0 auto' },
  statsRow: { display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 120, background: '#111', border: '1px solid #1e1e1e', borderRadius: 12,
    padding: '20px 16px', textAlign: 'center',
  },
  statValue: { display: 'block', fontSize: 32, fontWeight: 700, marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '20px', marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 12 },
  progressBg: { height: 8, background: '#1e1e1e', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, transition: 'width 0.6s ease' },
  warn: { fontSize: 12, color: '#f87171', marginTop: 8 },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  infoRow: { display: 'flex', gap: 12 },
  infoKey: { fontSize: 12, color: '#555', width: 80, flexShrink: 0 },
  infoVal: { fontSize: 13, color: '#ccc' },
  muted: { fontSize: 13, color: '#555' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#555', borderBottom: '1px solid #1e1e1e', textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { padding: '10px 10px', fontSize: 13, color: '#ccc', borderBottom: '1px solid #181818' },
  present: { display: 'inline-block', padding: '2px 8px', borderRadius: 20, background: '#0d2010', color: '#4ade80', fontSize: 11 },
};