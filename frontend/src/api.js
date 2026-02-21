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

export default api;
