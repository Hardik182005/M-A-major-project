import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import api, { getProjectReports, generateReport, getReportSummary } from '../api';
import './ReportsPage.css';

export default function ReportsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedProject, setSelectedProject] = useState(null);
    const [reports, setReports] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    // Fetch reports when project is selected
    useEffect(() => {
        if (!selectedProject) {
            setLoading(false);
            return;
        }

        const fetchReports = async () => {
            setLoading(true);
            try {
                const res = await getProjectReports(selectedProject.id);
                if (res.data?.reports) {
                    setReports(res.data.reports);
                    setSelectedReport(res.data.current_report);
                }
            } catch (err) {
                console.error("Failed to load reports:", err);
                setReports([]);
                setSelectedReport(null);
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, [selectedProject]);

    const handleGenerateReport = async () => {
        if (!selectedProject) return;

        setGenerating(true);
        try {
            const res = await generateReport(selectedProject.id);
            if (res.data) {
                // Refresh reports
                const reportsRes = await getProjectReports(selectedProject.id);
                if (reportsRes.data?.reports) {
                    setReports(reportsRes.data.reports);
                    setSelectedReport(reportsRes.data.current_report);
                }
            }
        } catch (err) {
            console.error("Failed to generate report:", err);
        } finally {
            setGenerating(false);
        }
    };

    // Badge styling helpers
    const getRiskBadge = (level) => {
        let bg = '#E4E4E7';
        let color = '#3F3F46';
        if (level === 'HIGH') {
            bg = '#09090B';
            color = 'white';
        } else if (level === 'MEDIUM') {
            bg = '#3F3F46';
            color = 'white';
        } else if (level === 'LOW') {
            bg = '#F4F4F5';
        }
        return <span className="risk-badge" style={{ backgroundColor: bg, color }}>{level}</span>;
    };

    // Show project selection prompt if no project selected
    if (!selectedProject) {
        return (
            <AppLayout selectedProject={null} onSelectProject={setSelectedProject}>
                <div className="no-project-selected">
                    <span className="material-symbols-outlined">description</span>
                    <h2>Select a Project</h2>
                    <p>Choose a project from the sidebar to view reports</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
            <div className="reports-container fade-in">

                {/* Header elements */}
                <div className="reports-header-section">
                    <div className="reports-titles">
                        <h1>Reports</h1>
                        <p>Institutional-grade summaries and due diligence outputs.</p>
                    </div>
                    <button
                        className="generate-new-btn"
                        onClick={handleGenerateReport}
                        disabled={generating}
                    >
                        <span className="material-symbols-outlined">
                            {generating ? 'progress_activity' : 'add'}
                        </span>
                        {generating ? 'Generating...' : 'Generate New Report'}
                    </button>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <span className="material-symbols-outlined spinning">progress_activity</span>
                        <p>Loading reports...</p>
                    </div>
                ) : (
                    <>
                        {/* Top Half: Reports Table */}
                        <div className="reports-table-card">
                            {reports.length > 0 ? (
                                <table className="reports-table">
                                    <thead>
                                        <tr>
                                            <th>REPORT NAME</th>
                                            <th>DATE</th>
                                            <th>DOCS</th>
                                            <th>RISK LEVEL</th>
                                            <th>STATUS</th>
                                            <th style={{ textAlign: 'right' }}>ACTIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reports.map((rpt) => (
                                            <tr
                                                key={rpt.report_id}
                                                onClick={() => rpt.status === 'Complete' && setSelectedReport(rpt)}
                                                className={`report-row ${selectedReport?.report_id === rpt.report_id ? 'selected' : ''} ${rpt.status === 'Pending' ? 'pending-row' : ''}`}
                                            >
                                                <td>
                                                    <div className="report-name-cell">
                                                        <div className="report-icon-box">
                                                            <span className="material-symbols-outlined">summarize</span>
                                                        </div>
                                                        <div>
                                                            <div className="rp-name">{rpt.name}</div>
                                                            <div className="rp-id">ID: {rpt.report_id}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="rp-text">
                                                    {rpt.created_at ? new Date(rpt.created_at).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="rp-text">{rpt.doc_count} files</td>
                                                <td>{getRiskBadge(rpt.risk_level)}</td>
                                                <td>
                                                    <div className="status-label">
                                                        {rpt.status === 'Complete' ? (
                                                            <><span className="material-symbols-outlined status-icon complete-icon">check_circle</span> Complete</>
                                                        ) : (
                                                            <><span className="material-symbols-outlined status-icon pending-icon">more_horiz</span> Pending</>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button className="table-action-btn">
                                                        <span className="material-symbols-outlined">more_horiz</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-state">
                                    <span className="material-symbols-outlined">description</span>
                                    <p>No reports generated yet</p>
                                    <button className="upload-link" onClick={handleGenerateReport}>
                                        Generate your first report
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Bottom Half: Executive Summary Preview */}
                        {selectedReport && (
                            <div className="report-preview-card">
                                <div className="preview-toolbar">
                                    <div className="preview-toolbar-left">
                                        <span className="dossier-label">INSTITUTIONAL DOSSIER</span>
                                        <span className="dossier-divider">|</span>
                                        <span className="dossier-filename">
                                            {selectedReport.name?.toUpperCase().replace(/\s+/g, '_')}.PDF
                                        </span>
                                    </div>
                                    <div className="preview-toolbar-right">
                                        <button className="toolbar-btn" onClick={() => window.print()}>
                                            <span className="material-symbols-outlined">download</span> PDF
                                        </button>
                                        <button className="toolbar-btn" onClick={() => window.print()}>
                                            <span className="material-symbols-outlined">print</span> PRINT
                                        </button>
                                    </div>
                                </div>

                                <div className="preview-content-grid">
                                    <div className="preview-left-col">
                                        {/* Summary Heading */}
                                        <div className="summary-title-section">
                                            <h2 className="summary-title font-display">Executive Summary</h2>
                                            <div className="summary-meta">
                                                DATE GENERATED: {selectedReport.created_at ? new Date(selectedReport.created_at).toLocaleDateString().toUpperCase() : 'N/A'} / REFERENCE: {selectedReport.report_id?.toUpperCase()}
                                            </div>
                                        </div>

                                        {/* AI Investment Opinion */}
                                        <div className="opinion-section">
                                            <div className="section-label">
                                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>psychology</span>
                                                AI INVESTMENT OPINION
                                            </div>
                                            <p className="opinion-text">
                                                {selectedReport.summary || 'No summary available. Generate a report to see the AI analysis.'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="preview-right-col">
                                        {/* Verdict Badge */}
                                        <div className="verdict-container">
                                            <div className={`verdict-banner ${selectedReport.risk_level?.toLowerCase()}`}>
                                                <span className="material-symbols-outlined">
                                                    {selectedReport.risk_level === 'HIGH' ? 'warning' :
                                                        selectedReport.risk_level === 'MEDIUM' ? 'info' : 'check_circle'}
                                                </span>
                                                {selectedReport.risk_level === 'HIGH' ? 'HIGH RISK' :
                                                    selectedReport.risk_level === 'MEDIUM' ? 'PROCEED WITH CAUTION' : 'FAVORABLE'}
                                            </div>
                                            <div className="confidence-label">
                                                RISK SCORE: {selectedReport.risk_score || 0}%
                                            </div>
                                        </div>

                                        {/* Risk Breakdown Bars */}
                                        <div className="risk-breakdown-section">
                                            <div className="section-label">RISK BREAKDOWN</div>

                                            {selectedReport.risk_breakdown && Object.entries(selectedReport.risk_breakdown).map(([category, value]) => (
                                                <div className="risk-bar-row" key={category}>
                                                    <div className="risk-bar-labels">
                                                        <span>{category.toUpperCase()}</span>
                                                        <span>{value}%</span>
                                                    </div>
                                                    <div className="risk-bar-track">
                                                        <div
                                                            className="risk-bar-fill"
                                                            style={{
                                                                width: `${value}%`,
                                                                backgroundColor: value > 60 ? '#09090B' : value > 30 ? '#71717A' : '#A1A1AA'
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))}

                                            <button
                                                className="view-full-report-btn"
                                                onClick={() => navigate('/analysis')}
                                            >
                                                VIEW FULL ANALYSIS
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
