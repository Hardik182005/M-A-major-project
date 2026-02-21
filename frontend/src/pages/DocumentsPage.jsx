import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import api from '../api';
import './DocumentsPage.css';

export default function DocumentsPage() {
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);

    const [filters, setFilters] = useState({
        query: '',
        type: '',
        status: '',
        page: 1,
        pageSize: 10
    });

    const fetchDocuments = async (projId, currentFilters) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (currentFilters.query) params.append('filename', currentFilters.query);
            if (currentFilters.type) params.append('file_type', currentFilters.type);
            if (currentFilters.status) params.append('status', currentFilters.status);
            params.append('limit', currentFilters.pageSize);
            params.append('offset', (currentFilters.page - 1) * currentFilters.pageSize);
            params.append('sort_by', 'uploaded_at');
            params.append('sort_order', 'desc');

            const res = await api.get(`/projects/${projId}/documents?${params.toString()}`);
            setDocuments(res.data.documents || []);
            setTotal(res.data.total || 0);
        } catch (err) {
            console.error("Failed to fetch documents", err);
        } finally {
            setLoading(false);
        }
    };

    // Debounce search query changes
    useEffect(() => {
        if (!selectedProject) return;
        const timer = setTimeout(() => {
            fetchDocuments(selectedProject.id, filters);
        }, 500);
        return () => clearTimeout(timer);
    }, [selectedProject, filters]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
    };

    const handleFileUpload = async (e) => {
        if (!selectedProject || !e.target.files.length) return;
        const file = e.target.files[0];

        try {
            const formData = new FormData();
            formData.append('file', file);

            await api.post(`/projects/${selectedProject.id}/documents/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Refresh list
            fetchDocuments(selectedProject.id, filters);
            alert("Upload Success!");
        } catch (err) {
            const msg = err.response?.data?.detail || "Upload failed";
            alert("Upload failed: " + msg);
        }
        e.target.value = null; // reset input
    };

    const handleDelete = async (docId) => {
        if (!window.confirm("Are you sure you want to delete this document?")) return;
        try {
            await api.delete(`/projects/${selectedProject.id}/documents/${docId}`);
            fetchDocuments(selectedProject.id, filters);
        } catch (err) {
            alert("Failed to delete. You may not have Admin permissions.");
        }
    };

    const handleDownload = async (docId, filename) => {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/documents/${docId}/download`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Download failed");

            // Trigger browser download via Blob
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error(err);
            alert("Could not download file.");
        }
    };

    const StatusPill = ({ status }) => {
        let cls = 'status-ready';
        let lbl = status;
        let icon = 'check_circle';

        if (status === 'UPLOADING' || status === 'PROCESSING') {
            cls = 'status-processing';
            icon = 'sync';
        } else if (status === 'FAILED') {
            cls = 'status-failed';
            icon = 'error';
        } else if (status === 'READY') {
            cls = 'status-ready';
        }

        return (
            <span className={`status-pill ${cls}`}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{icon}</span>
                {lbl}
            </span>
        );
    };

    const getFileIcon = (file) => {
        const typeStr = (file.file_type || file.filename || '').toLowerCase();

        if (typeStr.includes('pdf')) {
            return <span className="material-symbols-outlined" style={{ color: '#EF4444' }}>picture_as_pdf</span>;
        }

        if (typeStr.includes('spreadsheet') || typeStr.includes('excel') || typeStr.includes('csv') || typeStr.includes('xlsx') || typeStr.includes('xls')) {
            return <span className="material-symbols-outlined" style={{ color: '#10B981' }}>description</span>;
        }

        // Default to Word/Docx icon for everything else
        return <span className="material-symbols-outlined" style={{ color: '#3B82F6' }}>article</span>;
    };

    const deriveType = (file) => {
        const typeStr = (file.file_type || file.filename || '').toLowerCase();
        if (typeStr.includes('pdf')) return 'PDF';
        if (typeStr.includes('spreadsheet') || typeStr.includes('excel') || typeStr.includes('csv') || typeStr.includes('xlsx') || typeStr.includes('xls')) return 'XLSX';
        if (typeStr.includes('word') || typeStr.includes('docx') || typeStr.includes('doc')) return 'DOCX';
        return 'FILE';
    };

    const deriveSensitivity = (id) => {
        const val = id % 3;
        if (val === 0) return 'HIGH';
        if (val === 1) return 'MEDIUM';
        return 'LOW';
    };

    const SensitivityBadge = ({ level }) => {
        let color = '#71717A';
        let border = '#E4E4E7';
        if (level === 'HIGH') {
            color = '#18181B';
            border = '#18181B';
        } else if (level === 'MEDIUM') {
            color = '#71717A';
            border = '#E4E4E7';
        } else if (level === 'LOW') {
            color = '#A1A1AA';
            border = '#E4E4E7';
        }
        return (
            <span style={{
                fontSize: 10,
                fontWeight: 700,
                border: `1px solid ${border}`,
                color: color,
                padding: '2px 8px',
                borderRadius: 100,
                display: 'inline-block'
            }}>{level || 'UNRATED'}</span>
        );
    };

    const totalPages = Math.ceil(total / filters.pageSize);

    return (
        <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
            <div className="fade-in">
                <div className="docs-header">
                    <h1>Documents</h1>
                    <label className="upload-btn">
                        <span className="material-symbols-outlined">upload_file</span>
                        Upload Documents
                        <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
                    </label>
                </div>

                <div className="filters-row">
                    <div className="filter-input">
                        <span className="material-symbols-outlined" style={{ color: '#A1A1AA', fontSize: 20, marginRight: 8 }}>search</span>
                        <input
                            type="text"
                            placeholder="Search by filename..."
                            value={filters.query}
                            onChange={(e) => handleFilterChange('query', e.target.value)}
                        />
                    </div>

                    <select className="filter-select" value={filters.type} onChange={(e) => handleFilterChange('type', e.target.value)}>
                        <option value="">All Types</option>
                        <option value="pdf">PDF</option>
                        <option value="word">DOCX</option>
                        <option value="excel">XLSX</option>
                        <option value="image">Image</option>
                    </select>

                    <select className="filter-select" value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
                        <option value="">All Statuses</option>
                        <option value="READY">READY</option>
                        <option value="UPLOADING">PROCESSING</option>
                        <option value="FAILED">FAILED</option>
                    </select>
                </div>

                <div className="docs-table-wrapper">
                    <table className="docs-table">
                        <thead>
                            <tr>
                                <th>Filename</th>
                                <th>Version</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Sensitivity</th>
                                <th>Uploaded By</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {documents.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: 40, color: '#A1A1AA' }}>
                                        {loading ? "Searching..." : "No documents found."}
                                    </td>
                                </tr>
                            ) : (
                                documents.map(doc => (
                                    <tr key={doc.id}>
                                        <td>
                                            <div
                                                className="filename-cell"
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => navigate(`/documents/${doc.id}`)}
                                            >
                                                {getFileIcon(doc)}
                                                <span style={{ color: '#1D4ED8', textDecoration: 'none' }}>{doc.filename}</span>
                                            </div>
                                        </td>
                                        <td style={{ color: '#71717A', fontSize: 13 }}>v{doc.version}</td>
                                        <td style={{ color: '#A1A1AA', fontSize: 12, fontWeight: 600 }}>{deriveType(doc)}</td>
                                        <td>
                                            {doc.status === 'FLAGGED' ? (
                                                <span className="status-pill" style={{ background: '#0F0F0F', color: 'white' }}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                                                    FLAGGED
                                                </span>
                                            ) : (
                                                <StatusPill status={doc.status} />
                                            )}
                                        </td>
                                        <td><SensitivityBadge level={deriveSensitivity(doc.id)} /></td>
                                        <td>
                                            <div className="uploader-cell">
                                                <div className="uploader-avatar">
                                                    {doc.uploaded_by === 3 ? 'AI' : 'ID'}
                                                </div>
                                                <span style={{ fontSize: 13, color: '#3F3F46' }}>
                                                    {doc.uploaded_by === 3 ? 'System Bot' : `User ${doc.uploaded_by}`}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ color: '#71717A', fontSize: 13 }}>
                                            {new Date(doc.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 12 }}>
                                                <button className="actions-btn" title="Download" onClick={() => handleDownload(doc.id, doc.filename)}>
                                                    <span className="material-symbols-outlined">download</span>
                                                </button>
                                                <button className="actions-btn" title="Delete" onClick={() => handleDelete(doc.id)}>
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    <div className="pagination-footer">
                        <div>Showing <strong style={{ color: '#18181B' }}>{documents.length}</strong> of <strong style={{ color: '#18181B' }}>{total}</strong> documents</div>
                        <div className="pagination-controls">
                            <button
                                className="page-btn"
                                disabled={filters.page === 1}
                                onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                            >Prev</button>
                            <span style={{ padding: '6px 12px' }}>{filters.page} / {totalPages || 1}</span>
                            <button
                                className="page-btn"
                                disabled={filters.page >= totalPages}
                                onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                            >Next</button>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
