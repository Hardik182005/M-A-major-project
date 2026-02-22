import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import api, { getProjectFindings, updateFindingStatus } from '../api';
import './AnalysisPage.css';

export default function AnalysisPage() {
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);
    const [findings, setFindings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    // Fetch findings when project is selected
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

    // Group findings by severity
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
            // Refresh findings
            const res = await getProjectFindings(selectedProject.id);
            if (res.data?.findings) {
                setFindings(res.data.findings);
            }
        } catch (err) {
            console.error("Failed to update finding:", err);
        }
    };

    // Show project selection prompt if no project selected
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

                {/* Header elements */}
                <div className="analysis-header-section">
                    <div className="analysis-titles">
                        <h1>Analysis</h1>
                        <p>AI-detected risks across <strong>{findings.length} findings</strong></p>
                    </div>
                    <div className="analysis-actions">
                        <button className="analysis-btn-secondary" onClick={() => setFilter(filter === 'all' ? 'all' : 'all')}>
                            <span className="material-symbols-outlined">filter_list</span>
                            FILTER
                        </button>
                        <button className="analysis-btn-primary">
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

                        {/* Findings Section */}
                        <div className="analysis-section">
                            <div className="section-title">
                                <span className="material-symbols-outlined">insert_chart</span>
                                <h2>All Findings</h2>
                                <span className="alert-badge">{findings.length} TOTAL</span>
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
                                {filteredFindings.length > 5 && (
                                    <div className="view-all-row">
                                        <button className="view-all-btn">VIEW ALL {filteredFindings.length} FINDINGS</button>
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
