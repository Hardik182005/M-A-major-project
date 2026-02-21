import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import './DocumentViewerPage.css';

export default function DocumentViewerPage() {
    const { docId } = useParams();
    const navigate = useNavigate();
    const [document, setDocument] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Here we would ideally fetch the specific document by ID. 
        // For demonstration (since the exact generic GET /documents/{id} might not completely exist without projects on this layer),
        // we will fetch projects and scan for the doc, or just mock it cleanly directly representing the exact logic.

        // Mocking the document object based on exact provided logic rules since the UI requires deep AI states
        setDocument({
            id: docId,
            filename: "vendor_agreement_acme.pdf",
            version: "3",
            file_size: "2.4 MB",
            checksum: "8a9d8f...f4e2b1",
            page_count: 12,
            created_by: "Johnathan Doe",
            created_at: "Oct 24, 2023 14:32 PST"
        });
        setLoading(false);
    }, [docId]);

    if (loading || !document) {
        return <div className="viewer-loading">Loading Document Workspace...</div>;
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
                            Page <strong>3</strong> of 12
                        </div>
                        <div className="pdf-actions">
                            <button><span className="material-symbols-outlined">print</span></button>
                            <button><span className="material-symbols-outlined">download</span></button>
                            <button><span className="material-symbols-outlined">search</span></button>
                        </div>
                    </div>

                    <div className="pdf-render-area">
                        {/* Mock PDF Content representing the exact layout */}
                        <div className="pdf-mock-page">
                            <h2>VENDOR AGREEMENT</h2>
                            <span className="doc-ref">Doc Ref: VA-2023-ACME-003</span>

                            <p><strong>3.1 SERVICES.</strong> Vendor agrees to provide the services described in Exhibit A attached hereto (the "Services") in a professional and workmanlike manner, consistent with industry standards.</p>

                            <div className="pdf-highlight red-highlight">
                                <p><strong>3.2 FEES AND PAYMENT.</strong> Client shall pay Vendor the fees set forth in Exhibit A. Unless otherwise stated, all invoices are due within thirty (30) days of receipt. Total project cost is estimated at $24,500.00 USD, payable in installments.</p>
                            </div>

                            <p><strong>3.3 CONFIDENTIALITY.</strong> Both parties agree to hold all Confidential Information in strict confidence and not to disclose such information to any third party without prior written consent.</p>

                            <div className="pdf-highlight yellow-highlight">
                                <p><strong>3.4 DATA PRIVACY.</strong> Vendor acknowledges that it may have access to Personally Identifiable Information (PII) including but not limited to employee names and social security numbers. For example, primary contact validation requires SSN: <span className="redacted">XXX-XX-XXXX</span>.</p>
                            </div>

                            <p><strong>3.5 INTELLECTUAL PROPERTY.</strong> All deliverables created under this Agreement shall be considered "works made for hire" and shall be the exclusive property of Client.</p>

                            <div className="pdf-highlight grey-highlight" style={{ textAlign: 'center', color: '#71717A', fontStyle: 'italic', padding: '12px' }}>
                                [ Missing: Termination Clause ]
                            </div>

                            <p><strong>5.1 GOVERNING LAW.</strong> This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.</p>

                            <div className="signatures">
                                <div className="sig-line">CLIENT SIGNATURE</div>
                                <div className="sig-line">VENDOR SIGNATURE</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
