import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import api, { getProjectReports, generateReport, getReportSummary } from '../api';
import ReactMarkdown from 'react-markdown';
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

    const handleDownloadReport = () => {
        if (!selectedReport) return;

        let r = '';
        r += `# 📋 Due Diligence Risk Assessment Report\n\n`;
        r += `**Project:** ${selectedReport.project_name || selectedReport.name}\n`;
        r += `**Report ID:** ${selectedReport.report_id}\n`;
        r += `**Date Generated:** ${new Date().toLocaleDateString()}\n`;
        r += `**Risk Level:** ⚠️ ${selectedReport.risk_level}\n`;
        r += `**Risk Score:** ${selectedReport.risk_score || 0}/100\n\n`;
        r += `---\n\n`;

        // Executive Summary
        r += `## 📌 Executive Summary\n\n`;
        r += (selectedReport.summary || 'No summary available.') + '\n\n';

        // Risk Breakdown
        if (selectedReport.risk_breakdown) {
            r += `## 📊 Risk Breakdown\n\n`;
            r += `| Category | Risk Score | Visual |\n`;
            r += `|----------|-----------|--------|\n`;
            Object.entries(selectedReport.risk_breakdown).forEach(([cat, val]) => {
                const bar = '█'.repeat(Math.round(val / 5)) + '░'.repeat(20 - Math.round(val / 5));
                r += `| ${cat.toUpperCase()} | ${val}% | ${bar} |\n`;
            });
            r += '\n';
        }

        // AI Findings with Highlighting
        if (selectedReport.findings && selectedReport.findings.length > 0) {
            r += `## 🔍 AI-Detected Findings & Observations\n\n`;

            // Group by severity
            const critical = selectedReport.findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
            const medium = selectedReport.findings.filter(f => f.severity === 'MEDIUM');
            const low = selectedReport.findings.filter(f => f.severity === 'LOW');

            if (critical.length > 0) {
                r += `### 🔴 HIGH / CRITICAL SEVERITY\n\n`;
                critical.forEach((f, i) => {
                    r += `**${i + 1}. [${f.severity}] ${f.type || f.category}**\n`;
                    r += `- **Category:** ${f.category}\n`;
                    r += `- **Description:** ${f.description}\n`;
                    if (f.evidence) r += `- **Evidence:** _"${f.evidence}"_\n`;
                    if (f.confidence) r += `- **AI Confidence:** ${(f.confidence * 100).toFixed(0)}%\n`;
                    r += '\n';
                });
            }

            if (medium.length > 0) {
                r += `### 🟡 MEDIUM SEVERITY\n\n`;
                medium.forEach((f, i) => {
                    r += `**${i + 1}. [${f.severity}] ${f.type || f.category}**\n`;
                    r += `- **Category:** ${f.category}\n`;
                    r += `- **Description:** ${f.description}\n`;
                    if (f.evidence) r += `- **Evidence:** _"${f.evidence}"_\n`;
                    r += '\n';
                });
            }

            if (low.length > 0) {
                r += `### 🟢 LOW SEVERITY\n\n`;
                low.forEach((f, i) => {
                    r += `**${i + 1}. [${f.severity}] ${f.type || f.category}**\n`;
                    r += `- **Description:** ${f.description}\n`;
                    r += '\n';
                });
            }
        }

        // PII Detection Section
        r += `## 🛡️ PII Detection Summary\n\n`;
        r += `> **Note:** PII entities are automatically detected by the AI pipeline during document processing.\n`;
        r += `> Review each flagged entity for compliance with data protection regulations (GDPR, CCPA, etc.).\n\n`;
        r += `PII entities detected across project documents include: **PERSON**, **EMAIL**, **PHONE**, **SSN**, **ADDRESS**, **ORGANIZATION**, **ACCOUNT**, **ID** types.\n\n`;
        r += `For full PII details, navigate to the Document Viewer in the application.\n\n`;

        // Acquisition Verdict
        r += `---\n\n## 🏛️ AI Acquisition Verdict\n\n`;
        if (selectedReport.risk_level === 'HIGH') {
            r += `> ⚠️ **PROCEED WITH EXTREME CAUTION**\n>\n`;
            r += `> Critical material contingencies detected. Post-acquisition integration will likely face severe operational and regulatory friction unless remediation clauses are inserted into the SPA.\n`;
        } else if (selectedReport.risk_level === 'MEDIUM') {
            r += `> ⚠️ **PROCEED WITH CAUTION**\n>\n`;
            r += `> Standard operational friction detected. While no deal-breakers were identified, failure to address medium-severity issues may result in margin erosion post-closure.\n`;
        } else {
            r += `> ✅ **FAVORABLE — PROCEED**\n>\n`;
            r += `> All systems present clean baseline health. No major restructuring or defensive posturing required.\n`;
        }

        r += `\n---\n_Generated by MergerMindAI — AI-Powered Due Diligence Platform_\n`;

        const blob = new Blob([r], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Risk_Assessment_${selectedReport.report_id}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
                                        <button className="toolbar-btn" onClick={handleDownloadReport}>
                                            <span className="material-symbols-outlined">download</span> MD / TXT
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
                                            <div className="opinion-text">
                                                {selectedReport.summary ? (
                                                    <ReactMarkdown>{selectedReport.summary}</ReactMarkdown>
                                                ) : 'No summary available. Generate a report to see the AI analysis.'}
                                            </div>
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

                                {/* Printable Findings Table */}
                                {selectedReport.findings && selectedReport.findings.length > 0 && (
                                    <div className="report-findings-print-section" style={{ marginTop: '40px', paddingTop: '40px', borderTop: '1px solid #E4E4E7' }}>
                                        <div className="section-label" style={{ marginBottom: '16px' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>list_alt</span>
                                            DETAILED FINDINGS & ADVICE
                                        </div>
                                        <table className="analysis-table" style={{ width: '100%', fontSize: '13px' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ textAlign: 'left', paddingBottom: '12px', borderBottom: '1px solid #E4E4E7' }}>SEVERITY</th>
                                                    <th style={{ textAlign: 'left', paddingBottom: '12px', borderBottom: '1px solid #E4E4E7' }}>TYPE / CATEGORY</th>
                                                    <th style={{ textAlign: 'left', paddingBottom: '12px', borderBottom: '1px solid #E4E4E7' }}>OBSERVATION & PREDICTION</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedReport.findings.map(finding => (
                                                    <tr key={finding.id}>
                                                        <td style={{ padding: '16px 8px 16px 0', borderBottom: '1px solid #F4F4F5' }}>
                                                            <span className={`severity-badge sev-${finding.severity?.toLowerCase()}`}>
                                                                {finding.severity}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '16px 8px', borderBottom: '1px solid #F4F4F5' }}>
                                                            <strong>{finding.type}</strong><br />
                                                            <span style={{ color: '#71717A', fontSize: '11px' }}>{finding.category}</span>
                                                        </td>
                                                        <td style={{ padding: '16px 0 16px 8px', borderBottom: '1px solid #F4F4F5', lineHeight: '1.5' }}>
                                                            {finding.description}
                                                            {finding.evidence && (
                                                                <div style={{ marginTop: '8px', fontSize: '11px', color: '#71717A', fontStyle: 'italic' }}>
                                                                    "{finding.evidence}"
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        <div className="advisory-note" style={{ marginTop: '32px', padding: '24px', backgroundColor: '#FAFAFA', borderLeft: '3px solid #09090B' }}>
                                            <strong style={{ display: 'block', marginBottom: '8px' }}>AI Predictive Warning & Advisory</strong>
                                            <p style={{ margin: 0, fontSize: '13px', color: '#3F3F46' }}>
                                                {selectedReport.risk_level === 'HIGH' ?
                                                    "Critical material contingencies detected. Post-acquisition integration will likely face severe operational and regulatory friction unless remediation clauses are inserted into the SP&A. Strong recommendation to restructure deal terms."
                                                    : selectedReport.risk_level === 'MEDIUM' ?
                                                        "Standard operational friction detected. While no deal-breakers were identified, failure to address these medium-severity issues may result in 10-15% margin erosion post-closure. Advise resolving prior to Day 1."
                                                        :
                                                        "All systems present clean baseline health. No major restructuring or defensive posturing required. Proceed with standard integration playbook."
                                                }
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
