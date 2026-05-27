import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Login() {
  const [page, setPage] = useState('login'); // 'login', 'register', 'forgot', 'otp'
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [reg, setReg] = useState({ usn: '', name: '', email: '', phone: '', department: '', password: '', confirm: '' });

  // Forgot password state
  const [forgotUsn, setForgotUsn] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { identifier, password });
      login(data.token, data.user, data.role);
      toast.success(`Welcome, ${data.user.name}`);
      navigate(data.role === 'admin' ? '/admin' : '/student');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (reg.password !== reg.confirm) return toast.error('Passwords do not match');
    if (reg.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        usn: reg.usn, name: reg.name, email: reg.email,
        phone: reg.phone, department: reg.department, password: reg.password,
      });
      login(data.token, data.user, data.role);
      toast.success('Account created!');
      navigate('/student');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { usn: forgotUsn });
      setMaskedEmail(data.email);
      toast.success(data.message);
      setPage('otp');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (newPass !== confirmPass) return toast.error('Passwords do not match');
    if (newPass.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { usn: forgotUsn, otp, newPassword: newPass });
      toast.success(data.message);
      setPage('login');
      setForgotUsn(''); setOtp(''); setNewPass(''); setConfirmPass('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={st.page}>
      <div style={st.blob1} />
      <div style={st.blob2} />

      <div style={st.card}>
        <div style={st.logoWrap}>
          <div style={st.logoIcon}>S</div>
          <h1 style={st.title}>Samsung Lab</h1>
          <p style={st.subtitle}>Attendance System</p>
        </div>

        {/* ─── LOGIN ─── */}
        {page === 'login' && (
          <form onSubmit={handleLogin} style={st.form}>
            <div style={st.field}>
              <label style={st.label}>Email or USN</label>
              <input style={st.input} type="text" placeholder="admin@samsung.com or 1RV21CS001" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
            </div>
            <div style={st.field}>
              <label style={st.label}>Password</label>
              <input style={st.input} type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button style={{ ...st.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? <span style={st.spinner} /> : 'Sign in'}
            </button>
            <div style={st.links}>
              <button type="button" style={st.link} onClick={() => setPage('register')}>Create Account</button>
              <button type="button" style={st.link} onClick={() => setPage('forgot')}>Forgot Password?</button>
            </div>
          </form>
        )}

        {/* ─── REGISTER ─── */}
        {page === 'register' && (
          <form onSubmit={handleRegister} style={st.form}>
            <h2 style={st.formTitle}>Create Account</h2>
            <p style={st.formSub}>Only shortlisted students can register</p>
            <div style={st.field}>
              <label style={st.label}>USN *</label>
              <input style={st.input} type="text" placeholder="1RV21CS001" value={reg.usn} onChange={(e) => setReg({ ...reg, usn: e.target.value })} required />
            </div>
            <div style={st.field}>
              <label style={st.label}>Full Name *</label>
              <input style={st.input} type="text" placeholder="Your full name" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} required />
            </div>
            <div style={st.field}>
              <label style={st.label}>Email *</label>
              <input style={st.input} type="email" placeholder="your@email.com" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} required />
            </div>
            <div style={st.field}>
              <label style={st.label}>Department</label>
              <input style={st.input} type="text" placeholder="e.g. Computer Science" value={reg.department} onChange={(e) => setReg({ ...reg, department: e.target.value })} />
            </div>
            <div style={st.field}>
              <label style={st.label}>Phone (optional)</label>
              <input style={st.input} type="text" placeholder="9876543210" value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} />
            </div>
            <div style={st.field}>
              <label style={st.label}>Password *</label>
              <input style={st.input} type="password" placeholder="Min 6 characters" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} required />
            </div>
            <div style={st.field}>
              <label style={st.label}>Confirm Password *</label>
              <input style={st.input} type="password" placeholder="Re-enter password" value={reg.confirm} onChange={(e) => setReg({ ...reg, confirm: e.target.value })} required />
            </div>
            <button style={{ ...st.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? <span style={st.spinner} /> : 'Create Account'}
            </button>
            <div style={st.links}>
              <button type="button" style={st.link} onClick={() => setPage('login')}>← Back to Login</button>
            </div>
          </form>
        )}

        {/* ─── FORGOT PASSWORD ─── */}
        {page === 'forgot' && (
          <form onSubmit={handleForgot} style={st.form}>
            <h2 style={st.formTitle}>Forgot Password</h2>
            <p style={st.formSub}>Enter your USN and we'll send an OTP to your registered email</p>
            <div style={st.field}>
              <label style={st.label}>USN</label>
              <input style={st.input} type="text" placeholder="1RV21CS001" value={forgotUsn} onChange={(e) => setForgotUsn(e.target.value)} required autoFocus />
            </div>
            <button style={{ ...st.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? <span style={st.spinner} /> : 'Send OTP'}
            </button>
            <div style={st.links}>
              <button type="button" style={st.link} onClick={() => setPage('login')}>← Back to Login</button>
            </div>
          </form>
        )}

        {/* ─── VERIFY OTP ─── */}
        {page === 'otp' && (
          <form onSubmit={handleVerifyOtp} style={st.form}>
            <h2 style={st.formTitle}>Verify OTP</h2>
            <p style={st.formSub}>OTP sent to {maskedEmail}</p>
            <div style={st.field}>
              <label style={st.label}>Enter OTP</label>
              <input style={{ ...st.input, fontSize: 22, letterSpacing: 8, textAlign: 'center' }} type="text" placeholder="000000" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required autoFocus />
            </div>
            <div style={st.field}>
              <label style={st.label}>New Password</label>
              <input style={st.input} type="password" placeholder="Min 6 characters" value={newPass} onChange={(e) => setNewPass(e.target.value)} required />
            </div>
            <div style={st.field}>
              <label style={st.label}>Confirm New Password</label>
              <input style={st.input} type="password" placeholder="Re-enter password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} required />
            </div>
            <button style={{ ...st.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? <span style={st.spinner} /> : 'Reset Password'}
            </button>
            <div style={st.links}>
              <button type="button" style={st.link} onClick={() => setPage('forgot')}>← Resend OTP</button>
              <button type="button" style={st.link} onClick={() => setPage('login')}>Back to Login</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const st = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#050505', fontFamily: "'Inter','DM Sans',-apple-system,sans-serif",
    position: 'relative', overflow: 'hidden',
  },
  blob1: { position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,136,252,0.08) 0%, transparent 70%)', top: -150, right: -100 },
  blob2: { position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', bottom: -100, left: -100 },
  card: {
    position: 'relative', background: 'rgba(17,17,17,0.85)', backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24,
    width: 420, maxHeight: '90vh', overflowY: 'auto', padding: '44px 38px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
  },
  logoWrap: { textAlign: 'center', marginBottom: 28 },
  logoIcon: {
    width: 48, height: 48, borderRadius: 14,
    background: 'linear-gradient(135deg, #1488fc, #6366f1)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.5px' },
  subtitle: { fontSize: 12, color: '#666', marginTop: 5, letterSpacing: 1, textTransform: 'uppercase' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  formTitle: { fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 },
  formSub: { fontSize: 12, color: '#666', margin: '-4px 0 4px' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, color: '#888', fontWeight: 500 },
  input: {
    padding: '13px 16px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
    color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit', transition: 'border 0.2s',
  },
  btn: {
    marginTop: 6, padding: '14px 0',
    background: 'linear-gradient(135deg, #1488fc, #6366f1)',
    border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 4px 20px rgba(20,136,252,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  spinner: {
    width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  },
  links: { display: 'flex', justifyContent: 'center', gap: 16, marginTop: 4 },
  link: {
    background: 'none', border: 'none', color: '#1488fc', fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },
};
