import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { login } from '../api';
import api from '../api';
import { LogoIcon } from '../components/Logo';
import GoogleIcon from '../components/GoogleIcon';
import './AuthPages.css';

export default function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await login(email, password);
            localStorage.setItem('access_token', res.data.access_token);
            navigate('/dashboard');
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                setLoading(true);
                setError('');
                // Get user info from Google
                const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                }).then(r => r.json());

                // Send to our backend
                const res = await api.post('/auth/google', {
                    credential: tokenResponse.access_token,
                    email: userInfo.email,
                    name: userInfo.name,
                });
                localStorage.setItem('access_token', res.data.access_token);
                navigate('/dashboard');
            } catch (err) {
                const detail = err.response?.data?.detail;
                setError(typeof detail === 'string' ? detail : 'Google sign-in failed. Please check configuration.');
            } finally {
                setLoading(false);
            }
        },
        onError: () => setError('Google sign-in was cancelled or failed'),
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
                        AI-Powered Due Diligence Intelligence
                    </h2>
                    <p className="auth-left-sub">
                        Analyze thousands of documents. Detect risks in seconds. Make confident acquisition decisions.
                    </p>
                </div>
            </div>

            <div className="auth-right">
                <div className="auth-form-wrap animate-fade-in-up">
                    <Link to="/" className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#71717A', textDecoration: 'none', marginBottom: '24px', fontSize: '14px', fontWeight: 500 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
                        Back to Home
                    </Link>
                    <h2 className="auth-form-title">Welcome back</h2>
                    <p className="auth-form-subtitle">Sign in to your data room</p>

                    {error && <div className="auth-error">{error}</div>}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label className="input-label">Email</label>
                            <input
                                type="email" className="input" placeholder="you@company.com"
                                value={email} onChange={e => setEmail(e.target.value)} required
                            />
                        </div>
                        <div className="form-group">
                            <label className="input-label">Password</label>
                            <div className="input-password-wrap">
                                <input
                                    type={showPassword ? 'text' : 'password'} className="input" placeholder="••••••••"
                                    value={password} onChange={e => setPassword(e.target.value)} required
                                />
                                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                                    <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                        </div>
                        <div className="form-row">
                            <label className="checkbox-label"><input type="checkbox" /> Remember me</label>
                            <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
                        </div>
                        <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="auth-divider"><span>or continue with</span></div>

                    <button type="button" className="btn btn-outline google-btn" onClick={() => googleLogin()} disabled={loading}>
                        <GoogleIcon size={18} />
                        Sign in with Google
                    </button>

                    <p className="auth-switch">
                        Don't have an account? <Link to="/register">Sign Up</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
