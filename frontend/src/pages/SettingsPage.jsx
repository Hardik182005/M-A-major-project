import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import api from '../api';
import './SettingsPage.css';

export default function SettingsPage() {
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);
    const [user, setUser] = useState({ name: '', email: '' });
    const [nameInput, setNameInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const { data } = await api.get('/auth/me');
                setUser(data);
                setNameInput(data.name);
            } catch (err) {
                console.error("Failed to fetch user data", err);
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, [navigate]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSuccessMsg('');

        try {
            const { data } = await api.put('/auth/me', { name: nameInput });
            setUser(data.user);
            setSuccessMsg('Profile updated successfully! Refreshing to apply changes...');

            // Reload the page after 1.5s to ensure AppLayout updates the name globally
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err) {
            console.error("Failed to update profile", err);
            alert("Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
                <div style={{ padding: '24px', color: '#666' }}>Loading Settings...</div>
            </AppLayout>
        );
    }

    return (
        <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
            <div className="settings-page fade-in">

                <div className="settings-header-banner">
                    <span className="material-symbols-outlined settings-banner-icon">person</span>
                    <div>
                        <h2>Account Settings</h2>
                        <p>Manage your profile, preferences, and account security</p>
                    </div>
                </div>

                <div className="settings-content">
                    <div className="settings-card">
                        <h3>Profile Information</h3>
                        <p className="settings-desc">Update your display name across MergerMind AI.</p>

                        {successMsg && (
                            <div className="settings-success">
                                <span className="material-symbols-outlined">check_circle</span>
                                {successMsg}
                            </div>
                        )}

                        <form onSubmit={handleSave} className="settings-form">
                            <div className="form-group">
                                <label>Email Address</label>
                                <input
                                    type="text"
                                    value={user.email}
                                    disabled
                                    className="input-disabled"
                                />
                                <span className="form-hint">Email address cannot be changed.</span>
                            </div>

                            <div className="form-group">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    maxLength={50}
                                    required
                                />
                            </div>

                            <div className="form-actions">
                                <button
                                    type="submit"
                                    className="btn-save btn-primary"
                                    disabled={saving || nameInput === user.name}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="settings-card">
                        <h3>General Preferences</h3>
                        <p className="settings-desc">Manage your workspace preferences.</p>

                        <div className="preference-item">
                            <div>
                                <strong>Dark Mode</strong>
                                <p>Enable dark mode for the entire application.</p>
                            </div>
                            <div className="toggle-switch-disabled">Coming Soon</div>
                        </div>

                        <div className="preference-item">
                            <div>
                                <strong>Email Notifications</strong>
                                <p>Receive alerts when AI analysis is complete.</p>
                            </div>
                            <div className="toggle-switch-disabled">Coming Soon</div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
