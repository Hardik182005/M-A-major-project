import React, { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import api from '../api';
import './AuditPage.css';

export default function AuditPage() {
    const [selectedProject, setSelectedProject] = useState(null);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalEvents, setTotalEvents] = useState(0);
    const limit = 20;

    const parseAuditLogs = (events) => {
        return events.map(e => {
            const dt = new Date(e.timestamp);
            const month = dt.toLocaleString('en-US', { month: 'short' }).toUpperCase();
            const timestampFormatted = `${month} ${dt.getDate()},\n${dt.toTimeString().split(' ')[0]}`;

            let meta = {};
            try {
                meta = JSON.parse(e.meta_json || '{}');
            } catch (err) {
                console.error("JSON parse error for meta_json", err);
            }

            const isAI = ["SCAN", "ALERT", "AI_ANALYSIS_COMPLETE"].includes(e.action);

            let desc = "";
            let icon = "info";
            let actionText = e.action.replace(/_/g, ' ');

            switch (e.action) {
                case 'UPLOAD_DOCUMENT':
                    desc = <span>Uploaded <strong>{meta.filename || 'document'}</strong> to Secure Vault</span>;
                    icon = "upload";
                    actionText = "UPLOAD";
                    break;
                case 'DOWNLOAD_DOCUMENT':
                    desc = <span>Downloaded <strong>{meta.filename || 'document'}</strong></span>;
                    icon = "download";
                    actionText = "DOWNLOAD";
                    break;
                case 'DELETE_DOCUMENT':
                    desc = <span>Deleted <strong>{meta.filename || 'document'}</strong></span>;
                    icon = "delete";
                    actionText = "DELETE";
                    break;
                case 'AI_ANALYSIS_COMPLETE':
                    desc = <span>Completed AI analysis and risk assessment on <strong>{meta.filename || 'document'}</strong></span>;
                    icon = "verified";
                    actionText = "AI SCAN";
                    break;
                case 'LOCK_DOCUMENT':
                    desc = <span>Placed legal hold on <strong>{meta.filename || 'document'}</strong></span>;
                    icon = "lock";
                    actionText = "LOCK";
                    break;
                case 'UNLOCK_DOCUMENT':
                    desc = <span>Removed legal hold from <strong>{meta.filename || 'document'}</strong></span>;
                    icon = "lock_open";
                    actionText = "UNLOCK";
                    break;
                default:
                    desc = <span>Performed {e.action.toLowerCase()} on resource</span>;
                    icon = "info";
            }

            return {
                id: e.id,
                timestamp: timestampFormatted,
                actor: isAI ? "MERGERMIND AI" : (meta.user_email || `User ${e.actor_id}`),
                role: isAI ? "SYSTEM AUTOMATION" : "ANALYST",
                avatar: isAI ? "smart_toy" : "U",
                isAI: isAI,
                action: actionText,
                icon: icon,
                desc: desc,
                ip: e.ip_address || "N/A"
            };
        });
    };

    useEffect(() => {
        if (!selectedProject) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const offset = (currentPage - 1) * limit;
                const res = await api.get(`/projects/${selectedProject.id}/audit?limit=${limit}&offset=${offset}`);

                setAuditLogs(parseAuditLogs(res.data.events || []));
                setTotalEvents(res.data.total || 0);
            } catch (err) {
                console.error("Failed to fetch audit trail", err);
                setAuditLogs([]);
                setTotalEvents(0);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedProject, currentPage]);

    const getActionClass = (action) => {
        if (action.includes('UPLOAD')) return 'action-upload';
        if (action.includes('AI') || action.includes('SCAN')) return 'action-scan';
        if (action.includes('DELETE')) return 'action-alert';
        if (action.includes('DOWNLOAD')) return 'action-download';
        return 'action-access';
    };

    const totalPages = Math.ceil(totalEvents / limit);
    const renderPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;

        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, start + maxVisible - 1);

        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            pages.push(
                <button
                    key={i}
                    className={`page-num ${currentPage === i ? 'active' : ''}`}
                    onClick={() => setCurrentPage(i)}
                >
                    {i}
                </button>
            );
        }
        return pages;
    };

    return (
        <AppLayout selectedProject={selectedProject} onSelectProject={(p) => { setSelectedProject(p); setCurrentPage(1); }}>
            <div className="audit-container fade-in">

                {/* Header Section */}
                <div className="audit-header-section">
                    <div className="audit-titles">
                        <h1 className="font-display">AUDIT TRAIL</h1>
                        <p>Complete activity log for compliance monitoring and security auditing. All actions are immutable and timestamped.</p>
                    </div>
                    <div className="audit-actions">
                        <button className="export-log-btn">
                            <span className="material-symbols-outlined">download</span>
                            EXPORT LOG
                        </button>
                    </div>
                </div>

                {/* Filters Board */}
                <div className="audit-filters-bar">
                    <div className="search-box">
                        <span className="material-symbols-outlined search-icon">search</span>
                        <input type="text" placeholder="Search user, document, or IP address..." />
                    </div>

                    <div className="filter-dropdowns">
                        <div className="select-box">
                            <span>ALL ACTIONS</span>
                            <span className="material-symbols-outlined">expand_more</span>
                        </div>
                        <div className="date-picker-box">
                            <span className="material-symbols-outlined">calendar_today</span>
                            <span>{new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                {/* Audit Table */}
                <div className="audit-table-card">
                    <table className="audit-table">
                        <thead>
                            <tr>
                                <th style={{ width: '12%' }}>TIMESTAMP<br />(UTC)</th>
                                <th style={{ width: '20%' }}>USER / ACTOR</th>
                                <th style={{ width: '18%' }}>ACTION TYPE</th>
                                <th style={{ width: '35%' }}>DESCRIPTION / RESOURCE</th>
                                <th style={{ width: '10%' }}>IP ADDRESS</th>
                                <th style={{ width: '5%', textAlign: 'center' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#A1A1AA' }}>
                                        <span className="material-symbols-outlined spinning" style={{ marginBottom: '10px' }}>progress_activity</span>
                                        <br />Loading Secure Ledger...
                                    </td>
                                </tr>
                            ) : auditLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#A1A1AA' }}>
                                        No audit events found. Activities like uploads and AI analysis will appear here.
                                    </td>
                                </tr>
                            ) : auditLogs.map(log => (
                                <tr key={log.id}>
                                    <td className="timestamp-cell">
                                        <div dangerouslySetInnerHTML={{ __html: log.timestamp.replace('\n', '<br/>') }} />
                                    </td>

                                    <td>
                                        <div className="actor-cell">
                                            {log.isAI ? (
                                                <div className="ai-avatar"><span className="material-symbols-outlined">{log.avatar}</span></div>
                                            ) : (
                                                <div className="user-avatar-circle">{typeof log.avatar === 'string' && log.avatar.length === 1 ? log.avatar : 'U'}</div>
                                            )}
                                            <div className="actor-info">
                                                <div className="actor-name">{log.actor}</div>
                                                <div className="actor-role">{log.role}</div>
                                            </div>
                                        </div>
                                    </td>

                                    <td>
                                        <div className={`action-badge ${getActionClass(log.action)}`}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>{log.icon}</span>
                                            {log.action}
                                        </div>
                                    </td>

                                    <td className="desc-cell">{log.desc}</td>

                                    <td className="ip-cell">{log.ip}</td>

                                    <td style={{ textAlign: 'center' }}>
                                        <button className="menu-btn"><span className="material-symbols-outlined">more_vert</span></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="audit-pagination">
                            <div className="page-info">
                                SHOWING <strong>{(currentPage - 1) * limit + 1}</strong> TO <strong>{Math.min(currentPage * limit, totalEvents)}</strong> OF <strong>{totalEvents}</strong> EVENTS
                            </div>
                            <div className="page-controls">
                                <button
                                    className="page-arrow"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                >
                                    <span className="material-symbols-outlined">chevron_left</span>
                                </button>

                                {renderPageNumbers()}

                                {totalPages > 5 && currentPage < totalPages - 2 && (
                                    <>
                                        <span className="page-dots">...</span>
                                        <button className="page-num" onClick={() => setCurrentPage(totalPages)}>{totalPages}</button>
                                    </>
                                )}

                                <button
                                    className="page-arrow"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                >
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </AppLayout>
    );
}
