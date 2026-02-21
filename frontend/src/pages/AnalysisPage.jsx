import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import './AnalysisPage.css';

export default function AnalysisPage() {
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);

    return (
        <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
            <div className="analysis-container fade-in">

                {/* Header elements */}
                <div className="analysis-header-section">
                    <div className="analysis-titles">
                        <h1>Analysis</h1>
                        <p>AI-detected risks across <strong>142 legal & financial documents</strong></p>
                    </div>
                    <div className="analysis-actions">
                        <button className="analysis-btn-secondary">
                            <span className="material-symbols-outlined">filter_list</span>
                            FILTER
                        </button>
                        <button className="analysis-btn-primary">
                            <span className="material-symbols-outlined">download</span>
                            EXPORT CSV
                        </button>
                    </div>
                </div>

                {/* Risk Score Cards */}
                <div className="risk-cards-grid">
                    <div className="risk-card critical-risk">
                        <div className="risk-header">
                            <span>CRITICAL RISKS</span>
                            <span className="material-symbols-outlined icon-critical">error</span>
                        </div>
                        <div className="risk-metrics">
                            <div className="risk-value">05</div>
                            <div className="risk-label">ANOMALIES</div>
                        </div>
                    </div>

                    <div className="risk-card">
                        <div className="risk-header">
                            <span>HIGH RISKS</span>
                            <span className="material-symbols-outlined icon-high">warning</span>
                        </div>
                        <div className="risk-metrics">
                            <div className="risk-value">12</div>
                            <div className="risk-label">DETECTED</div>
                        </div>
                    </div>

                    <div className="risk-card">
                        <div className="risk-header">
                            <span>MEDIUM RISKS</span>
                            <span className="material-symbols-outlined icon-medium">info</span>
                        </div>
                        <div className="risk-metrics">
                            <div className="risk-value">18</div>
                            <div className="risk-label"></div>
                        </div>
                    </div>

                    <div className="risk-card">
                        <div className="risk-header">
                            <span>LOW RISKS</span>
                            <span className="material-symbols-outlined icon-low">check_circle</span>
                        </div>
                        <div className="risk-metrics">
                            <div className="risk-value">32</div>
                            <div className="risk-label"></div>
                        </div>
                    </div>
                </div>

                {/* Potential Duplicate Invoices Section */}
                <div className="analysis-section">
                    <div className="section-title">
                        <span className="material-symbols-outlined">content_copy</span>
                        <h2>Potential Duplicate Invoices</h2>
                        <span className="alert-badge">2 ALERTS</span>
                    </div>

                    <div className="table-card">
                        <table className="analysis-table">
                            <thead>
                                <tr>
                                    <th>INVOICE ID A</th>
                                    <th>INVOICE ID B</th>
                                    <th>SIMILARITY %</th>
                                    <th>VENDOR</th>
                                    <th>AMOUNT</th>
                                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="mono-text">INV-2023-001</td>
                                    <td className="mono-text">INV-2023-001-A</td>
                                    <td><strong>94%</strong></td>
                                    <td>TechSupply Inc.</td>
                                    <td className="mono-text">$12,450.00</td>
                                    <td className="actions-cell">
                                        <button className="action-btn review-btn" onClick={() => navigate('/documents/inv_001')}>REVIEW</button>
                                        <button className="action-btn dismiss-btn">DISMISS</button>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="mono-text">INV-8821</td>
                                    <td className="mono-text">INV-8821_REV</td>
                                    <td><strong>87%</strong></td>
                                    <td>Logistics Partners</td>
                                    <td className="mono-text">$4,200.00</td>
                                    <td className="actions-cell">
                                        <button className="action-btn review-btn" onClick={() => navigate('/documents/inv_002')}>REVIEW</button>
                                        <button className="action-btn dismiss-btn">DISMISS</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Financial Anomalies Section */}
                <div className="analysis-section">
                    <div className="section-title">
                        <span className="material-symbols-outlined">insert_chart</span>
                        <h2>Financial Anomalies</h2>
                    </div>

                    <div className="table-card" style={{ paddingBottom: 0 }}>
                        <table className="analysis-table anomalies-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '20%' }}>DOCUMENT</th>
                                    <th style={{ width: '15%' }}>TYPE</th>
                                    <th style={{ width: '40%' }}>DESCRIPTION</th>
                                    <th style={{ width: '10%' }}>SEVERITY</th>
                                    <th style={{ width: '15%', textAlign: 'right' }}>STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>Q3_Financials_Draft.pdf</strong></td>
                                    <td className="anomaly-type">AMOUNT<br />MISMATCH</td>
                                    <td className="desc-cell">Total revenue in table does not match summary on page 1.</td>
                                    <td><span className="severity-badge sev-critical">CRITICAL</span></td>
                                    <td style={{ textAlign: 'right' }}><span className="status-pill status-pending">PENDING</span></td>
                                </tr>
                                <tr>
                                    <td><strong>Service_Agreement_Alpha.docx</strong></td>
                                    <td className="anomaly-type">MISSING CLAUSE</td>
                                    <td className="desc-cell">Standard indemnity clause detected as missing compared to template.</td>
                                    <td><span className="severity-badge sev-high">HIGH</span></td>
                                    <td style={{ textAlign: 'right' }}><span className="status-pill status-review">IN REVIEW</span></td>
                                </tr>
                                <tr>
                                    <td><strong>Vendor_List_2023.xlsx</strong></td>
                                    <td className="anomaly-type">UNVERIFIED<br />ENTITY</td>
                                    <td className="desc-cell">Vendor "Acme Shell Co" has no matching tax ID in records.</td>
                                    <td><span className="severity-badge sev-medium">MEDIUM</span></td>
                                    <td style={{ textAlign: 'right' }}>
                                        <span className="status-pill status-resolved">
                                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check</span> RESOLVED
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="view-all-row">
                            <button className="view-all-btn">VIEW ALL 18 ANOMALIES</button>
                        </div>
                    </div>
                </div>

            </div>
        </AppLayout>
    );
}
