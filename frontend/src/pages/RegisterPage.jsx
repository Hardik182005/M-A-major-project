import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { register } from '../api';
import api from '../api';
import { LogoIcon } from '../components/Logo';
import GoogleIcon from '../components/GoogleIcon';
import './AuthPages.css';

const getStrength = (pw) => {
    if (!pw) return '';
    if (pw.length < 6) return 'weak';
    if (pw.length < 10 || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'medium';
    return 'strong';
};

export default function RegisterPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', password: '', company: '' });
    const [agreed, setAgreed] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const strength = getStrength(form.password);
    const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!agreed) { setError('Please agree to the Terms of Service'); return; }
        setError('');
        setLoading(true);
        try {
            await register(form.name, form.email, form.password);
            navigate('/login');
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const googleSignUp = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                setLoading(true);
                setError('');
                const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                }).then(r => r.json());

                const res = await api.post('/auth/google', {
                    credential: tokenResponse.access_token,
                    email: userInfo.email,
                    name: userInfo.name,
                });
                localStorage.setItem('access_token', res.data.access_token);
                navigate('/dashboard');
            } catch (err) {
                const detail = err.response?.data?.detail;
                setError(typeof detail === 'string' ? detail : 'Google sign-up failed. Please check configuration.');
            } finally {
                setLoading(false);
            }
        },
        onError: () => setError('Google sign-up was cancelled or failed'),
    });

    return (
        <div className="auth-page">
            <div className="auth-left">
                <div className="auth-left-content">
                    <Link to="/" className="auth-logo">
                        <LogoIcon size={40} color="white" />
                        <span className="font-display auth-logo-text">
                            MergerMind<span className="auth-logo-ai">AI</span>
                        </span>
                    </Link>

                    <h2 className="auth-left-heading font-display">
                        Start Your Due Diligence Journey
                    </h2>
                    <p className="auth-left-sub">
                        Create your secure data room in seconds. Upload, analyze, and decide — all powered by AI.
                    </p>
                </div>
            </div>

            <div className="auth-right">
                <div className="auth-form-wrap animate-fade-in-up">
                    <Link to="/" className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#71717A', textDecoration: 'none', marginBottom: '24px', fontSize: '14px', fontWeight: 500 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
                        Back to Home
                    </Link>
                    <h2 className="auth-form-title">Create your account</h2>
                    <p className="auth-form-subtitle">Join leading firms on MergerMindAI</p>

                    {error && <div className="auth-error">{error}</div>}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label className="input-label">Full Name</label>
                            <input type="text" className="input" placeholder="John Smith"
                                value={form.name} onChange={handleChange('name')} required />
                        </div>
                        <div className="form-group">
                            <label className="input-label">Work Email</label>
                            <input type="email" className="input" placeholder="you@company.com"
                                value={form.email} onChange={handleChange('email')} required />
                        </div>
                        <div className="form-group">
                            <label className="input-label">Password</label>
                            <div className="input-password-wrap">
                                <input type={showPassword ? 'text' : 'password'} className="input" placeholder="Min 8 characters"
                                    value={form.password} onChange={handleChange('password')} required minLength={6} />
                                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                                    <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                            {form.password && (
                                <div className="strength-wrap">
                                    <div className={`strength-bar strength-${strength}`} />
                                    <span className="strength-label">{strength}</span>
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label className="input-label">Company Name <span style={{ color: 'var(--gray-400)' }}>(optional)</span></label>
                            <input type="text" className="input" placeholder="Acme Capital"
                                value={form.company} onChange={handleChange('company')} />
                        </div>
                        <label className="checkbox-label" style={{ marginBottom: 16 }}>
                            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                            I agree to the <a href="#" style={{ textDecoration: 'underline' }}>Terms of Service</a> and <a href="#" style={{ textDecoration: 'underline' }}>Privacy Policy</a>
                        </label>
                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <div className="auth-divider"><span>or sign up with</span></div>

                    <button type="button" className="btn btn-outline google-btn" onClick={() => googleSignUp()} disabled={loading}>
                        <GoogleIcon size={18} />
                        Continue with Google
                    </button>

                    <p className="auth-switch">
                        Already have an account? <Link to="/login">Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
