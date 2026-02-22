import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import api from '../api';
import './ProcessingPage.css';

export default function ProcessingPage() {
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ALL');

    // Fetch processing jobs when project is selected
    useEffect(() => {
        if (!selectedProject) {
            setLoading(false);
            return;
        }

        const fetchJobs = async () => {
            try {
                const res = await api.get(`/projects/${selectedProject.id}/processing/status`);
                if (res.data?.jobs) {
                    setJobs(res.data.jobs);
                }
            } catch (err) {
                console.error("Failed to load processing jobs:", err);
                setJobs([]);
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();

        // Poll for updates every 5 seconds
        const interval = setInterval(fetchJobs, 5000);
        return () => clearInterval(interval);
    }, [selectedProject]);

    // Calculate stats
    const pendingJobs = jobs.filter(j => j.status === 'QUEUED' || j.status === 'PENDING');
    const activeJobs = jobs.filter(j => j.status === 'PROCESSING' || j.status === 'RUNNING');
    const completedJobs = jobs.filter(j => j.status === 'COMPLETED' || j.status === 'READY');
    const failedJobs = jobs.filter(j => j.status === 'FAILED' || j.status === 'ERROR');

    // Filter jobs by tab
    const filteredJobs = activeTab === 'ALL'
        ? jobs
        : activeTab === 'ACTIVE'
            ? activeJobs
            : activeTab === 'QUEUED'
                ? pendingJobs
                : jobs;

    // Get current stage for flow stepper
    const getCurrentStage = () => {
        if (activeJobs.length > 0) {
            return activeJobs[0].stage || 'TEXT_EXTRACTION';
        }
        if (pendingJobs.length > 0) {
            return 'UPLOADED';
        }
        if (completedJobs.length > 0) {
            return 'COMPLETED';
        }
        return 'UPLOADED';
    };

    const currentStage = getCurrentStage();

    const isStageCompleted = (stage) => {
        if (currentStage === 'COMPLETED') return true;

        const stages = ['UPLOADED', 'TEXT_EXTRACTION', 'PII_SCANNING', 'STRUCTURING', 'ANALYSIS', 'INDEXING'];
        const currentIndex = stages.indexOf(currentStage);
        const stageIndex = stages.indexOf(stage);
        return stageIndex < currentIndex;
    };

    const isStageActive = (stage) => currentStage === stage;

    // Show project selection prompt if no project selected
    if (!selectedProject) {
        return (
            <AppLayout selectedProject={null} onSelectProject={setSelectedProject}>
                <div className="no-project-selected">
                    <span className="material-symbols-outlined">settings_suggest</span>
                    <h2>Select a Project</h2>
                    <p>Choose a project from the sidebar to view processing pipeline</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
            <div className="processing-container fade-in">

                {/* Header Section */}
                <div className="processing-header-section">
                    <div className="processing-titles">
                        <h1 className="font-display">PROCESSING PIPELINE</h1>
                        <p>Monitoring document processing for <strong>{selectedProject.name}</strong></p>
                    </div>
                    <div className="processing-actions">
                        <button className="proc-btn-secondary" onClick={() => window.location.reload()}>
                            <span className="material-symbols-outlined">refresh</span>
                            REFRESH
                        </button>
                        <button className="proc-btn-primary" onClick={() => navigate('/documents')}>
                            <span className="material-symbols-outlined">add</span>
                            NEW BATCH
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-container">
                        <span className="material-symbols-outlined spinning">progress_activity</span>
                        <p>Loading pipeline status...</p>
                    </div>
                ) : (
                    <>
                        {/* KPI Cards */}
                        <div className="proc-cards-grid">
                            <div className="proc-card">
                                <div className="proc-card-header">
                                    <span className="proc-card-title">PENDING</span>
                                    <div className="proc-icon-box bg-light">
                                        <span className="material-symbols-outlined">hourglass_empty</span>
                                    </div>
                                </div>
                                <div className="proc-card-value">{pendingJobs.length}</div>
                            </div>

                            <div className="proc-card active-card">
                                <div className="proc-card-header">
                                    <span className="proc-card-title">ACTIVE</span>
                                    <div className="proc-icon-box bg-dark">
                                        <span className="material-symbols-outlined" style={{ color: 'white' }}>memory</span>
                                    </div>
                                </div>
                                <div className="proc-card-value">{activeJobs.length}</div>
                            </div>

                            <div className="proc-card">
                                <div className="proc-card-header">
                                    <span className="proc-card-title">COMPLETED</span>
                                    <div className="proc-icon-box bg-black-circle">
                                        <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '18px' }}>check</span>
                                    </div>
                                </div>
                                <div className="proc-card-value">{completedJobs.length}</div>
                            </div>
                        </div>

                        {/* Live Processing Flow */}
                        <div className="proc-flow-section">
                            <div className="proc-flow-header">
                                <span className="section-title-sm">LIVE PROCESSING FLOW</span>
                                <div className="eta-badge">ACTIVE: {activeJobs.length} DOCUMENTS</div>
                            </div>

                            <div className="flow-stepper">
                                {['UPLOADED', 'TEXT_EXTRACTION', 'PII_SCANNING', 'STRUCTURING', 'ANALYSIS', 'INDEXING'].map((stage, idx) => (
                                    <React.Fragment key={stage}>
                                        <div className={`step ${isStageCompleted(stage) ? 'completed' : isStageActive(stage) ? 'active' : 'pending'}`}>
                                            <div className="step-icon">
                                                <span className="material-symbols-outlined">
                                                    {isStageCompleted(stage) ? 'check' :
                                                        stage === 'UPLOADED' ? 'upload' :
                                                            stage === 'TEXT_EXTRACTION' ? 'text_fields' :
                                                                stage === 'PII_SCANNING' ? 'security' :
                                                                    stage === 'STRUCTURING' ? 'account_tree' :
                                                                        stage === 'ANALYSIS' ? 'psychology' : 'database'}
                                                </span>
                                            </div>
                                            <div className="step-label">{stage.replace(/_/g, ' ')}</div>
                                        </div>
                                        {idx < 5 && (
                                            <div className={`step-line ${isStageCompleted(stage) ? 'completed-line' : isStageActive(stage) ? 'active-line' : 'pending-line'}`}></div>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        {/* Document Queue */}
                        <div className="proc-queue-section">
                            <div className="queue-header">
                                <span className="section-title-md">DOCUMENT QUEUE</span>
                                <div className="queue-tabs">
                                    {['ALL', 'ACTIVE', 'QUEUED'].map(tab => (
                                        <button
                                            key={tab}
                                            className={`q-tab ${activeTab === tab ? 'active' : ''}`}
                                            onClick={() => setActiveTab(tab)}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="table-wrapper">
                                {filteredJobs.length > 0 ? (
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
                                            {filteredJobs.map((job) => (
                                                <tr key={job.id}>
                                                    <td>
                                                        <div className="doc-cell">
                                                            <div className="doc-icon dark-bg">
                                                                <span className="material-symbols-outlined">description</span>
                                                            </div>
                                                            <div>
                                                                <div className="doc-name">{job.doc_name || `Document ${job.doc_id}`}</div>
                                                                <div className="doc-uid">ID: {job.doc_id}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`stage-badge ${job.status === 'PROCESSING' ? 'stage-active' : job.status === 'FAILED' ? 'stage-error' : 'stage-pending'}`}>
                                                            {job.stage?.replace(/_/g, ' ') || 'PENDING'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="progress-cell">
                                                            <div className="progress-bar-container">
                                                                {[20, 40, 60, 80, 100].map((threshold, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className={`progress-segment ${(job.progress || 0) >= threshold ? 'fill' : 'empty'}`}
                                                                    ></div>
                                                                ))}
                                                            </div>
                                                            <span className="progress-pct">{job.progress || 0}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="time-text">
                                                        {job.updated_at ? new Date(job.updated_at).toLocaleTimeString() : '--:--:--'}
                                                    </td>
                                                    <td className="eta-text">{job.eta_seconds ? `~${Math.round(job.eta_seconds / 60)}m` : '--'}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button className="menu-btn">
                                                            <span className="material-symbols-outlined">more_horiz</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="empty-state">
                                        <span className="material-symbols-outlined">hourglass_empty</span>
                                        <p>No documents in queue</p>
                                        <button className="upload-link" onClick={() => navigate('/documents')}>
                                            Upload documents to start processing
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Exceptions Detected */}
                        {failedJobs.length > 0 && (
                            <div className="exceptions-section">
                                <div className="exceptions-header">
                                    <div className="exceptions-title-area">
                                        <span className="material-symbols-outlined error-icon">error</span>
                                        <div>
                                            <h3>EXCEPTIONS DETECTED ({failedJobs.length})</h3>
                                            <p className="error-subtitle">IMMEDIATE ACTION REQUIRED</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="exception-items">
                                    {failedJobs.map((job) => (
                                        <div className="exception-item" key={job.id}>
                                            <div className="ex-icon-col">
                                                <div className="ex-icon outline-err">
                                                    <span className="material-symbols-outlined">cancel</span>
                                                </div>
                                            </div>
                                            <div className="ex-info-col">
                                                <div className="ex-doc-name">{job.doc_name || `Document ${job.doc_id}`}</div>
                                                <div className="ex-err-code">{job.error_code || 'PROCESSING_ERROR'}: {job.error_msg || 'Unknown error'}</div>
                                            </div>
                                            <div className="ex-actions-col">
                                                <button className="ex-btn-secondary">SKIP</button>
                                                <button className="ex-btn-primary">RETRY</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
