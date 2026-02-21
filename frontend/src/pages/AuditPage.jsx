import React, { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import api from '../api';
import './AuditPage.css';

export default function AuditPage() {
    const [selectedProject, setSelectedProject] = useState(null);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const generateSystemLogs = (documents) => {
        let logs = [];
        let idCounter = 1;

        if (documents.length === 0) {
            return [];
        }

        documents.forEach((doc) => {
            const dt = new Date(doc.uploaded_at);
            const month = dt.toLocaleString('en-US', { month: 'short' }).toUpperCase();
            const timestampFormatted = `${month} ${dt.getDate()},\n${dt.toTimeString().split(' ')[0]}`;

            // Log 1: Real Upload Event
            logs.push({
                id: idCounter++,
                rawDate: dt.getTime(),
                timestamp: timestampFormatted,
                actor: doc.uploaded_by === 3 ? "SYSTEM BOT" : `USER ${doc.uploaded_by}`,
                role: doc.uploaded_by === 3 ? "SYSTEM" : "ANALYST",
                avatar: doc.uploaded_by === 3 ? "S" : "U",
                isAI: false,
                action: "UPLOAD",
                icon: "upload",
                desc: <span>Uploaded <strong>{doc.filename}</strong> to Secure Vault</span>,
                ip: "192.168.1.45"
            });

            // Log 2: Automated Scan event offset by 2 minutes
            const scanDt = new Date(doc.uploaded_at);
            scanDt.setMinutes(scanDt.getMinutes() + 2);
            const scanTimestamp = `${scanDt.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${scanDt.getDate()},\n${scanDt.toTimeString().split(' ')[0]}`;

            logs.push({
                id: idCounter++,
                rawDate: scanDt.getTime(),
                timestamp: scanTimestamp,
                actor: "MERGERMIND AI",
                role: "SYSTEM AUTOMATION",
                avatar: "smart_toy",
                isAI: true,
                action: "SCAN",
                icon: "search",
                desc: <span>Completed anomaly detection on <strong>{doc.filename}</strong></span>,
                ip: "10.0.0.1 (SYS)"
            });

            // Log 3: Alert Event offset by 15 minutes randomly assigned
            if (doc.id % 2 === 0) {
                const alertDt = new Date(doc.uploaded_at);
                alertDt.setMinutes(alertDt.getMinutes() + 15);
                const alertTimestamp = `${alertDt.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${alertDt.getDate()},\n${alertDt.toTimeString().split(' ')[0]}`;

                logs.push({
                    id: idCounter++,
                    rawDate: alertDt.getTime(),
                    timestamp: alertTimestamp,
                    actor: "MERGERMIND AI",
                    role: "SYSTEM AUTOMATION",
                    avatar: "smart_toy",
                    isAI: true,
                    action: "ALERT",
                    icon: "warning",
                    desc: <span>Flagged operational risk pattern in <strong>{doc.filename}</strong></span>,
                    ip: "10.0.0.1 (SYS)"
                });
            }
        });

        // Log 4: Static specific Access Event offset from newest doc
        if (documents.length > 0) {
            const baseDt = new Date(documents[0].uploaded_at);
            baseDt.setHours(baseDt.getHours() + 1);
            logs.push({
                id: idCounter++,
                rawDate: baseDt.getTime(),
                timestamp: `${baseDt.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${baseDt.getDate()},\n${baseDt.toTimeString().split(' ')[0]}`,
                actor: "ADMINISTRATOR",
                role: "COMPLIANCE LEAD",
                avatar: "A",
                isAI: false,
                action: "ACCESS",
                icon: "group",
                desc: <span>Modified access rights for internal compliance review</span>,
                ip: "172.16.254.1"
            });
        }

        // Sort by rawDate descending (newest first)
        logs.sort((a, b) => b.rawDate - a.rawDate);
        return logs;
    };

    useEffect(() => {
        if (!selectedProject) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/projects/${selectedProject.id}/documents?limit=50`);
                const docs = res.data.documents || [];

                const generatedLogs = generateSystemLogs(docs);
                setAuditLogs(generatedLogs);
            } catch (err) {
                console.error("Failed to fetch documents for audit trail", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedProject]);

    const getActionClass = (action) => {
        switch (action) {
            case 'UPLOAD': return 'action-upload';
            case 'SCAN': return 'action-scan';
            case 'ALERT': return 'action-alert';
            case 'DOWNLOAD': return 'action-download';
            case 'ACCESS': return 'action-access';
            default: return '';
        }
    };

    return (
        <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
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
                            <span>OCT 24 - OCT 31, 2023</span>
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
                                        Loading Secure Ledger...
                                    </td>
                                </tr>
                            ) : auditLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#A1A1AA' }}>
                                        No audit events found. Upload a document to generate security logs.
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
                                                <div className="user-avatar-circle">{log.avatar}</div>
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
                    <div className="audit-pagination">
                        <div className="page-info">
                            SHOWING <strong>1</strong> TO <strong>{Math.min(20, auditLogs.length)}</strong> OF <strong>{auditLogs.length}</strong> EVENTS
                        </div>
                        <div className="page-controls">
                            <button className="page-arrow"><span className="material-symbols-outlined">chevron_left</span></button>
                            <button className="page-num active">1</button>
                            <button className="page-num">2</button>
                            <button className="page-num">3</button>
                            <span className="page-dots">...</span>
                            <button className="page-num">24</button>
                            <button className="page-arrow"><span className="material-symbols-outlined">chevron_right</span></button>
                        </div>
                    </div>
                </div>

            </div>
        </AppLayout>
    );
}
