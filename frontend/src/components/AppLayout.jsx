import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BrandLogo } from './Logo';
import api from '../api';
import './AppLayout.css';

export default function AppLayout({ children, selectedProject, onSelectProject }) {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        // Determine auth status and fetch initial data
        const fetchInit = async () => {
            try {
                const { data: userData } = await api.get('/auth/me');
                setUser(userData);

                let projResponse;
                try {
                    projResponse = await api.get('/projects');
                } catch (err) {
                    projResponse = { data: [] };
                }

                const projs = projResponse.data;
                if (projs.length === 0) {
                    // Need to create a demo project if none exists so the dashboard has something
                    const res = await api.post('/projects', {
                        name: "Acme Corp Acquisition",
                        description: "Demo project"
                    });
                    const newProj = { id: res.data.project_id, name: res.data.name };
                    setProjects([newProj]);
                    if (!selectedProject) onSelectProject(newProj);
                } else {
                    setProjects(projs);
                    if (!selectedProject) {
                        onSelectProject(projs[0]);
                    }
                }
            } catch (err) {
                navigate('/login');
            }
        };
        fetchInit();
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        navigate('/login');
    };

    if (!user) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: '#666' }}>Loading...</div>;
    }

    const navItems = [
        { to: "/dashboard", icon: "dashboard", label: "Dashboard" },
        { to: "/documents", icon: "folder", label: "Documents" },
        { to: "/analysis", icon: "assignment_late", label: "Analysis" },
        { to: "/processing", icon: "settings_suggest", label: "Processing" },
        { to: "/reports", icon: "bar_chart", label: "Reports" },
        { to: "/audit", icon: "history", label: "Audit Trail" },
        { to: "/ai-assistant", icon: "smart_toy", label: "AI Assistant" },
        { to: "/insights", icon: "newspaper", label: "M&A News" },
    ];

    return (
        <div className="app-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <BrandLogo variant="light" size={24} />
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="material-symbols-outlined">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div style={{ padding: '0 24px 24px 24px' }}>
                        <button
                            onClick={async () => {
                                const newName = window.prompt("Enter new project name:");
                                if (newName && newName.trim()) {
                                    try {
                                        const res = await api.post('/projects', {
                                            name: newName.trim(),
                                            description: "New project created by user"
                                        });
                                        const newProj = { id: res.data.project_id, name: res.data.name };
                                        setProjects([...projects, newProj]);
                                        onSelectProject(newProj);
                                        navigate('/dashboard');
                                    } catch (err) {
                                        alert("Failed to create project.");
                                    }
                                }
                            }}
                            style={{ width: '100%', background: 'transparent', border: '1px solid #3F3F46', color: 'white', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'background 0.2s' }}
                            onMouseOver={(e) => e.target.style.background = '#27272A'}
                            onMouseOut={(e) => e.target.style.background = 'transparent'}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                            NEW PROJECT
                        </button>
                    </div>

                    <div className="user-profile" onClick={handleLogout} title="Click to logout">
                        <div className="user-avatar">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-info">
                            <div className="user-name">{user.name}</div>
                            <div className="user-role">Principal Partner</div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <div className="main-wrapper">
                <header className="topbar">
                    <div className="topbar-left">
                        <select
                            className="project-selector"
                            value={selectedProject ? selectedProject.id : ''}
                            onChange={(e) => {
                                const p = projects.find(x => x.id === parseInt(e.target.value));
                                if (p) onSelectProject(p);
                            }}
                        >
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="topbar-center">
                        <div className="search-input-wrapper">
                            <span className="material-symbols-outlined">search</span>
                            <input type="text" placeholder="Global search across 142 documents..." />
                        </div>
                    </div>

                    <div className="topbar-right">
                        <button className="btn-icon">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>

                        <div style={{ position: 'relative' }}>
                            <div
                                className="user-avatar"
                                style={{ width: 32, height: 32, fontSize: 13, background: '#1D4ED8', cursor: 'pointer' }}
                                onClick={() => document.getElementById('settings-dropdown')?.classList.toggle('show')}
                            >
                                {user.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().substring(0, 2)}
                            </div>

                            {/* Settings Dropdown */}
                            <div id="settings-dropdown" className="settings-dropdown">
                                <div className="settings-header">
                                    <strong>{user.name}</strong>
                                    <span>{user.email || 'user@mergermind.ai'}</span>
                                </div>
                                <div className="settings-menu-items">
                                    <button onClick={() => navigate('/settings')}>
                                        <span className="material-symbols-outlined">person</span> Profile Settings
                                    </button>
                                    <button onClick={() => navigate('/settings/preferences')}>
                                        <span className="material-symbols-outlined">tune</span> Preferences
                                    </button>
                                    <button onClick={() => navigate('/settings/billing')}>
                                        <span className="material-symbols-outlined">credit_card</span> Billing
                                    </button>
                                    <div className="settings-divider"></div>
                                    <button onClick={handleLogout} className="logout-btn-dropdown">
                                        <span className="material-symbols-outlined">logout</span> Log Out
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="main-content">
                    {children}
                </main>
            </div>

        </div>
    );
}
