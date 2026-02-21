import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import './ReportsPage.css';

export default function ReportsPage() {
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedReportId, setSelectedReportId] = useState('rpt_892');

    // Mock reports array mapping to the UI requirement
    const reports = [
        {
            report_id: "rpt_892",
            icon: "summarize",
            name: "Q3 Financial Audit - Acme Corp",
            display_id: "ID: RPT-2023-892",
            created_at: "24 Oct 2023",
            doc_count: "12 files",
            risk_level: "MEDIUM",
            status: "Complete"
        },
        {
            report_id: "rpt_891",
            icon: "gavel",
            name: "Legal Due Diligence - Initial Scan",
            display_id: "ID: RPT-2023-891",
            created_at: "20 Oct 2023",
            doc_count: "45 files",
            risk_level: "HIGH",
            status: "Pending"
        },
        {
            report_id: "rpt_885",
            icon: "trending_up",
            name: "Operational Efficiency Report",
            display_id: "ID: RPT-2023-885",
            created_at: "15 Oct 2023",
            doc_count: "8 files",
            risk_level: "LOW",
            status: "Complete"
        }
    ];

    const selectedReport = reports.find(r => r.report_id === selectedReportId) || reports[0];

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
            bg = '#F4F4F5'; // Lighter grey for low
        }
        return <span className="risk-badge" style={{ backgroundColor: bg, color }}>{level}</span>;
    };

    return (
        <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
            <div className="reports-container fade-in">

                {/* Header elements */}
                <div className="reports-header-section">
                    <div className="reports-titles">
                        <h1>Reports</h1>
                        <p>Institutional-grade summaries and due diligence outputs.</p>
                    </div>
                    {/* User requirement: "generate new report it will redirect to documents section" */}
                    <button className="generate-new-btn" onClick={() => navigate('/documents')}>
                        <span className="material-symbols-outlined">add</span>
                        Generate New Report
                    </button>
                </div>

                {/* Top Half: Reports Table */}
                <div className="reports-table-card">
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
                                    onClick={() => rpt.status === 'Complete' && setSelectedReportId(rpt.report_id)}
                                    className={`report-row ${selectedReportId === rpt.report_id ? 'selected' : ''} ${rpt.status === 'Pending' ? 'pending-row' : ''}`}
                                >
                                    <td>
                                        <div className="report-name-cell">
                                            <div className="report-icon-box">
                                                <span className="material-symbols-outlined">{rpt.icon}</span>
                                            </div>
                                            <div>
                                                <div className="rp-name">{rpt.name}</div>
                                                <div className="rp-id">{rpt.display_id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="rp-text">{rpt.created_at}</td>
                                    <td className="rp-text">{rpt.doc_count}</td>
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
                                        <button className="table-action-btn"><span className="material-symbols-outlined">more_horiz</span></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Bottom Half: Executive Summary Preview */}
                <div className="report-preview-card">

                    <div className="preview-toolbar">
                        <div className="preview-toolbar-left">
                            <span className="dossier-label">INSTITUTIONAL DOSSIER</span>
                            <span className="dossier-divider">|</span>
                            <span className="dossier-filename">Q3_FIN_AUDIT_ACME_V1.PDF</span>
                        </div>
                        <div className="preview-toolbar-right">
                            <button className="toolbar-btn"><span className="material-symbols-outlined">share</span> SHARE</button>
                            <button className="toolbar-btn"><span className="material-symbols-outlined">download</span> PDF</button>
                            <button className="toolbar-btn"><span className="material-symbols-outlined">print</span> PRINT</button>
                        </div>
                    </div>

                    <div className="preview-content-grid">

                        <div className="preview-left-col">
                            {/* Summary Heading */}
                            <div className="summary-title-section">
                                <h2 className="summary-title font-display">Executive Summary</h2>
                                <div className="summary-meta">DATE GENERATED: OCT 24, 2023 / REFERENCE: MM-892</div>
                            </div>

                            {/* AI Investment Opinion */}
                            <div className="opinion-section">
                                <div className="section-label">
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>psychology</span>
                                    AI INVESTMENT OPINION
                                </div>
                                <p className="opinion-text">
                                    Analysis of Q3 audit documentation reveals consistent revenue growth, however, <span className="text-highlight">significant unmitigated liabilities</span> have been identified within subsidiary holdings. Our forensic model flagged a <strong>15% delta</strong> in reported vs. actual operational costs.
                                </p>
                                <blockquote className="opinion-quote">
                                    "Core intellectual property remains robust and arguably undervalued by current market benchmarks. Strategic renegotiation of terms is advised prior to final execution."
                                </blockquote>
                            </div>
                        </div>

                        <div className="preview-right-col">
                            {/* Verdict Badge */}
                            <div className="verdict-container">
                                <div className="verdict-banner proceed-caution">
                                    <span className="material-symbols-outlined">warning</span> PROCEED WITH CAUTION
                                </div>
                                <div className="confidence-label">AI CONFIDENCE INDEX: 88%</div>
                            </div>

                            {/* Risk Breakdown Bars */}
                            <div className="risk-breakdown-section">
                                <div className="section-label">RISK BREAKDOWN</div>

                                <div className="risk-bar-row">
                                    <div className="risk-bar-labels">
                                        <span>FINANCIAL</span>
                                        <span>75%</span>
                                    </div>
                                    <div className="risk-bar-track">
                                        <div className="risk-bar-fill" style={{ width: '75%', backgroundColor: '#09090B' }}></div>
                                    </div>
                                </div>

                                <div className="risk-bar-row">
                                    <div className="risk-bar-labels">
                                        <span>LEGAL</span>
                                        <span>20%</span>
                                    </div>
                                    <div className="risk-bar-track">
                                        <div className="risk-bar-fill" style={{ width: '20%', backgroundColor: '#A1A1AA' }}></div>
                                    </div>
                                </div>

                                <div className="risk-bar-row">
                                    <div className="risk-bar-labels">
                                        <span>OPERATIONAL</span>
                                        <span>40%</span>
                                    </div>
                                    <div className="risk-bar-track">
                                        <div className="risk-bar-fill" style={{ width: '40%', backgroundColor: '#71717A' }}></div>
                                    </div>
                                </div>

                                <button className="view-full-report-btn">VIEW FULL REPORT</button>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </AppLayout>
    );
}
