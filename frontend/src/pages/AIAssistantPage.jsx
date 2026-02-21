import React, { useState } from 'react';
import AppLayout from '../components/AppLayout';
import './AIAssistantPage.css';

export default function AIAssistantPage() {
    const [selectedProject, setSelectedProject] = useState({ name: 'Project Alpha', id: 'PA-001' });

    return (
        <AppLayout selectedProject={selectedProject?.name} onSelectProject={(name) => setSelectedProject({ name, id: 'PA-001' })}>
            <div className="ai-assistant-container fade-in">

                {/* Header Section */}
                <div className="ai-header">
                    <div className="breadcrumb-nav">
                        <span className="proj-name">Project Alpha</span>
                        <span className="material-symbols-outlined breadcrumb-arrow">chevron_right</span>
                        <span className="current-page">AI Due Diligence Assistant</span>
                    </div>
                </div>

                <div className="ai-layout">
                    {/* Main Chat Area */}
                    <div className="ai-chat-area">
                        <div className="chat-history">
                            <div className="chat-timestamp">Today, 10:23 AM</div>

                            {/* User Message */}
                            <div className="message-row user-row">
                                <div className="message-bubble user-bubble">
                                    What are the key risks identified in the supplier contracts for Q3, specifically regarding termination clauses?
                                </div>
                                <div className="message-avatar user-avatar-img">
                                    AM
                                </div>
                            </div>

                            {/* AI Message */}
                            <div className="message-row ai-row">
                                <div className="message-avatar ai-avatar-img">
                                    <span className="material-symbols-outlined">smart_toy</span>
                                </div>
                                <div className="message-content">
                                    <div className="message-bubble ai-bubble">
                                        <p>Based on the review of 12 supplier agreements in the Data Room, I've identified several primary risks. The analysis highlights inconsistencies in <strong>termination clauses</strong> and potential exposure in <strong>liability caps</strong>.</p>

                                        <p className="key-findings-title">Key Risk Findings:</p>
                                        <ul className="findings-list">
                                            <li><strong>Termination for Convenience:</strong> Found in 3 major contracts. This allows the supplier to exit with only 30 days' notice.</li>
                                            <li><strong>Liability Caps:</strong> Ambiguous language in 2 agreements regarding consequential damages.</li>
                                            <li><strong>Auto-Renewal:</strong> 5 contracts have auto-renewal clauses with a 90-day opt-out window which was missed in Q2.</li>
                                        </ul>

                                        <div className="sources-container">
                                            <div className="sources-label">SOURCES:</div>
                                            <div className="source-pill">
                                                <span className="material-symbols-outlined pdf-icon">picture_as_pdf</span>
                                                <span className="source-name">Supplier_Contract_A.pdf</span>
                                                <span className="source-page">p.14</span>
                                            </div>
                                            <div className="source-pill">
                                                <span className="material-symbols-outlined pdf-icon">picture_as_pdf</span>
                                                <span className="source-name">Vendor_Agreement_v2.pdf</span>
                                                <span className="source-page">p.08</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="message-footer">
                                        <span>MergerMind AI • 10:24 AM</span>
                                        <button className="icon-action-btn"><span className="material-symbols-outlined">content_copy</span></button>
                                        <button className="icon-action-btn"><span className="material-symbols-outlined">refresh</span></button>
                                        <button className="icon-action-btn"><span className="material-symbols-outlined">thumb_down</span></button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="chat-input-section">
                            <div className="suggested-prompts-row">
                                <button className="suggested-prompt-btn">Compare with last year's contracts</button>
                                <button className="suggested-prompt-btn">Generate executive summary</button>
                            </div>

                            <div className="chat-input-wrapper">
                                <button className="attach-btn"><span className="material-symbols-outlined">attach_file</span></button>
                                <input type="text" placeholder="Ask anything about this data room..." className="chat-input" />
                                <button className="send-btn"><span className="material-symbols-outlined">send</span></button>
                            </div>
                            <div className="disclaimer">
                                AI can make mistakes. Verify critical information against source documents.
                            </div>
                        </div>
                    </div>

                    {/* Right Panel */}
                    <aside className="ai-context-panel">

                        {/* Suggested Questions */}
                        <div className="context-section">
                            <div className="context-header">
                                <span className="material-symbols-outlined icon-blue">lightbulb</span>
                                <h3>Suggested Questions</h3>
                            </div>
                            <ul className="suggested-questions-list">
                                <li>
                                    <span className="material-symbols-outlined">subdirectory_arrow_right</span>
                                    <span>Summarize the EBITDA adjustments for FY2023.</span>
                                </li>
                                <li>
                                    <span className="material-symbols-outlined">subdirectory_arrow_right</span>
                                    <span>List all employees with change-of-control provisions.</span>
                                </li>
                                <li>
                                    <span className="material-symbols-outlined">subdirectory_arrow_right</span>
                                    <span>Show the org chart for the engineering department.</span>
                                </li>
                            </ul>
                        </div>

                        {/* Active References */}
                        <div className="context-section">
                            <div className="context-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="material-symbols-outlined icon-grey">description</span>
                                    <h3>Active References</h3>
                                </div>
                                <span className="files-count">2 files</span>
                            </div>
                            <div className="reference-cards">
                                <div className="ref-card">
                                    <div className="ref-icon-bg"><span className="material-symbols-outlined pdf-icon-lg">picture_as_pdf</span></div>
                                    <div className="ref-info">
                                        <div className="ref-name">Supplier_Contract_A.pdf</div>
                                        <div className="ref-meta">LEGAL • 2.4 MB</div>
                                        <div className="ref-desc">Contains standard terms, termination clauses, and liability caps referenced in section 4.1.</div>
                                    </div>
                                </div>
                                <div className="ref-card">
                                    <div className="ref-icon-bg"><span className="material-symbols-outlined pdf-icon-lg">picture_as_pdf</span></div>
                                    <div className="ref-info">
                                        <div className="ref-name">Vendor_Agreement_v2.pdf</div>
                                        <div className="ref-meta">PROCUREMENT • 1.8 MB</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Session History */}
                        <div className="context-section">
                            <div className="context-header">
                                <span className="material-symbols-outlined icon-grey">history</span>
                                <h3>Session History</h3>
                            </div>

                            <div className="history-group">
                                <div className="history-date">TODAY</div>
                                <div className="history-item active">
                                    <div className="history-title">Supplier Contracts Risk...</div>
                                    <div className="history-time">10:24 AM</div>
                                </div>
                                <div className="history-item">
                                    <div className="history-title">Q3 Revenue Breakdown</div>
                                    <div className="history-time">09:15 AM</div>
                                </div>
                            </div>

                            <div className="history-group">
                                <div className="history-date">YESTERDAY</div>
                                <div className="history-item">
                                    <div className="history-title">Competitor Analysis Report</div>
                                    <div className="history-time">4:30 PM</div>
                                </div>
                                <div className="history-item">
                                    <div className="history-title">Patent Portfolio Overview</div>
                                    <div className="history-time">1:15 PM</div>
                                </div>
                            </div>
                        </div>

                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}
