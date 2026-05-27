import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Login() {
  const [tab, setTab] = useState('admin');
  const [form, setForm] = useState({ email: '', usn: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === 'admin') {
        const { data } = await api.post('/auth/admin/login', {
          email: form.email,
          password: form.password,
        });
        login(data.token, data.admin, 'admin');
        toast.success(`Welcome, ${data.admin.name}`);
        navigate('/admin');
      } else {
        const { data } = await api.post('/auth/student/login', {
          usn: form.usn,
          password: form.password,
        });
        login(data.token, data.student, 'student');
        toast.success(`Welcome, ${data.student.name}`);
        navigate('/student');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>
            <span style={styles.logoText}>Samsung</span>
            <span style={styles.logoSub}>Lab Attendance</span>
          </div>
        </div>

        <div style={styles.tabs}>
          {['admin', 'student'].map((t) => (
            <button
              key={t}
              style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
              onClick={() => setTab(t)}
            >
              {t === 'admin' ? 'Admin' : 'Student'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {tab === 'admin' ? (
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                style={styles.input}
                type="email"
                placeholder="admin@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
          ) : (
            <div style={styles.field}>
              <label style={styles.label}>USN</label>
              <input
                style={styles.input}
                type="text"
                placeholder="1RV21CS001"
                value={form.usn}
                onChange={(e) => setForm({ ...form, usn: e.target.value })}
                required
              />
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            {tab === 'student' && (
              <span style={styles.hint}>Default password is your USN</span>
            )}
          </div>

          <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0a0a0a', fontFamily: "'DM Sans', sans-serif",
  },
  card: {
    background: '#111', border: '1px solid #222', borderRadius: 16,
    width: 420, padding: '40px 36px',
  },
  header: { marginBottom: 32, textAlign: 'center' },
  logo: { display: 'flex', flexDirection: 'column', gap: 4 },
  logoText: { fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' },
  logoSub: { fontSize: 13, color: '#666', letterSpacing: 2, textTransform: 'uppercase' },
  tabs: {
    display: 'flex', background: '#1a1a1a', borderRadius: 10, padding: 4,
    marginBottom: 28, gap: 4,
  },
  tab: {
    flex: 1, padding: '9px 0', border: 'none', borderRadius: 8,
    background: 'transparent', color: '#666', fontSize: 14, cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif", fontWeight: 500, transition: 'all 0.2s',
  },
  tabActive: { background: '#1488fc', color: '#fff' },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: '#aaa', fontWeight: 500 },
  input: {
    padding: '11px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none',
    fontFamily: "'DM Sans', sans-serif", transition: 'border 0.2s',
  },
  hint: { fontSize: 12, color: '#555', marginTop: 2 },
  btn: {
    marginTop: 6, padding: '13px 0', background: '#1488fc', border: 'none',
    borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.2s',
  },
};