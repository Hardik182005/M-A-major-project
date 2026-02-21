import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { BrandLogo } from '../components/Logo';
import './AuthPages.css';

export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Use regular useState for these inputs
    const [pwd, setPwd] = useState('');
    const [confirmPwd, setConfirmPwd] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!token) {
            setError('Invalid or missing reset token.');
            return;
        }
        if (pwd !== confirmPwd) {
            setError('Passwords do not match.');
            return;
        }
        if (pwd.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        try {
            setLoading(true);
            setError('');
            await api.post('/auth/reset-password', { token, new_password: pwd });
            setSuccess(true);
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : 'Failed to reset password. Token may have expired.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-left">
                <Link to="/" className="auth-brand">
                    <BrandLogo size={24} />
                </Link>
                <div className="auth-msg-wrap">
                    <div className="auth-msg-icon">
                        <span className="material-symbols-outlined">lock_reset</span>
                    </div>
                    <h2 className="auth-msg-title">Create New Password</h2>
                    <p className="auth-msg-subtitle">
                        Your new password must be at least 8 characters long. We recommend using a mix of letters, numbers, and symbols.
                    </p>
                </div>
            </div>

            <div className="auth-right">
                <div className="auth-card">
                    {success ? (
                        <div className="forgot-success">
                            <div className="forgot-success-icon">
                                <span className="material-symbols-outlined">check_circle</span>
                            </div>
                            <h2 className="auth-title">Password Reset!</h2>
                            <p className="auth-subtitle">
                                Your password has been successfully reset. You can now use your new password to log in.
                            </p>
                            <Link to="/login" className="btn btn-primary" style={{ width: '100%', marginTop: '24px' }}>
                                Back to Login
                            </Link>
                        </div>
                    ) : (
                        <>
                            <h2 className="auth-title">Set New Password</h2>
                            <p className="auth-subtitle">Enter your new password below.</p>

                            {error && <div className="auth-error">{error}</div>}
                            {(!token && !error) && <div className="auth-error">No reset token found in URL. Please use the link from your email.</div>}

                            <form onSubmit={handleSubmit} className="auth-form">
                                <div className="form-group">
                                    <label htmlFor="password">New Password</label>
                                    <input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={pwd}
                                        onChange={(e) => setPwd(e.target.value)}
                                        required
                                        minLength={8}
                                        disabled={loading || !token}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="confirmPassword">Confirm New Password</label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="••••••••"
                                        value={confirmPwd}
                                        onChange={(e) => setConfirmPwd(e.target.value)}
                                        required
                                        minLength={8}
                                        disabled={loading || !token}
                                    />
                                </div>

                                <button type="submit" className="btn btn-primary btn-block" disabled={loading || !token}>
                                    {loading ? 'Saving...' : 'Reset Password'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
