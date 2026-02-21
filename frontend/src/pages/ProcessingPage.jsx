import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import './ProcessingPage.css';

export default function ProcessingPage() {
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);

    return (
        <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
            <div className="processing-container fade-in">

                {/* Header Section */}
                <div className="processing-header-section">
                    <div className="processing-titles">
                        <h1 className="font-display">PROCESSING PIPELINE</h1>
                        <p>Monitoring document ingestion batch <strong>#4829</strong></p>
                    </div>
                    <div className="processing-actions">
                        <button className="proc-btn-secondary">
                            <span className="material-symbols-outlined">refresh</span>
                            REFRESH
                        </button>
                        <button className="proc-btn-primary" onClick={() => navigate('/documents')}>
                            <span className="material-symbols-outlined">add</span>
                            NEW BATCH
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="proc-cards-grid">
                    <div className="proc-card">
                        <div className="proc-card-header">
                            <span className="proc-card-title">PENDING</span>
                            <div className="proc-icon-box bg-light">
                                <span className="material-symbols-outlined">hourglass_empty</span>
                            </div>
                        </div>
                        <div className="proc-card-value">20</div>
                    </div>

                    <div className="proc-card active-card">
                        <div className="proc-card-header">
                            <span className="proc-card-title">ACTIVE</span>
                            <div className="proc-icon-box bg-dark">
                                <span className="material-symbols-outlined" style={{ color: 'white' }}>memory</span>
                            </div>
                        </div>
                        <div className="proc-card-value">60</div>
                    </div>

                    <div className="proc-card">
                        <div className="proc-card-header">
                            <span className="proc-card-title">COMPLETED</span>
                            <div className="proc-icon-box bg-black-circle">
                                <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '18px' }}>check</span>
                            </div>
                        </div>
                        <div className="proc-card-value">62</div>
                    </div>
                </div>

                {/* Live Processing Flow */}
                <div className="proc-flow-section">
                    <div className="proc-flow-header">
                        <span className="section-title-sm">LIVE PROCESSING FLOW</span>
                        <div className="eta-badge">EST. REMAINING: 14M 20S</div>
                    </div>

                    <div className="flow-stepper">
                        <div className="step completed">
                            <div className="step-icon"><span className="material-symbols-outlined">check</span></div>
                            <div className="step-label">UPLOADED</div>
                        </div>
                        <div className="step-line completed-line"></div>

                        <div className="step completed">
                            <div className="step-icon"><span className="material-symbols-outlined">check</span></div>
                            <div className="step-label">TEXT EXTRACTION</div>
                        </div>
                        <div className="step-line completed-line"></div>

                        <div className="step completed">
                            <div className="step-icon"><span className="material-symbols-outlined">check</span></div>
                            <div className="step-label">PII SCANNING</div>
                        </div>
                        <div className="step-line active-line"></div>

                        <div className="step active">
                            <div className="step-icon"><span className="material-symbols-outlined">settings_suggest</span></div>
                            <div className="step-label">STRUCTURING</div>
                        </div>
                        <div className="step-line pending-line"></div>

                        <div className="step pending">
                            <div className="step-icon"><span className="material-symbols-outlined">psychology</span></div>
                            <div className="step-label">AI ANALYSIS</div>
                        </div>
                        <div className="step-line pending-line"></div>

                        <div className="step pending">
                            <div className="step-icon"><span className="material-symbols-outlined">database</span></div>
                            <div className="step-label">INDEXING</div>
                        </div>
                    </div>
                </div>

                {/* Document Queue */}
                <div className="proc-queue-section">
                    <div className="queue-header">
                        <span className="section-title-md">DOCUMENT QUEUE</span>
                        <div className="queue-tabs">
                            <button className="q-tab active">ALL</button>
                            <button className="q-tab">ACTIVE</button>
                            <button className="q-tab">QUEUED</button>
                        </div>
                    </div>

                    <div className="table-wrapper">
                        <table className="proc-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '30%' }}>DOCUMENT</th>
                                    <th style={{ width: '15%' }}>STAGE</th>
                                    <th style={{ width: '25%' }}>PROGRESS</th>
                                    <th style={{ width: '15%' }}>TIMESTAMP</th>
                                    <th style={{ width: '10%' }}>ETA</th>
                                    <th style={{ width: '5%', textAlign: 'right' }}>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        <div className="doc-cell">
                                            <div className="doc-icon dark-bg"><span className="material-symbols-outlined">description</span></div>
                                            <div>
                                                <div className="doc-name">merger_agreement_v2.pdf</div>
                                                <div className="doc-uid">UID: 8829-AX</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td><span className="stage-badge stage-active">STRUCTURING</span></td>
                                    <td>
                                        <div className="progress-cell">
                                            <div className="progress-bar-container">
                                                <div className="progress-segment fill"></div>
                                                <div className="progress-segment fill"></div>
                                                <div className="progress-segment fill"></div>
                                                <div className="progress-segment empty"></div>
                                                <div className="progress-segment empty"></div>
                                            </div>
                                            <span className="progress-pct">60%</span>
                                        </div>
                                    </td>
                                    <td className="time-text">10:42:12 AM</td>
                                    <td className="eta-text">~45s</td>
                                    <td style={{ textAlign: 'right' }}><button className="menu-btn"><span className="material-symbols-outlined">more_horiz</span></button></td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className="doc-cell">
                                            <div className="doc-icon light-bg"><span className="material-symbols-outlined">article</span></div>
                                            <div>
                                                <div className="doc-name">financials_Q3_2023.docx</div>
                                                <div className="doc-uid">UID: 8830-BY</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td><span className="stage-badge stage-pending">PII SCAN</span></td>
                                    <td>
                                        <div className="progress-cell">
                                            <div className="progress-bar-container">
                                                <div className="progress-segment fill"></div>
                                                <div className="progress-segment empty"></div>
                                                <div className="progress-segment empty"></div>
                                                <div className="progress-segment empty"></div>
                                                <div className="progress-segment empty"></div>
                                            </div>
                                            <span className="progress-pct">20%</span>
                                        </div>
                                    </td>
                                    <td className="time-text">10:42:15 AM</td>
                                    <td className="eta-text">~2m</td>
                                    <td style={{ textAlign: 'right' }}><button className="menu-btn"><span className="material-symbols-outlined">more_horiz</span></button></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Exceptions Detected */}
                <div className="exceptions-section">
                    <div className="exceptions-header">
                        <div className="exceptions-title-area">
                            <span className="material-symbols-outlined error-icon">error</span>
                            <div>
                                <h3>EXCEPTIONS DETECTED (2)</h3>
                                <p className="error-subtitle">IMMEDIATE ACTION REQUIRED</p>
                            </div>
                        </div>
                        <button className="menu-btn"><span className="material-symbols-outlined">expand_less</span></button>
                    </div>

                    <div className="exception-items">
                        <div className="exception-item">
                            <div className="ex-icon-col">
                                <div className="ex-icon outline-err"><span className="material-symbols-outlined">cancel</span></div>
                            </div>
                            <div className="ex-info-col">
                                <div className="ex-doc-name">TAX_REPORT_DRAFT.PDF</div>
                                <div className="ex-err-code">ERR_CORRUPT_HEADER: FILE SIGNATURE MISMATCH</div>
                            </div>
                            <div className="ex-actions-col">
                                <button className="ex-btn-secondary">SKIP</button>
                                <button className="ex-btn-primary">RETRY UPLOAD</button>
                            </div>
                        </div>

                        <div className="exception-item">
                            <div className="ex-icon-col">
                                <div className="ex-icon outline-err"><span className="material-symbols-outlined">visibility_off</span></div>
                            </div>
                            <div className="ex-info-col">
                                <div className="ex-doc-name">SCAN_001.TIFF</div>
                                <div className="ex-err-code">ERR_OCR_LOW_CONFIDENCE: QUALITY {'<'} 40%</div>
                            </div>
                            <div className="ex-actions-col">
                                <button className="ex-btn-secondary">SKIP</button>
                                <button className="ex-btn-primary">RETRY ENHANCED</button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </AppLayout>
    );
}
