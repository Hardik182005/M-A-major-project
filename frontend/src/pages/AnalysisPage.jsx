import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import api, { getProjectFindings, updateFindingStatus } from '../api';
import './AnalysisPage.css';

// Pure CSS/SVG Bar Chart Component
function BarChart({ data, title }) {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="chart-container">
            <h4 className="chart-title">{title}</h4>
            <div className="bar-chart">
                {data.map((item, idx) => (
                    <div key={idx} className="bar-row">
                        <span className="bar-label">{item.label}</span>
                        <div className="bar-track">
                            <div
                                className="bar-fill"
                                style={{
                                    width: `${(item.value / maxVal) * 100}%`,
                                    backgroundColor: item.color || '#2563EB',
                                    animationDelay: `${idx * 0.1}s`
                                }}
                            />
                        </div>
                        <span className="bar-value">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Pure CSS Donut/Pie Chart Component
function DonutChart({ segments, title, total }) {
    let cumulative = 0;
    const size = 120;
    const strokeWidth = 24;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="chart-container donut-chart-container">
            <h4 className="chart-title">{title}</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    {segments.map((seg, idx) => {
                        const pct = total > 0 ? seg.value / total : 0;
                        const dashLen = circumference * pct;
                        const dashOff = circumference * cumulative;
                        cumulative += pct;
                        return (
                            <circle
                                key={idx}
                                cx={size / 2}
                                cy={size / 2}
                                r={radius}
                                fill="none"
                                stroke={seg.color}
                                strokeWidth={strokeWidth}
                                strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                                strokeDashoffset={-dashOff}
                                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                                style={{ transition: 'all 0.6s ease' }}
                            />
                        );
                    })}
                    <text x="50%" y="50%" textAnchor="middle" dy=".3em" className="donut-center-text">
                        {total}
                    </text>
                </svg>
                <div className="donut-legend">
                    {segments.map((seg, idx) => (
                        <div key={idx} className="legend-item">
                            <span className="legend-dot" style={{ backgroundColor: seg.color }}></span>
                            <span className="legend-label">{seg.label}</span>
                            <span className="legend-value">{seg.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function AnalysisPage() {
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);
    const [findings, setFindings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        if (!selectedProject) {
            setLoading(false);
            return;
        }

        const fetchFindings = async () => {
            setLoading(true);
            try {
                const res = await getProjectFindings(selectedProject.id);
                if (res.data?.findings) {
                    setFindings(res.data.findings);
                }
            } catch (err) {
                console.error("Failed to load findings:", err);
                setFindings([]);
            } finally {
                setLoading(false);
            }
        };

        fetchFindings();
    }, [selectedProject]);

    // Group findings
    const criticalFindings = findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
    const highFindings = findings.filter(f => f.severity === 'HIGH');
    const mediumFindings = findings.filter(f => f.severity === 'MEDIUM');
    const lowFindings = findings.filter(f => f.severity === 'LOW');

    // Filter findings for display
    const filteredFindings = filter === 'all'
        ? findings
        : findings.filter(f => f.severity === filter.toUpperCase());

    const handleStatusUpdate = async (findingId, newStatus) => {
        try {
            await updateFindingStatus(findingId, newStatus);
            const res = await getProjectFindings(selectedProject.id);
            if (res.data?.findings) {
                setFindings(res.data.findings);
            }
        } catch (err) {
            console.error("Failed to update finding:", err);
        }
    };

    // Chart data
    const severityChartData = [
        { label: 'Critical/High', value: criticalFindings.length, color: '#DC2626' },
        { label: 'Medium', value: mediumFindings.length, color: '#F59E0B' },
        { label: 'Low', value: lowFindings.length, color: '#22C55E' },
    ];

    const categoryGroups = {};
    findings.forEach(f => {
        const cat = f.category || 'UNKNOWN';
        categoryGroups[cat] = (categoryGroups[cat] || 0) + 1;
    });
    const categoryColors = {
        FINANCIAL: '#3B82F6', LEGAL: '#8B5CF6', OPERATIONAL: '#F59E0B',
        COMPLIANCE: '#10B981', RISK: '#EF4444', ANOMALY: '#EC4899',
    };
    const categoryChartData = Object.entries(categoryGroups).map(([cat, count]) => ({
        label: cat,
        value: count,
        color: categoryColors[cat] || '#71717A',
    }));

    const donutSegments = [
        { label: 'Critical/High', value: criticalFindings.length, color: '#DC2626' },
        { label: 'Medium', value: mediumFindings.length, color: '#F59E0B' },
        { label: 'Low', value: lowFindings.length, color: '#22C55E' },
    ];

    const handleExportCSV = () => {
        if (findings.length === 0) return;
        let csv = 'Document,Category,Type,Severity,Status,Description,Confidence\n';
        findings.forEach(f => {
            csv += `"${f.doc_name || ''}","${f.category}","${f.type || ''}","${f.severity}","${f.status || 'PENDING'}","${(f.description || '').replace(/"/g, '""')}","${f.confidence || ''}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `findings_export_${selectedProject?.name || 'project'}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    if (!selectedProject) {
        return (
            <AppLayout selectedProject={null} onSelectProject={setSelectedProject}>
                <div className="no-project-selected">
                    <span className="material-symbols-outlined">analytics</span>
                    <h2>Select a Project</h2>
                    <p>Choose a project from the sidebar to view analysis</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
            <div className="analysis-container fade-in">

                <div className="analysis-header-section">
                    <div className="analysis-titles">
                        <h1>Analysis & Analytics</h1>
                        <p>AI-detected risks across <strong>{findings.length} findings</strong></p>
                    </div>
                    <div className="analysis-actions">
                        <select
                            className="analysis-filter-select"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        >
                            <option value="all">All Severities</option>
                            <option value="HIGH">High / Critical</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                        </select>
                        <button className="analysis-btn-primary" onClick={handleExportCSV}>
                            <span className="material-symbols-outlined">download</span>
                            EXPORT CSV
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <span className="material-symbols-outlined spinning">progress_activity</span>
                        <p>Loading analysis...</p>
                    </div>
                ) : (
                    <>
                        {/* Risk Score Cards */}
                        <div className="risk-cards-grid">
                            <div className="risk-card critical-risk">
                                <div className="risk-header">
                                    <span>CRITICAL RISKS</span>
                                    <span className="material-symbols-outlined icon-critical">error</span>
                                </div>
                                <div className="risk-metrics">
                                    <div className="risk-value">{criticalFindings.length.toString().padStart(2, '0')}</div>
                                    <div className="risk-label">ANOMALIES</div>
                                </div>
                            </div>

                            <div className="risk-card">
                                <div className="risk-header">
                                    <span>HIGH RISKS</span>
                                    <span className="material-symbols-outlined icon-high">warning</span>
                                </div>
                                <div className="risk-metrics">
                                    <div className="risk-value">{highFindings.length.toString().padStart(2, '0')}</div>
                                    <div className="risk-label">DETECTED</div>
                                </div>
                            </div>

                            <div className="risk-card">
                                <div className="risk-header">
                                    <span>MEDIUM RISKS</span>
                                    <span className="material-symbols-outlined icon-medium">info</span>
                                </div>
                                <div className="risk-metrics">
                                    <div className="risk-value">{mediumFindings.length.toString().padStart(2, '0')}</div>
                                    <div className="risk-label">ITEMS</div>
                                </div>
                            </div>

                            <div className="risk-card">
                                <div className="risk-header">
                                    <span>LOW RISKS</span>
                                    <span className="material-symbols-outlined icon-low">check_circle</span>
                                </div>
                                <div className="risk-metrics">
                                    <div className="risk-value">{lowFindings.length.toString().padStart(2, '0')}</div>
                                    <div className="risk-label">ITEMS</div>
                                </div>
                            </div>
                        </div>

                        {/* Charts Section */}
                        {findings.length > 0 && (
                            <div className="charts-grid">
                                <BarChart
                                    data={severityChartData}
                                    title="Risk Distribution by Severity"
                                />
                                <BarChart
                                    data={categoryChartData}
                                    title="Findings by Category"
                                />
                                <DonutChart
                                    segments={donutSegments}
                                    title="Severity Breakdown"
                                    total={findings.length}
                                />
                            </div>
                        )}

                        {/* Findings Section */}
                        <div className="analysis-section">
                            <div className="section-title">
                                <span className="material-symbols-outlined">insert_chart</span>
                                <h2>All Findings</h2>
                                <span className="alert-badge">{filteredFindings.length} TOTAL</span>
                            </div>

                            <div className="table-card" style={{ paddingBottom: 0 }}>
                                {filteredFindings.length > 0 ? (
                                    <table className="analysis-table anomalies-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '20%' }}>DOCUMENT</th>
                                                <th style={{ width: '10%' }}>CATEGORY</th>
                                                <th style={{ width: '10%' }}>TYPE</th>
                                                <th style={{ width: '35%' }}>DESCRIPTION</th>
                                                <th style={{ width: '10%' }}>SEVERITY</th>
                                                <th style={{ width: '15%', textAlign: 'right' }}>STATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredFindings.map((finding) => (
                                                <tr key={finding.id}>
                                                    <td>
                                                        <strong
                                                            className="clickable-doc"
                                                            onClick={() => navigate(`/documents/${finding.doc_id}`)}
                                                        >
                                                            {finding.doc_name || `Document ${finding.doc_id}`}
                                                        </strong>
                                                    </td>
                                                    <td className="anomaly-type">{finding.category}</td>
                                                    <td className="anomaly-type">{finding.type}</td>
                                                    <td className="desc-cell">{finding.description}</td>
                                                    <td>
                                                        <span className={`severity-badge sev-${finding.severity?.toLowerCase()}`}>
                                                            {finding.severity}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <span className={`status-pill status-${finding.status?.toLowerCase() || 'pending'}`}>
                                                            {finding.status || 'PENDING'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="empty-state">
                                        <span className="material-symbols-outlined">check_circle</span>
                                        <p>No findings detected</p>
                                        <span className="sub-text">Upload and process documents to see AI-detected risks</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
