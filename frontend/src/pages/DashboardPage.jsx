import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import api from '../api';
import './DashboardPage.css';

export default function DashboardPage() {
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);
    const [summary, setSummary] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [pipeline, setPipeline] = useState(null);
    const [loading, setLoading] = useState(true);

    // Mock Audit Trail Activity since we aren't fetching the real audit endpoint yet
    const recentActivity = [
        { id: 1, action: "Upload", icon: "description", text: "12 new legal contracts uploaded", user: "Sarah Chen", time: "14 minutes ago", verb: "Uploaded by" },
        { id: 2, action: "Analysis", icon: "auto_awesome", text: "AI completed analysis on Employment Agreements", user: "4 critical risks identified", time: "1 hour ago", verb: "" },
        { id: 3, action: "Member", icon: "person_add", text: "Marcus Wright joined the acquisition team", user: "Role: Financial Auditor", time: "3 hours ago", verb: "" },
        { id: 4, action: "Security", icon: "warning", text: "Security Alert: External login attempt blocked", user: "Audit log updated", time: "5 hours ago", verb: "" }
    ];

    useEffect(() => {
        if (!selectedProject) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [sumRes, metRes, pipRes] = await Promise.all([
                    api.get(`/projects/${selectedProject.id}/analysis/summary`).catch(() => ({ data: null })),
                    api.get(`/projects/${selectedProject.id}/metrics`).catch(() => ({ data: null })),
                    api.get(`/projects/${selectedProject.id}/processing/status`).catch(() => ({ data: null })),
                ]);

                if (sumRes.data) setSummary(sumRes.data);
                if (metRes.data) setMetrics(metRes.data);
                if (pipRes.data) setPipeline(pipRes.data);
            } catch (err) {
                console.error("Failed to load dashboard data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // Setup polling for pipeline
        const interval = setInterval(() => {
            api.get(`/projects/${selectedProject.id}/processing/status`)
                .then(res => setPipeline(res.data))
                .catch(() => { });
        }, 10000);

        return () => clearInterval(interval);
    }, [selectedProject]);

    const getVerdictColor = (score) => {
        if (score >= 80) return '#DC2626'; // Red (High Risk)
        if (score >= 40) return '#D97706'; // Orange (Proceed With Caution)
        return '#10B981'; // Green (Safe)
    };

    const formatPercent = (val) => `${Math.round(val * 100)}%`;

    return (
        <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
            {loading || !metrics ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#A1A1AA' }}>
                    Loading AI Dashboard...
                </div>
            ) : (
                <div className="dashboard-grid fade-in">
                    {/* Top Section: AI Verdict */}
                    <div className="card verdict-card">
                        <div className="verdict-donut" style={{ borderColor: getVerdictColor(summary?.risk_score) }}>
                            <h2>{summary?.risk_score || 0}</h2>
                            <span>/ 100 RISK</span>
                        </div>
                        <div className="verdict-info">
                            <div className="verdict-header">
                                <h3>AI Verdict</h3>
                                <span className={summary?.risk_score > 50 ? 'badge-warning' : 'badge-neutral'}>
                                    {summary?.verdict ? summary.verdict.replace(/_/g, ' ') : 'PENDING'}
                                </span>
                            </div>
                            <p className="verdict-desc">{summary?.explanation || 'AI analysis pending on uploaded documents.'}</p>
                            <div className="highlights-row">
                                {summary?.highlights?.map((h, i) => (
                                    <div className="highlight-item" key={i}>
                                        <span className="material-symbols-outlined">
                                            {h.type === 'LEGAL' ? 'gavel' : 'request_quote'}
                                        </span>
                                        {h.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="verdict-cta">
                            <button className="verdict-action" onClick={() => navigate('/findings')}>
                                View Detailed Analysis
                            </button>
                        </div>
                    </div>

                    {/* KPI Tiles */}
                    <div className="kpi-row">
                        <div className="card kpi-card">
                            <div className="kpi-header">
                                <span className="material-symbols-outlined">folder</span>
                                <span className="kpi-badge" style={{ color: '#71717A' }}>+{metrics.docs_uploaded_today} today</span>
                            </div>
                            <div className="kpi-title">Total Documents</div>
                            <div className="kpi-value">{metrics.total_docs}</div>
                        </div>

                        <div className="card kpi-card">
                            <div className="kpi-header">
                                <span className="material-symbols-outlined" style={{ color: '#2563EB' }}>data_usage</span>
                                <span className="kpi-badge" style={{ color: '#2563EB' }}>{(metrics.processed_docs / metrics.total_docs * 100).toFixed(1)}%</span>
                            </div>
                            <div className="kpi-title">Processed</div>
                            <div className="kpi-value">{metrics.processed_docs}<small>/{metrics.total_docs}</small></div>
                        </div>

                        <div className="card kpi-card">
                            <div className="kpi-header">
                                <span className="material-symbols-outlined" style={{ color: '#DC2626' }}>error</span>
                                <span className="kpi-badge" style={{ color: '#DC2626' }}>{metrics.risk_level} Risk</span>
                            </div>
                            <div className="kpi-title">Flagged Risks</div>
                            <div className="kpi-value">{metrics.flagged_risks}</div>
                        </div>

                        <div className="card kpi-card">
                            <div className="kpi-header">
                                <span className="material-symbols-outlined" style={{ color: '#71717A' }}>description</span>
                                <span className="kpi-badge" style={{ color: '#71717A' }}>{metrics.latest_report_status.replace(/_/g, ' ')}</span>
                            </div>
                            <div className="kpi-title">Reports Generated</div>
                            <div className="kpi-value">{metrics.reports_generated}</div>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="card">
                        <div className="section-header">
                            <h3>Recent Activity</h3>
                            <Link to="/audit" className="section-link">See all activity</Link>
                        </div>
                        <div className="activity-list">
                            {recentActivity.map(item => (
                                <div className="activity-item" key={item.id}>
                                    <div className="activity-icon">
                                        <span className="material-symbols-outlined">{item.icon}</span>
                                    </div>
                                    <div className="activity-content">
                                        <div className="activity-title">{item.text}</div>
                                        <div className="activity-meta">
                                            {item.verb && `${item.verb} `}<span style={{ color: '#3B82F6', fontWeight: 500 }}>{item.user}</span> • {item.time}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Processing Pipeline */}
                    <div className="card">
                        <div className="section-header">
                            <h3>Processing Pipeline</h3>
                        </div>
                        {pipeline ? (
                            <div className="pipeline-list">
                                {Object.entries(pipeline.stages).map(([stage, pct]) => (
                                    <div className="pipeline-item" key={stage}>
                                        <div className="pipeline-info">
                                            <span>{stage.replace(/_/g, ' ')}</span>
                                            <span>{formatPercent(pct)}</span>
                                        </div>
                                        <div className="pipeline-bar-bg">
                                            <div
                                                className={`pipeline-bar-fill ${pct === 1 ? 'complete' : ''}`}
                                                style={{ width: formatPercent(pct) }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <div className="pipeline-status">
                                    CURRENT STEP: {pipeline.current.message.toUpperCase()}
                                </div>
                            </div>
                        ) : (
                            <div style={{ color: '#A1A1AA', fontSize: 14 }}>No active pipelines...</div>
                        )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="dashboard-actions">
                        <button className="action-btn action-btn-primary" onClick={() => navigate('/documents')}>
                            <span className="material-symbols-outlined">upload_file</span>
                            Upload Documents
                        </button>
                        <button className="action-btn" onClick={() => alert('Report Generation Triggered')}>
                            <span className="material-symbols-outlined">summarize</span>
                            Generate Report
                        </button>
                        <button className="action-btn" onClick={() => navigate('/ai-assistant')}>
                            <span className="material-symbols-outlined">smart_toy</span>
                            Ask AI Assistant
                        </button>
                    </div>

                </div>
            )}
        </AppLayout>
    );
}
