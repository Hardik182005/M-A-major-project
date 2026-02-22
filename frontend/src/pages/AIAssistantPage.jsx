import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { chatWithAI, getAIAssistantStatus, uploadDocument } from '../api';
import './AIAssistantPage.css';

export default function AIAssistantPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);
    const [chatSessions, setChatSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const fileInputRef = useRef(null);
    const [uploadingFile, setUploadingFile] = useState(false);

    useEffect(() => {
        // Check AI status
        getAIAssistantStatus().then(res => {
            setStatus(res.data);
        }).catch(err => {
            console.error('AI status error:', err);
        });

        // Load chat sessions from localStorage
        if (selectedProject) {
            const rawSessions = localStorage.getItem(`ai_chat_sessions_${selectedProject.id}`);
            if (rawSessions) {
                try {
                    const parsed = JSON.parse(rawSessions);
                    setChatSessions(parsed);
                    if (parsed.length > 0) {
                        setActiveSessionId(parsed[0].id);
                    } else {
                        startNewChat();
                    }
                } catch (e) {
                    console.error("Failed to parse chat sessions");
                    startNewChat();
                }
            } else {
                startNewChat();
            }
        }
    }, [selectedProject]);

    // Save chat history to localStorage when sessions change
    useEffect(() => {
        if (selectedProject && chatSessions.length > 0) {
            localStorage.setItem(`ai_chat_sessions_${selectedProject.id}`, JSON.stringify(chatSessions));
        }
    }, [chatSessions, selectedProject]);

    const startNewChat = () => {
        const newSession = {
            id: Date.now().toString(),
            title: `Chat ${new Date().toLocaleDateString()}`,
            messages: []
        };
        setChatSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
    };

    const handleSend = async () => {
        if (!input.trim() || loading || !selectedProject || !activeSessionId) return;

        const userMessage = input.trim();
        setInput('');

        // Update session with user message
        setChatSessions(prev => prev.map(s => {
            if (s.id === activeSessionId) {
                const isFirstMsg = s.messages.length === 0;
                return {
                    ...s,
                    title: isFirstMsg ? userMessage.substring(0, 25) + "..." : s.title,
                    messages: [...s.messages, { role: 'user', content: userMessage }]
                };
            }
            return s;
        }));

        setLoading(true);

        try {
            // Get current history for context logic if needed in backend, 
            // but our backend just takes "message". We will send to backend.
            const res = await chatWithAI(selectedProject.id, userMessage);
            const aiResponse = res.data.answer;

            setChatSessions(prev => prev.map(s => s.id === activeSessionId ? {
                ...s,
                messages: [...s.messages, { role: 'assistant', content: aiResponse }]
            } : s));
        } catch (err) {
            console.error('Chat error:', err);
            const errorMsg = err.response?.data?.detail || 'Sorry, I encountered an internal server error while fetching the AI response.';
            setChatSessions(prev => prev.map(s => s.id === activeSessionId ? {
                ...s,
                messages: [...s.messages, { role: 'assistant', content: errorMsg }]
            } : s));
        }

        setLoading(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedProject) return;

        setUploadingFile(true);
        try {
            const res = await uploadDocument(selectedProject.id, file);
            alert(`File ${file.name} uploaded successfully!`);
            // Add a little system message to the chat
            setChatSessions(prev => prev.map(s => s.id === activeSessionId ? {
                ...s,
                messages: [...s.messages, { role: 'assistant', content: `Awesome! I received the file "${file.name}". I'll analyze it in the background.` }]
            } : s));
        } catch (err) {
            console.error('Upload error:', err);
            alert('Failed to upload file. Please try again.');
        } finally {
            setUploadingFile(false);
            e.target.value = null; // reset input
        }
    };

    const activeSession = chatSessions.find(s => s.id === activeSessionId);
    const messages = activeSession ? activeSession.messages : [];

    const suggestedPrompts = [
        "What documents are in this data room?",
        "Summarize the key findings",
        "Are there any risks identified?",
        "What PII was detected?"
    ];

    if (!selectedProject) {
        return (
            <AppLayout selectedProject={null} onSelectProject={setSelectedProject}>
                <div className="no-project-selected">
                    <span className="material-symbols-outlined">smart_toy</span>
                    <h2>Select a Project</h2>
                    <p>Choose a project to chat with the AI Assistant</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
            <div className="ai-assistant-container fade-in">

                {/* Header Section */}
                <div className="ai-header">
                    <div className="breadcrumb-nav">
                        <span className="proj-name">{selectedProject?.name || 'Select Project'}</span>
                        <span className="material-symbols-outlined breadcrumb-arrow">chevron_right</span>
                        <span className="current-page">MergerMind Assistant</span>
                    </div>
                </div>

                <div className="ai-layout">
                    {/* Main Chat Area */}
                    <div className="ai-chat-area">
                        <div className="chat-history">
                            {messages.length === 0 && (
                                <div className="empty-chat">
                                    <span className="material-symbols-outlined empty-icon" style={{ fontSize: '48px', color: '#60A5FA', marginBottom: '16px' }}>smart_toy</span>
                                    <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px' }}>Hi there! How can I help?</h3>
                                    <p style={{ color: '#A1A1AA', lineHeight: '1.6', marginBottom: '24px', maxWidth: '400px', textAlign: 'center' }}>
                                        I am MergerMind, your personal AI Due Diligence Analyst. I can help you analyze risks, find PII, summarize findings, and track trends in your documents!
                                    </p>
                                    {status && (
                                        <div className="ai-status">
                                            <span className="status-dot"></span>
                                            Powered by {status.model}
                                        </div>
                                    )}
                                </div>
                            )}

                            {messages.map((msg, idx) => (
                                <div key={idx} className={`message-row ${msg.role}-row`}>
                                    {msg.role === 'assistant' && (
                                        <div className="message-avatar ai-avatar-img">
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>smart_toy</span>
                                        </div>
                                    )}
                                    <div className={`message-bubble ${msg.role === 'user' ? 'user-bubble' : 'ai-bubble'}`}>
                                        {msg.content}
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="message-avatar user-avatar-img">
                                            U
                                        </div>
                                    )}
                                </div>
                            ))}

                            {loading && (
                                <div className="message-row ai-row">
                                    <div className="message-avatar ai-avatar-img">
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>smart_toy</span>
                                    </div>
                                    <div className="message-bubble ai-bubble">
                                        <span className="typing-indicator">Typing...</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="chat-input-section">
                            <div className="suggested-prompts-row">
                                {suggestedPrompts.map((prompt, idx) => (
                                    <button
                                        key={idx}
                                        className="suggested-prompt"
                                        onClick={() => setInput(prompt)}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>

                            <div className="chat-input-wrapper">
                                <button
                                    className="upload-icon-btn"
                                    onClick={() => fileInputRef.current.click()}
                                    disabled={uploadingFile}
                                    title="Upload Document"
                                >
                                    {uploadingFile ? (
                                        <span className="material-symbols-outlined spinning">sync</span>
                                    ) : (
                                        <span className="material-symbols-outlined">attach_file</span>
                                    )}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={handleFileUpload}
                                />

                                <input
                                    type="text"
                                    placeholder="Ask anything about this data room..."
                                    className="chat-input"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                />
                                <button
                                    className="send-btn"
                                    onClick={handleSend}
                                    disabled={loading || !input.trim()}
                                >
                                    <span className="material-symbols-outlined">send</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Chat History */}
                    <aside className="ai-context-panel chat-history-panel">
                        <div className="context-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="material-symbols-outlined">history</span>
                                <h4>Previous Chats</h4>
                            </div>
                            <button className="new-chat-btn-small" onClick={startNewChat} title="New Chat">
                                <span className="material-symbols-outlined">add</span>
                            </button>
                        </div>
                        <div className="chat-session-list">
                            {chatSessions.length === 0 && (
                                <div className="empty-sessions">No previous chats</div>
                            )}
                            {chatSessions.map(session => (
                                <div
                                    key={session.id}
                                    className={`chat-session-item ${session.id === activeSessionId ? 'active' : ''}`}
                                    onClick={() => setActiveSessionId(session.id)}
                                >
                                    <span className="material-symbols-outlined session-icon">chat_bubble_outline</span>
                                    <span className="session-title">{session.title}</span>
                                </div>
                            ))}
                        </div>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}
