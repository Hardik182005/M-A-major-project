import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Auth
export const register = (name, email, password) =>
    api.post('/auth/register', { name, email, password });

export const login = (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    return api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
};

export const getMe = () => api.get('/auth/me');
export const logout = () => api.post('/auth/logout');

// Projects
export const listProjects = () => api.get('/projects');
export const createProject = (name, description) =>
    api.post('/projects', { name, description });

export const uploadDocument = (projectId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/projects/${projectId}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

// Processing Pipeline
export const processDocument = (projectId, docId, force = false) =>
    api.post(`/projects/${projectId}/documents/${docId}/process`, { force });

export const listProcessingJobs = (projectId, status) => {
    const params = status ? `?status=${status}` : '';
    return api.get(`/projects/${projectId}/processing-jobs${params}`);
};

export const getProcessingJob = (jobId) =>
    api.get(`/processing-jobs/${jobId}`);

export const getDocumentClassification = (docId) =>
    api.get(`/documents/${docId}/classification`);

export const getPIIEntities = (docId) =>
    api.get(`/documents/${docId}/pii-entities`);

export const getStructuredData = (docId) =>
    api.get(`/documents/${docId}/structured`);

export const getDocumentFindings = (docId, category, severity) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (severity) params.append('severity', severity);
    return api.get(`/documents/${docId}/findings?${params.toString()}`);
};

export const getProjectFindings = (projectId, category, severity, status) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (severity) params.append('severity', severity);
    if (status) params.append('status', status);
    return api.get(`/projects/${projectId}/findings?${params.toString()}`);
};

export const updateFindingStatus = (findingId, status) =>
    api.patch(`/findings/${findingId}/status?status=${status}`);

export const getDocumentText = (docId) =>
    api.get(`/documents/${docId}/text`);

export const downloadDocumentBlob = (docId) =>
    api.get(`/documents/${docId}/download`, { responseType: 'blob' });

// AI Assistant
export const chatWithAI = (projectId, message, history = []) =>
    api.post('/ai-assistant/chat', { project_id: projectId, message, history });

/**
 * Stream chat response via Server-Sent Events (SSE).
 * Calls onToken(text) for each word as it arrives from Ollama.
 * Calls onSources(sources) when source metadata arrives.
 * Calls onDone() when generation is complete.
 * Returns an abort function to cancel the stream.
 */
export const streamChatWithAI = (projectId, message, history = [], { onToken, onSources, onDone, onError }) => {
    const token = localStorage.getItem('access_token');
    const controller = new AbortController();

    fetch(`${API_BASE}/ai-assistant/chat/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ project_id: projectId, message, history }),
        signal: controller.signal,
    })
    .then(async (response) => {
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;

                try {
                    const event = JSON.parse(jsonStr);
                    if (event.type === 'token' && onToken) {
                        onToken(event.token);
                    } else if (event.type === 'sources' && onSources) {
                        onSources(event.sources);
                    } else if (event.type === 'done' && onDone) {
                        onDone();
                    }
                } catch (e) {
                    // Skip malformed JSON
                }
            }
        }

        // Process remaining buffer
        if (buffer.startsWith('data: ')) {
            try {
                const event = JSON.parse(buffer.slice(6).trim());
                if (event.type === 'done' && onDone) onDone();
            } catch (e) {}
        }

        if (onDone) onDone();
    })
    .catch((err) => {
        if (err.name !== 'AbortError') {
            console.error('Stream error:', err);
            if (onError) onError(err);
        }
    });

    // Return abort function
    return () => controller.abort();
};

export const getAIAssistantStatus = () =>
    api.get('/ai-assistant/status');

export const getAINews = () =>
    api.get('/ai-assistant/news');

// Reports
export const getProjectReports = (projectId) =>
    api.get(`/reports/project/${projectId}`);

export const generateReport = (projectId) =>
    api.post(`/reports/project/${projectId}/generate`);

export const getReportSummary = (projectId) =>
    api.get(`/reports/project/${projectId}/summary`);

export default api;
