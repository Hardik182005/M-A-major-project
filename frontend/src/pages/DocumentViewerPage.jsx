import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, {
    getDocumentText,
    getDocumentClassification,
    getPIIEntities,
    getDocumentFindings,
    getStructuredData,
    downloadDocumentBlob
} from '../api';
import './DocumentViewerPage.css';

export default function DocumentViewerPage() {
    const { docId } = useParams();
    const navigate = useNavigate();
    const [document, setDocument] = useState(null);
    const [documentText, setDocumentText] = useState(null);
    const [classification, setClassification] = useState(null);
    const [piiEntities, setPiiEntities] = useState([]);
    const [findings, setFindings] = useState([]);
    const [structuredData, setStructuredData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
    const [activeTab, setActiveTab] = useState('AI Findings');
    const [showAnnotatedText, setShowAnnotatedText] = useState(false);
    const [reprocessing, setReprocessing] = useState(false);

    useEffect(() => {
        const fetchDocumentData = async () => {
            setLoading(true);
            try {
                // Fetch document details from projects endpoint
                const projectsRes = await api.get('/projects');
                let foundDoc = null;

                if (projectsRes.data) {
                    const projects = Array.isArray(projectsRes.data) ? projectsRes.data : (projectsRes.data.projects || []);
                    for (const project of projects) {
                        const docsRes = await api.get(`/projects/${project.id}/documents`);
                        if (docsRes.data?.documents) {
                            foundDoc = docsRes.data.documents.find(d => d.id === parseInt(docId));
                            if (foundDoc) {
                                foundDoc.projectId = project.id;
                                break;
                            }
                        }
                    }
                }

                if (foundDoc) {
                    setDocument(foundDoc);

                    // Fetch all related data in parallel
                    const [textRes, classRes, piiRes, findingsRes, structRes, blobRes] = await Promise.all([
                        getDocumentText(docId).catch(() => ({ data: null })),
                        getDocumentClassification(docId).catch(() => ({ data: null })),
                        getPIIEntities(docId).catch(() => ({ data: null })),
                        getDocumentFindings(docId).catch(() => ({ data: null })),
                        getStructuredData(docId).catch(() => ({ data: null })),
                        downloadDocumentBlob(docId).catch(() => ({ data: null }))
                    ]);

                    if (textRes.data) setDocumentText(textRes.data);
                    if (classRes.data) setClassification(classRes.data);
                    // PII comes either as array directly or { entities: [] }
                    if (Array.isArray(piiRes.data)) setPiiEntities(piiRes.data);
                    else if (piiRes.data?.entities) setPiiEntities(piiRes.data.entities);
                    if (findingsRes.data?.findings) setFindings(findingsRes.data.findings);
                    if (structRes.data) setStructuredData(structRes.data);
                    if (blobRes.data) {
                        const objectUrl = URL.createObjectURL(blobRes.data);
                        setPdfBlobUrl(objectUrl);
                    }
                }
            } catch (err) {
                console.error("Failed to load document:", err);
            } finally {
                setLoading(false);
            }
        };

        if (docId) {
            fetchDocumentData();
        }

        // Cleanup URL memory leak
        return () => {
            if (pdfBlobUrl) {
                URL.revokeObjectURL(pdfBlobUrl);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docId]);

    // Auto-show annotated text when text is available (for keyword highlighting)
    useEffect(() => {
        if (documentText?.text) {
            setShowAnnotatedText(true);
        }
    }, [documentText, piiEntities, findings]);

    // Risk keywords to auto-detect in document text
    const RISK_KEYWORDS = {
        FINANCIAL: ['discrepancy', 'overdue', 'write-off', 'adjusted EBITDA', 'cash burn', 'restructuring costs', 'settlement', 'liability', 'revenue decline', 'loss', 'negative', 'deficit', 'shortfall', 'impairment', 'depreciation', 'accounts receivable', 'unpaid', 'outstanding balance', 'penalty', 'overstatement', 'understatement'],
        LEGAL: ['litigation', 'lawsuit', 'legal dispute', 'non-compete', 'indemnification', 'breach', 'violation', 'regulatory', 'compliance gap', 'intellectual property', 'patent infringement', 'arbitration', 'injunction', 'termination clause', 'force majeure'],
        OPERATIONAL: ['customer concentration', 'single vendor', 'key person', 'employee turnover', 'data breach', 'service disruption', 'supply chain', 'scalability concern', 'technical debt', 'SaaS restructuring'],
    };

    // Highlight function that applies color-coded annotations
    const highlightText = (text) => {
        let htmlText = text;

        // 1. Highlight AI Findings (red underline - most important)
        findings.forEach(finding => {
            const quote = finding.evidence_quote || finding.evidence;
            if (quote && quote.length > 5) {
                try {
                    const escaped = quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const severityClass = finding.severity === 'CRITICAL' ? 'critical-highlight' :
                        finding.severity === 'HIGH' ? 'high-highlight' :
                            finding.severity === 'MEDIUM' ? 'medium-highlight' : 'low-highlight';
                    htmlText = htmlText.replace(new RegExp(escaped, 'gi'),
                        `<span class="pdf-highlight ${severityClass}" title="[${finding.severity}] ${finding.category}: ${finding.description}">$&</span>`);
                } catch (e) { }
            }
        });

        // 2. Highlight PII (yellow)
        piiEntities.forEach(entity => {
            const entText = entity.original_text || entity.text;
            if (entText && entText.length > 1) {
                try {
                    const escaped = entText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    htmlText = htmlText.replace(new RegExp(escaped, 'gi'),
                        `<span class="pdf-highlight pii-highlight" title="PII: ${entity.label} (${entText})">$&</span>`);
                } catch (e) { }
            }
        });

        // 3. Auto-detect risk keywords (only if no findings from AI)
        if (findings.length === 0) {
            Object.entries(RISK_KEYWORDS).forEach(([category, keywords]) => {
                keywords.forEach(keyword => {
                    try {
                        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(`(${escaped})`, 'gi');
                        const colorClass = category === 'FINANCIAL' ? 'financial-keyword' :
                            category === 'LEGAL' ? 'legal-keyword' : 'operational-keyword';
                        htmlText = htmlText.replace(regex,
                            `<span class="pdf-highlight ${colorClass}" title="${category} Risk Indicator">$1</span>`);
                    } catch (e) { }
                });
            });
        }

        return htmlText;
    };

    // Group findings by severity
    const criticalFindings = findings.filter(f => f.severity === 'CRITICAL');
    const highFindings = findings.filter(f => f.severity === 'HIGH');
    const mediumFindings = findings.filter(f => f.severity === 'MEDIUM');
    const lowFindings = findings.filter(f => f.severity === 'LOW');

    if (loading) {
        return (
            <div className="viewer-loading">
                <span className="material-symbols-outlined spinning">progress_activity</span>
                <p>Loading Document Workspace...</p>
            </div>
        );
    }

    if (!document) {
        return (
            <div className="viewer-loading">
                <span className="material-symbols-outlined">error</span>
                <p>Document not found</p>
                <button onClick={() => navigate('/documents')}>Back to Documents</button>
            </div>
        );
    }

    return (
        <div className="viewer-layout">
            {/* Topbar */}
            <header className="viewer-header">
                <div className="viewer-header-left">
                    <button className="back-btn" onClick={() => navigate('/documents')}>
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="viewer-breadcrumbs">
                        <span className="breadcrumb-path" onClick={() => navigate('/documents')}>Documents</span>
                        <span className="breadcrumb-separator">/</span>
                        <span className="breadcrumb-current">{document.filename}</span>
                        <span className="breadcrumb-separator">/</span>
                        <span className="breadcrumb-version">v{document.version}</span>
                    </div>
                </div>
                <div className="viewer-header-right">
                    <button className="icon-btn"><span className="material-symbols-outlined">notifications</span></button>
                    <div className="viewer-user">
                        <div className="viewer-avatar">JD</div>
                        <span className="viewer-username">Jane Doe</span>
                    </div>
                </div>
            </header>

            <div className="viewer-content">
                {/* Left Side: Document Renderer */}
                <div className="viewer-main">
                    <div className="pdf-toolbar">
                        <div className="pdf-zoom">
                            <button><span className="material-symbols-outlined">remove</span></button>
                            <span>100%</span>
                            <button><span className="material-symbols-outlined">add</span></button>
                        </div>
                        <div className="pdf-pages">
                            <span className="material-symbols-outlined">description</span>
                            Page <strong>1</strong> of {document.page_count || 1}
                        </div>
                        <div className="pdf-actions">
                            <button><span className="material-symbols-outlined">print</span></button>
                            <button><span className="material-symbols-outlined">download</span></button>
                            <button><span className="material-symbols-outlined">search</span></button>
                        </div>
                    </div>

                    {/* Toggle button for annotated text view */}
                    {documentText?.text && (
                        <div className="annotated-toggle">
                            <button
                                className={`toggle-annotated-btn ${showAnnotatedText ? 'active' : ''}`}
                                onClick={() => setShowAnnotatedText(!showAnnotatedText)}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{showAnnotatedText ? 'picture_as_pdf' : 'text_snippet'}</span>
                                {showAnnotatedText ? 'Show PDF' : 'Show Annotated Text'}
                            </button>
                            <div className="highlight-legend">
                                {findings.length > 0 && <span className="legend-item"><span className="legend-dot" style={{ background: '#FEE2E2', border: '2px solid #EF4444' }}></span> AI Findings</span>}
                                {piiEntities.length > 0 && <span className="legend-item"><span className="legend-dot" style={{ background: '#FEF9C3', border: '2px solid #EAB308' }}></span> PII Data</span>}
                                {findings.length === 0 && <>
                                    <span className="legend-item"><span className="legend-dot" style={{ background: '#FEE2E2', border: '2px solid #EF4444' }}></span> Financial</span>
                                    <span className="legend-item"><span className="legend-dot" style={{ background: '#FFEDD5', border: '2px solid #F97316' }}></span> Legal</span>
                                    <span className="legend-item"><span className="legend-dot" style={{ background: '#F3E8FF', border: '2px solid #A855F7' }}></span> Operational</span>
                                </>}
                            </div>
                        </div>
                    )}

                    <div className="pdf-render-area">
                        {showAnnotatedText && documentText?.text ? (
                            <div className="pdf-mock-page annotated-text-view">
                                <div className="document-text">
                                    {documentText.text.split('\n').map((paragraph, idx) => {
                                        if (!paragraph.trim()) return <p key={idx}>&nbsp;</p>;
                                        return <p key={idx} dangerouslySetInnerHTML={{ __html: highlightText(paragraph) }}></p>;
                                    })}
                                </div>
                            </div>
                        ) : (document.file_type === 'application/pdf' || document.file_type?.startsWith('image/')) ? (
                            pdfBlobUrl ? (
                                <iframe
                                    src={pdfBlobUrl}
                                    className="pdf-viewer"
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                    title={document.filename}
                                />
                            ) : (
                                <div className="pdf-mock-page">
                                    <span className="material-symbols-outlined spinning">progress_activity</span>
                                    <p>Loading document viewer...</p>
                                </div>
                            )
                        ) : (
                            <div className="pdf-mock-page">
                                {documentText?.text ? (
                                    <div className="document-text">
                                        {documentText.text.split('\n').map((paragraph, idx) => {
                                            if (!paragraph.trim()) return <p key={idx}>&nbsp;</p>;
                                            return <p key={idx} dangerouslySetInnerHTML={{ __html: highlightText(paragraph) }}></p>;
                                        })}
                                    </div>
                                ) : (
                                    <div className="no-text-placeholder">
                                        <span className="material-symbols-outlined">description</span>
                                        <h3>{document.filename}</h3>
                                        <p>Document text extraction pending or not available.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Insights Sidebar */}
                <aside className="insights-sidebar">
                    <div className="insights-header">
                        <h2>Insights</h2>
                        <div className="insights-tabs-pills">
                            <button
                                className={`pill-tab ${activeTab === 'Metadata' ? 'active' : ''}`}
                                onClick={() => setActiveTab('Metadata')}
                            >
                                Metadata
                            </button>
                            <button
                                className={`pill-tab ${activeTab === 'Extracted Data' ? 'active' : ''}`}
                                onClick={() => setActiveTab('Extracted Data')}
                            >
                                Extracted Data
                            </button>
                            <button
                                className={`pill-tab ${activeTab === 'PII Detected' ? 'active' : ''}`}
                                onClick={() => setActiveTab('PII Detected')}
                            >
                                PII Detected {piiEntities.length > 0 && <span className="dot orange-dot"></span>}
                            </button>
                            <button
                                className={`pill-tab ${activeTab === 'AI Findings' ? 'active' : ''}`}
                                onClick={() => setActiveTab('AI Findings')}
                            >
                                AI Findings {findings.length > 0 && <span className="dot red-dot"></span>}
                            </button>
                        </div>
                    </div>

                    <div className="insights-scroll-area">
                        {activeTab === 'Metadata' && (
                            <div className="metadata-content fade-in">
                                <div className="insight-card">
                                    <h3>Document Information</h3>
                                    <div className="meta-grid">
                                        <div className="meta-item">
                                            <span className="meta-label">Filename</span>
                                            <span className="meta-value">{document.filename}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Type</span>
                                            <span className="meta-value">{classification?.doc_type || document.file_type || 'Unknown'}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Sensitivity</span>
                                            <span className="meta-value">{classification?.sensitivity || 'N/A'}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Pages</span>
                                            <span className="meta-value">{document.page_count || 'N/A'}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Version</span>
                                            <span className="meta-value">v{document.version}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Checksum</span>
                                            <span className="meta-value mono">{document.checksum?.substring(0, 12) || 'N/A'}...</span>
                                        </div>
                                    </div>
                                    {classification?.tags && (
                                        <div className="tags-section">
                                            <span className="meta-label">Tags</span>
                                            <div className="tags-list">
                                                {classification.tags.map((tag, i) => (
                                                    <span key={i} className="tag">{tag}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'Extracted Data' && (
                            <div className="extracted-content fade-in">
                                {structuredData?.json_blob ? (
                                    <div className="insight-card">
                                        <h3>Structured Data</h3>
                                        <pre className="json-display">
                                            {JSON.stringify(structuredData.json_blob, null, 2)}
                                        </pre>
                                    </div>
                                ) : (
                                    <div className="tab-placeholder">
                                        <span className="material-symbols-outlined">table_document</span>
                                        <h3>No Structured Data</h3>
                                        <p>Structured data extraction is pending or not available for this document type.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'PII Detected' && (
                            <div className="pii-content fade-in">
                                {piiEntities.length > 0 ? (
                                    <div className="pii-list">
                                        <div className="insight-card pii-summary">
                                            <h3>{piiEntities.length} PII Entities Detected</h3>
                                            <p className="pii-warning">Sensitive information has been identified and may require redaction.</p>
                                        </div>
                                        {piiEntities.map((entity, i) => (
                                            <div key={i} className="insight-card pii-item">
                                                <div className="pii-header">
                                                    <span className="pii-label">{entity.label}</span>
                                                    <span className="pii-confidence">{Math.round((entity.confidence || 0) * 100)}% confidence</span>
                                                </div>
                                                <div className="pii-text">"{entity.original_text || entity.text}"</div>
                                                {entity.replacement && (
                                                    <div className="pii-replacement">Replacement: {entity.replacement}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="tab-placeholder">
                                        <span className="material-symbols-outlined">verified_user</span>
                                        <h3>No PII Detected</h3>
                                        <p>No personally identifiable information was found in this document.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'AI Findings' && (
                            <div className="ai-findings-content fade-in">
                                {findings.length > 0 ? (
                                    <>
                                        {criticalFindings.length > 0 && (
                                            <>
                                                <div className="findings-group-title">Critical Risk Anomalies</div>
                                                {criticalFindings.map((finding) => (
                                                    <div key={finding.id} className="insight-card ai-risk-card-critical">
                                                        <h3 className="risk-card-title critical-title">
                                                            <span className="dot red-dot"></span> {finding.type}
                                                        </h3>
                                                        <p className="risk-card-desc">{finding.description}</p>
                                                        {finding.evidence && (
                                                            <div className="evidence">
                                                                <span>Page {finding.evidence.page || 'N/A'}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </>
                                        )}

                                        {highFindings.length > 0 && (
                                            <>
                                                <div className="findings-group-title" style={{ marginTop: '24px' }}>High Priority</div>
                                                {highFindings.map((finding) => (
                                                    <div key={finding.id} className="insight-card ai-risk-card-other">
                                                        <div className="other-finding-item">
                                                            <h4 className="other-finding-title">
                                                                <span className="dot orange-dot"></span> {finding.type}
                                                            </h4>
                                                            <p className="risk-card-desc">{finding.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </>
                                        )}

                                        {(mediumFindings.length > 0 || lowFindings.length > 0) && (
                                            <>
                                                <div className="findings-group-title" style={{ marginTop: '24px' }}>Other Findings</div>
                                                <div className="insight-card ai-risk-card-other">
                                                    {mediumFindings.map((finding) => (
                                                        <div key={finding.id} className="other-finding-item">
                                                            <h4 className="other-finding-title">
                                                                <span className="dot yellow-dot"></span> {finding.type}
                                                                {finding.category && <span className={`finding-category-badge category-${finding.category.toLowerCase()}`}>{finding.category}</span>}
                                                            </h4>
                                                            <p className="risk-card-desc">{finding.description}</p>
                                                        </div>
                                                    ))}
                                                    {lowFindings.map((finding) => (
                                                        <div key={finding.id} className="other-finding-item" style={{ margin: '16px 0' }}>
                                                            <h4 className="other-finding-title">
                                                                <span className="dot grey-dot"></span> {finding.type}
                                                                {finding.category && <span className={`finding-category-badge category-${finding.category.toLowerCase()}`}>{finding.category}</span>}
                                                            </h4>
                                                            <p className="risk-card-desc">{finding.description}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}

                                        <div className="insight-card risk-dist-card">
                                            <h3 className="risk-dist-title">RISK DISTRIBUTION</h3>
                                            <div className="risk-dist-bar">
                                                {criticalFindings.length > 0 && <div className="rd-segment bg-critical" style={{ width: `${(criticalFindings.length / findings.length) * 100}%` }}></div>}
                                                {highFindings.length > 0 && <div className="rd-segment bg-high" style={{ width: `${(highFindings.length / findings.length) * 100}%` }}></div>}
                                                {mediumFindings.length > 0 && <div className="rd-segment bg-medium" style={{ width: `${(mediumFindings.length / findings.length) * 100}%` }}></div>}
                                                {lowFindings.length > 0 && <div className="rd-segment bg-low" style={{ width: `${(lowFindings.length / findings.length) * 100}%` }}></div>}
                                            </div>
                                            <div className="risk-dist-legend">
                                                {criticalFindings.length > 0 && <div className="rdl-item"><span className="dot bg-critical"></span> {criticalFindings.length} CRITICAL</div>}
                                                {highFindings.length > 0 && <div className="rdl-item"><span className="dot bg-high"></span> {highFindings.length} HIGH</div>}
                                                {mediumFindings.length > 0 && <div className="rdl-item"><span className="dot bg-medium"></span> {mediumFindings.length} MEDIUM</div>}
                                                {lowFindings.length > 0 && <div className="rdl-item"><span className="dot bg-low"></span> {lowFindings.length} LOW</div>}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="tab-placeholder">
                                        <span className="material-symbols-outlined">check_circle</span>
                                        <h3>No Findings Yet</h3>
                                        <p>AI risk analysis has not generated findings for this document. You can re-run the analysis pipeline.</p>
                                        <button
                                            className="reprocess-btn"
                                            disabled={reprocessing}
                                            onClick={async () => {
                                                if (!document?.projectId) return;
                                                setReprocessing(true);
                                                try {
                                                    await api.post(`/projects/${document.projectId}/documents/${docId}/process`, { doc_id: parseInt(docId), force: true });
                                                    // Poll for completion
                                                    setTimeout(() => window.location.reload(), 15000);
                                                } catch (e) {
                                                    console.error('Reprocess error:', e);
                                                } finally {
                                                    setReprocessing(false);
                                                }
                                            }}
                                        >
                                            <span className="material-symbols-outlined">{reprocessing ? 'sync' : 'play_arrow'}</span>
                                            {reprocessing ? 'Running Analysis...' : 'Run AI Analysis'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="insights-footer">
                        <button
                            className="generate-report-btn"
                            onClick={() => navigate('/reports', { state: { projectId: document.projectId || document.project_id } })}
                        >
                            <span className="material-symbols-outlined">security</span>
                            Download Risk Assessment
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
}
