import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogoIcon } from '../components/Logo';
import api from '../api';
import './AuthPages.css';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setSent(true);
        } catch (err) {
            // Always show success to prevent email enumeration
            setSent(true);
        } finally {
            setLoading(false);
        }
    };

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
                        Secure Password Recovery
                    </h2>
                    <p className="auth-left-sub">
                        We'll send you a secure link to reset your password. Your data room remains protected.
                    </p>

                    <div className="auth-left-features">
                        <div className="auth-feature">
                            <span className="material-symbols-outlined">shield</span>
                            Encrypted reset tokens
                        </div>
                        <div className="auth-feature">
                            <span className="material-symbols-outlined">timer</span>
                            Link expires in 15 minutes
                        </div>
                        <div className="auth-feature">
                            <span className="material-symbols-outlined">history</span>
                            All resets are audit logged
                        </div>
                    </div>
                </div>
            </div>

            <div className="auth-right">
                <div className="auth-form-wrap animate-fade-in-up">
                    {!sent ? (
                        <>
                            <h2 className="auth-form-title">Forgot your password?</h2>
                            <p className="auth-form-subtitle">Enter your email and we'll send you a reset link</p>

                            {error && <div className="auth-error">{error}</div>}

                            <form onSubmit={handleSubmit} className="auth-form">
                                <div className="form-group">
                                    <label className="input-label">Email address</label>
                                    <input
                                        type="email"
                                        className="input"
                                        placeholder="you@company.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                                    {loading ? 'Sending...' : 'Send Reset Link'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="reset-success">
                            <div className="reset-success-icon">
                                <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--black)' }}>mark_email_read</span>
                            </div>
                            <h2 className="auth-form-title" style={{ textAlign: 'center' }}>Check your email</h2>
                            <p className="auth-form-subtitle" style={{ textAlign: 'center', maxWidth: 340 }}>
                                If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
                            </p>
                            <button
                                className="btn btn-outline"
                                style={{ width: '100%', marginTop: 16 }}
                                onClick={() => { setSent(false); setEmail(''); }}
                            >
                                Try a different email
                            </button>
                        </div>
                    )}

                    <p className="auth-switch" style={{ marginTop: 32 }}>
                        Remember your password? <Link to="/login">Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
