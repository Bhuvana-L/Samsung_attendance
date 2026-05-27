import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

const LAB_LABELS = { iot: 'Samsung IoT', coding: 'Samsung Coding' };

export default function StudentDashboard() {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', department: '' });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user?.usn) fetchMyAttendance(); }, [user]);

  const fetchMyAttendance = async () => {
    try {
      const { data: res } = await api.get(`/attendance/student/${user.usn}`);
      setData(res);
      setEditForm({ name: res.student.name, email: res.student.email || '', phone: res.student.phone || '', department: res.student.department || '' });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data: res } = await api.put('/student/profile', editForm);
      toast.success('Profile updated');
      login(localStorage.getItem('token'), res.user, 'student');
      setShowEdit(false);
      fetchMyAttendance();
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (passForm.newPassword !== passForm.confirmPassword) return toast.error('Passwords do not match');
    if (passForm.newPassword.length < 6) return toast.error('Min 6 characters');
    setSaving(true);
    try {
      await api.put('/student/change-password', { currentPassword: passForm.currentPassword, newPassword: passForm.newPassword });
      toast.success('Password changed');
      setShowPassword(false);
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const pct = data?.stats?.percentage ?? 0;
  const color = pct >= 75 ? '#4ade80' : pct >= 50 ? '#facc15' : '#f87171';

  return (
    <div style={s.page}>
      <div style={s.blob1} />
      <div style={s.blob2} />

      {/* Top bar */}
      <div style={s.topbar}>
        <div style={s.topLeft}>
          <div style={s.brandDot} />
          <span style={s.brand}>Samsung Lab</span>
          <span style={s.labTag}>{LAB_LABELS[user?.lab] || ''}</span>
        </div>
        <div style={s.topRight}>
          <span style={s.userName}>{user?.name}</span>
          <button style={s.logoutBtn} onClick={() => { logout(); navigate('/'); }}>Sign out</button>
        </div>
      </div>

      {loading ? (
        <div style={s.center}>Loading...</div>
      ) : !data ? (
        <div style={s.center}>Could not load data</div>
      ) : (
        <div style={s.content}>
          {/* Welcome */}
          <div style={s.welcomeCard}>
            <h1 style={s.welcomeTitle}>Hello, {data.student.name}!</h1>
            <p style={s.welcomeSub}>{LAB_LABELS[data.student.lab]} attendance overview</p>
          </div>

          {/* Stats */}
          <div style={s.statsRow}>
            {[
              { value: `${pct}%`, label: 'Attendance', c: color },
              { value: data.stats.present, label: 'Present', c: '#4ade80' },
              { value: data.stats.absent, label: 'Absent', c: '#f87171' },
              { value: data.stats.totalSessions, label: 'Total', c: '#60a5fa' },
            ].map((st, i) => (
              <div key={i} style={s.statCard}>
                <span style={{ ...s.statValue, color: st.c }}>{st.value}</span>
                <span style={s.statLabel}>{st.label}</span>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={s.cardTitle}>Progress</span>
              <span style={{ fontSize: 14, fontWeight: 600, color }}>{pct}%</span>
            </div>
            <div style={s.progressBg}>
              <div style={{ ...s.progressFill, width: `${pct}%`, background: color }} />
            </div>
            {pct < 75 && <p style={s.warn}>Below 75% — attend more sessions.</p>}
          </div>

          {/* My Details + Actions */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={s.cardTitle}>My Details</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.editBtn} onClick={() => setShowEdit(true)}>✎ Edit Profile</button>
                <button style={s.passBtn} onClick={() => setShowPassword(true)}>🔒 Change Password</button>
              </div>
            </div>
            <div style={s.infoGrid}>
              {[['USN', data.student.usn], ['Name', data.student.name], ['Lab', LAB_LABELS[data.student.lab]], ['Email', data.student.email || '—'], ['Phone', data.student.phone || '—'], ['Department', data.student.department || '—']].map(([k, v]) => (
                <div key={k} style={s.infoRow}>
                  <span style={s.infoKey}>{k}</span>
                  <span style={s.infoVal}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Session history */}
          <div style={s.card}>
            <h3 style={s.cardTitle}>Session History</h3>
            {data.logs.length === 0 ? (
              <p style={s.muted}>No records yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>
                    {['Session', 'Date', 'Time', 'Status'].map((h) => <th key={h} style={s.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {data.logs.map((log, i) => (
                      <tr key={i}>
                        <td style={s.td}>{log.session?.title || '—'}</td>
                        <td style={s.td}>{log.session?.date || new Date(log.timestamp).toLocaleDateString()}</td>
                        <td style={s.td}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td style={s.td}><span style={s.present}>Present</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEdit && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>Edit Profile</h3>
            {[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'email', label: 'Email', type: 'email' },
              { key: 'phone', label: 'Phone', type: 'text' },
              { key: 'department', label: 'Department', type: 'text' },
            ].map((f) => (
              <div key={f.key} style={s.modalField}>
                <label style={s.modalLabel}>{f.label}</label>
                <input style={s.modalInput} type={f.type} value={editForm[f.key]}
                  onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })} />
              </div>
            ))}
            <div style={s.modalActions}>
              <button style={s.saveBtn} onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              <button style={s.cancelBtn} onClick={() => setShowEdit(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPassword && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>Change Password</h3>
            <div style={s.modalField}>
              <label style={s.modalLabel}>Current Password</label>
              <input style={s.modalInput} type="password" value={passForm.currentPassword}
                onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })} />
            </div>
            <div style={s.modalField}>
              <label style={s.modalLabel}>New Password</label>
              <input style={s.modalInput} type="password" placeholder="Min 6 characters" value={passForm.newPassword}
                onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })} />
            </div>
            <div style={s.modalField}>
              <label style={s.modalLabel}>Confirm New Password</label>
              <input style={s.modalInput} type="password" value={passForm.confirmPassword}
                onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })} />
            </div>
            <div style={s.modalActions}>
              <button style={s.saveBtn} onClick={changePassword} disabled={saving}>{saving ? 'Saving...' : 'Change Password'}</button>
              <button style={s.cancelBtn} onClick={() => setShowPassword(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#050505', fontFamily: "'Inter','DM Sans',sans-serif", color: '#e0e0e0', position: 'relative', overflow: 'hidden' },
  blob1: { position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(74,222,128,0.04) 0%, transparent 70%)', top: -150, right: -100 },
  blob2: { position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.04) 0%, transparent 70%)', bottom: -100, left: -100 },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', position: 'relative', zIndex: 1, borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: 8 },
  topLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  topRight: { display: 'flex', alignItems: 'center', gap: 12 },
  brandDot: { width: 10, height: 10, borderRadius: '50%', background: 'linear-gradient(135deg, #4ade80, #60a5fa)' },
  brand: { fontSize: 15, fontWeight: 700, color: '#fff' },
  labTag: { fontSize: 11, background: 'rgba(20,136,252,0.15)', color: '#7ec8ff', padding: '3px 10px', borderRadius: 20 },
  userName: { fontSize: 13, color: '#666', display: 'none' },
  logoutBtn: { padding: '7px 14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#555' },
  content: { padding: '20px', maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 1 },
  welcomeCard: { marginBottom: 20 },
  welcomeTitle: { fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' },
  welcomeSub: { fontSize: 13, color: '#666', marginTop: 4 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 16 },
  statCard: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '18px 12px', textAlign: 'center' },
  statValue: { display: 'block', fontSize: 26, fontWeight: 700, marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '18px', marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 10 },
  progressBg: { height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, transition: 'width 0.8s ease' },
  warn: { fontSize: 12, color: '#f87171', marginTop: 8 },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  infoRow: { display: 'flex', gap: 10 },
  infoKey: { fontSize: 12, color: '#555', width: 80, flexShrink: 0 },
  infoVal: { fontSize: 13, color: '#ccc' },
  muted: { fontSize: 13, color: '#555' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 400 },
  th: { padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#555', borderBottom: '1px solid rgba(255,255,255,0.05)', textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { padding: '10px 10px', fontSize: 13, color: '#ccc', borderBottom: '1px solid rgba(255,255,255,0.03)' },
  present: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontSize: 11 },

  // Buttons
  editBtn: { padding: '6px 14px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 8, color: '#60a5fa', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  passBtn: { padding: '6px 14px', background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 8, color: '#facc15', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },

  // Modal
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modal: { background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 380, maxHeight: '85vh', overflowY: 'auto' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 18 },
  modalField: { marginBottom: 14 },
  modalLabel: { fontSize: 12, color: '#888', marginBottom: 5, display: 'block' },
  modalInput: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  modalActions: { display: 'flex', gap: 10, marginTop: 18 },
  saveBtn: { flex: 1, padding: '12px 0', background: 'linear-gradient(135deg, #1488fc, #6366f1)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn: { padding: '12px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#888', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
};
