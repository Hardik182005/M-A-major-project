import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getMe } from '../api';

export default function DashboardPage() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

    useEffect(() => {
        getMe()
            .then(res => setUser(res.data))
            .catch(() => navigate('/login'));
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        navigate('/');
    };

    if (!user) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: '#666' }}>
            Loading...
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: 'Inter, sans-serif' }}>
            <nav style={{
                background: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 32px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <Link to="/" style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: 'black', textDecoration: 'none' }}>
                    MergerMind<span style={{ fontWeight: 400, color: '#999' }}>AI</span>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 14, color: '#666' }}>Welcome, <strong style={{ color: 'black' }}>{user.name}</strong></span>
                    <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: 13 }}>
                        Logout
                    </button>
                </div>
            </nav>
            <div style={{ maxWidth: 800, margin: '60px auto', padding: '0 32px', textAlign: 'center' }}>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, marginBottom: 12, fontWeight: 600 }}>
                    Welcome to your Data Room
                </h1>
                <p style={{ color: '#666', fontSize: 16, marginBottom: 40 }}>
                    Dashboard with full features coming soon. You're successfully authenticated!
                </p>
                <div style={{
                    background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 32,
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, textAlign: 'left'
                }}>
                    <div><strong style={{ fontSize: 13, color: '#999' }}>NAME</strong><p style={{ fontSize: 16, marginTop: 4 }}>{user.name}</p></div>
                    <div><strong style={{ fontSize: 13, color: '#999' }}>EMAIL</strong><p style={{ fontSize: 16, marginTop: 4 }}>{user.email}</p></div>
                    <div><strong style={{ fontSize: 13, color: '#999' }}>USER ID</strong><p style={{ fontSize: 16, marginTop: 4 }}>#{user.id}</p></div>
                    <div><strong style={{ fontSize: 13, color: '#999' }}>STATUS</strong><p style={{ fontSize: 16, marginTop: 4, color: 'black' }}>✓ Active</p></div>
                </div>
            </div>
        </div>
    );
}
