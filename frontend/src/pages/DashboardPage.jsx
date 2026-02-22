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

    // Fetch real data when project is selected
    useEffect(() => {
        if (!selectedProject) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const [sumRes, metRes, pipeRes] = await Promise.all([
                    api.get(`/projects/${selectedProject.id}/analysis/summary`).catch(() => ({ data: null })),
                    api.get(`/projects/${selectedProject.id}/metrics`).catch(() => ({ data: null })),
                    api.get(`/projects/${selectedProject.id}/processing/status`).catch(() => ({ data: null })),
                ]);

                if (sumRes.data) setSummary(sumRes.data);
                if (metRes.data) setMetrics(metRes.data);
                if (pipeRes.data) setPipeline(pipeRes.data);
            } catch (err) {
                console.error("Failed to load dashboard data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedProject]);

    // Setup polling for pipeline status
    useEffect(() => {
        if (!selectedProject) return;

        const interval = setInterval(() => {
            api.get(`/projects/${selectedProject.id}/processing/status`)
                .then(res => setPipeline(res.data))
                .catch(() => { });
        }, 10000);

        return () => clearInterval(interval);
    }, [selectedProject]);

    const getVerdictColor = (score) => {
        if (!score) return '#10B981';
        if (score >= 80) return '#DC2626';
        if (score >= 60) return '#D97706';
        if (score >= 40) return '#F0AD40';
        return '#10B981';
    };

    const formatPercent = (val) => `${Math.round(val * 100)}%`;

    // Show project selection prompt if no project selected
    if (!selectedProject) {
        return (
            <AppLayout selectedProject={null} onSelectProject={setSelectedProject}>
                <div className="no-project-selected">
                    <span className="material-symbols-outlined">dashboard</span>
                    <h2>Select a Project</h2>
                    <p>Choose a project from the sidebar to view the AI Dashboard</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
            {loading ? (
                <div className="loading-container">
                    <span className="material-symbols-outlined spinning">progress_activity</span>
                    <p>Loading AI Dashboard...</p>
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
                            <p className="verdict-desc">
                                {summary?.explanation || 'AI analysis pending on uploaded documents.'}
                            </p>
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
                    </div>

                    {/* Metrics Grid */}
                    <div className="kpi-row">
                        <div className="card kpi-card">
                            <div className="kpi-header">
                                <span className="material-symbols-outlined">folder</span>
                                <span className="kpi-badge">+{metrics?.today_docs || 0} today</span>
                            </div>
                            <div className="kpi-title">Total Documents</div>
                            <div className="kpi-value">{metrics?.total_docs || 0}</div>
                        </div>
                        <div className="card kpi-card">
                            <div className="kpi-header">
                                <span className="material-symbols-outlined">data_usage</span>
                                <span className="kpi-badge" style={{ color: '#2563EB' }}>{metrics?.total_docs ? formatPercent((metrics?.processed_docs || 0) / metrics.total_docs) : '0%'}</span>
                            </div>
                            <div className="kpi-title">Processed</div>
                            <div className="kpi-value">{metrics?.processed_docs || 0}<small>/{metrics?.total_docs || 0}</small></div>
                        </div>
                        <div className="card kpi-card">
                            <div className="kpi-header">
                                <span className="material-symbols-outlined" style={{ color: '#DC2626' }}>error</span>
                                <span className="kpi-badge" style={{ color: '#DC2626' }}>High Risk</span>
                            </div>
                            <div className="kpi-title">Flagged Risks</div>
                            <div className="kpi-value">{metrics?.flagged_risks || 0}</div>
                        </div>
                        <div className="card kpi-card">
                            <div className="kpi-header">
                                <span className="material-symbols-outlined" style={{ color: '#A1A1AA' }}>description</span>
                                <span className="kpi-badge" style={{ color: '#A1A1AA' }}>Final Draft</span>
                            </div>
                            <div className="kpi-title">Reports Generated</div>
                            <div className="kpi-value">{metrics?.reports_generated || 0}</div>
                        </div>
                    </div>

                    {/* Processing Pipeline Status */}
                    <div className="card pipeline-card">
                        <div className="section-header">
                            <h3>Processing Pipeline</h3>
                        </div>
                        <div className="pipeline-list">
                            <div className="pipeline-item">
                                <div className="pipeline-info">
                                    <span>TEXT EXTRACTION</span>
                                    <span>{formatPercent(pipeline?.stages?.TEXT_EXTRACTION || 0)}</span>
                                </div>
                                <div className="pipeline-bar-bg">
                                    <div className="pipeline-bar-fill complete" style={{ width: formatPercent(pipeline?.stages?.TEXT_EXTRACTION || 0) }}></div>
                                </div>
                            </div>
                            <div className="pipeline-item">
                                <div className="pipeline-info">
                                    <span>PII SCANNING</span>
                                    <span>{formatPercent(pipeline?.stages?.PII_SCANNING || 0)}</span>
                                </div>
                                <div className="pipeline-bar-bg">
                                    <div className="pipeline-bar-fill" style={{ width: formatPercent(pipeline?.stages?.PII_SCANNING || 0) }}></div>
                                </div>
                            </div>
                            <div className="pipeline-item">
                                <div className="pipeline-info">
                                    <span>STRUCTURING</span>
                                    <span>{formatPercent(pipeline?.stages?.STRUCTURING || 0)}</span>
                                </div>
                                <div className="pipeline-bar-bg">
                                    <div className="pipeline-bar-fill" style={{ width: formatPercent(pipeline?.stages?.STRUCTURING || 0) }}></div>
                                </div>
                            </div>
                            <div className="pipeline-item">
                                <div className="pipeline-info">
                                    <span>AI ANALYSIS</span>
                                    <span>{formatPercent(pipeline?.stages?.AI_ANALYSIS || 0)}</span>
                                </div>
                                <div className="pipeline-bar-bg">
                                    <div className="pipeline-bar-fill" style={{ width: formatPercent(pipeline?.stages?.AI_ANALYSIS || 0), background: '#818CF8' }}></div>
                                </div>
                            </div>
                            {pipeline?.current && (
                                <div className="pipeline-status">
                                    CURRENT STEP: {pipeline.current.message}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="card activity-card">
                        <div className="section-header">
                            <h3>Recent Activity</h3>
                            <Link to="/audit" className="section-link">See all activity</Link>
                        </div>
                        <div className="activity-list">
                            {summary?.findings?.length > 0 ? summary.findings.slice(0, 4).map((finding, i) => (
                                <div className="activity-item" key={i}>
                                    <div className="activity-icon">
                                        <span className="material-symbols-outlined">warning</span>
                                    </div>
                                    <div className="activity-content">
                                        <div className="activity-title">{finding.description}</div>
                                        <div className="activity-meta">{finding.category} Risk identified</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="empty-state">
                                    <span className="material-symbols-outlined">history</span>
                                    <p>No recent activity</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="card actions-card">
                        <h3>
                            <span className="material-symbols-outlined">bolt</span>
                            Quick Actions
                        </h3>
                        <div className="actions-grid">
                            <button className="action-btn" onClick={() => navigate('/documents')}>
                                <span className="material-symbols-outlined">upload_file</span>
                                Upload Documents
                            </button>
                            <button className="action-btn" onClick={() => navigate('/processing')}>
                                <span className="material-symbols-outlined">settings_suggest</span>
                                View Pipeline
                            </button>
                            <button className="action-btn" onClick={() => navigate('/reports')}>
                                <span className="material-symbols-outlined">description</span>
                                Generate Report
                            </button>
                            <button className="action-btn" onClick={() => navigate('/ai-assistant')}>
                                <span className="material-symbols-outlined">smart_toy</span>
                                AI Assistant
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
