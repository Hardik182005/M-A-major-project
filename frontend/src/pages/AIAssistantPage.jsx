import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { chatWithAI, streamChatWithAI, getAIAssistantStatus, uploadDocument, getAINews } from '../api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './AIAssistantPage.css';

const NEWS_REFRESH_MS = 3600000; // 1 hour in milliseconds

// Safe Markdown renderer with error boundary
function SafeMarkdown({ children }) {
    try {
        let content = children || '';
        // Strip wrapping code fences that AI sometimes adds around tables/markdown
        // Handle complete code fences: ```markdown ... ```
        content = content.replace(/^```(?:markdown|md|text|json)?\s*\n?([\s\S]*?)```\s*$/gm, '$1');
        // Handle opening code fence at start with no closing (streaming partial)
        content = content.replace(/^```(?:markdown|md|text|json)?\s*\n/gm, '');
        // Handle orphan closing fence
        content = content.replace(/\n?```\s*$/gm, '');
        // Replace problematic characters
        content = content.replace(/█/g, '▓').replace(/░/g, '░');
        // Strip *** and --- horizontal rule dividers the model adds (anywhere in text)
        content = content.replace(/\*{3,}/g, '').replace(/-{4,}/g, ''); // Keep --- for headers, strip 4+ dashes
        return (
            <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-body">
                {content}
            </ReactMarkdown>
        );
    } catch (err) {
        console.error('Markdown render error:', err);
        return <div className="markdown-body" style={{ whiteSpace: 'pre-wrap' }}>{children}</div>;
    }
}

class MarkdownErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(error) {
        console.error('Markdown rendering failed:', error);
    }
    render() {
        if (this.state.hasError) {
            return <div style={{ whiteSpace: 'pre-wrap' }}>{this.props.fallback}</div>;
        }
        return this.props.children;
    }
}

export default function AIAssistantPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);
    const [chatSessions, setChatSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [liveNews, setLiveNews] = useState([]);
    const [newsLastUpdated, setNewsLastUpdated] = useState(null);
    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const streamAbortRef = useRef(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [sidebarTab, setSidebarTab] = useState('news');
    const [isScrolledUp, setIsScrolledUp] = useState(false);

    // Track manual scrolling
    const handleScroll = () => {
        if (chatContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
            // If we are more than 150px from the bottom, consider it "scrolled up"
            setIsScrolledUp(scrollHeight - scrollTop - clientHeight > 150);
        }
    };

    // Scroll to bottom on new message or tokens, unless user scrolled up
    useEffect(() => {
        if (!isScrolledUp) {
            chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
    }, [chatSessions, loading, isScrolledUp]);

    // Check AI status on mount
    useEffect(() => {
        getAIAssistantStatus().then(res => {
            setStatus(res.data);
        }).catch(err => {
            console.error('AI status error:', err);
        });
    }, []);

    // Fetch live news on mount + every 1 hour
    useEffect(() => {
        const fetchNews = () => {
            getAINews().then(res => {
                const data = res.data;
                if (data.articles) {
                    setLiveNews(data.articles);
                    setNewsLastUpdated(new Date());
                } else if (Array.isArray(data)) {
                    setLiveNews(data);
                    setNewsLastUpdated(new Date());
                }
            }).catch(err => {
                console.error('News fetch error:', err);
            });
        };

        fetchNews();
        const interval = setInterval(fetchNews, NEWS_REFRESH_MS);
        return () => clearInterval(interval);
    }, []);

    // Effect to handle initialization once project is selected
    useEffect(() => {
        if (!selectedProject) return;

        const rawSessions = localStorage.getItem(`ai_chat_sessions_${selectedProject.id}`);
        if (rawSessions) {
            try {
                const parsed = JSON.parse(rawSessions);
                setChatSessions(parsed);
                if (parsed.length > 0) {
                    setActiveSessionId(parsed[0].id);
                    setSidebarTab('chats');
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
        const sessionId = activeSessionId;
        setInput('');

        // Add user message
        setChatSessions(prev => prev.map(s => {
            if (s.id === sessionId) {
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

        // Prepare history (last 5 messages)
        const currentSession = chatSessions.find(s => s.id === sessionId);
        const history = currentSession ? currentSession.messages.slice(-5) : [];

        // Add a placeholder assistant message that we'll stream into
        setChatSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s,
            messages: [...s.messages, { role: 'assistant', content: '' }]
        } : s));

        // Track accumulated text in a ref-like variable
        let accumulated = '';

        // Abort previous stream if any
        if (streamAbortRef.current) {
            streamAbortRef.current();
        }

        streamAbortRef.current = streamChatWithAI(
            selectedProject.id,
            userMessage,
            history,
            {
                onToken: (token) => {
                    accumulated += token;
                    const text = accumulated;
                    setChatSessions(prev => prev.map(s => {
                        if (s.id !== sessionId) return s;
                        const msgs = [...s.messages];
                        // Update the last assistant message
                        if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: text };
                        }
                        return { ...s, messages: msgs };
                    }));
                },
                onSources: (sources) => {
                    // Sources metadata received (could display in UI later)
                    console.log('Chat sources:', sources);
                },
                onDone: () => {
                    setLoading(false);
                    streamAbortRef.current = null;
                },
                onError: (err) => {
                    console.error('Stream error:', err);
                    const errorMsg = err.message || '⚠️ Sorry, I encountered an error. Please try again.';
                    // If we got no tokens, replace with error; otherwise append
                    setChatSessions(prev => prev.map(s => {
                        if (s.id !== sessionId) return s;
                        const msgs = [...s.messages];
                        if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                            const existing = msgs[msgs.length - 1].content;
                            msgs[msgs.length - 1] = {
                                ...msgs[msgs.length - 1],
                                content: existing || errorMsg
                            };
                        }
                        return { ...s, messages: msgs };
                    }));
                    setLoading(false);
                    streamAbortRef.current = null;
                }
            }
        );
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedProject) return;

        setUploadingFile(true);
        try {
            const res = await uploadDocument(selectedProject.id, file);
            setChatSessions(prev => prev.map(s => s.id === activeSessionId ? {
                ...s,
                messages: [...s.messages, { role: 'assistant', content: `✅ File "${file.name}" uploaded successfully! I'll analyze it in the background and update you when findings are ready.` }]
            } : s));
        } catch (err) {
            console.error('Upload error:', err);
            setChatSessions(prev => prev.map(s => s.id === activeSessionId ? {
                ...s,
                messages: [...s.messages, { role: 'assistant', content: `❌ Failed to upload "${file.name}". Please try again.` }]
            } : s));
        } finally {
            setUploadingFile(false);
            e.target.value = null;
        }
    };

    const handleDeleteSession = (sessionId) => {
        setChatSessions(prev => {
            const updated = prev.filter(s => s.id !== sessionId);
            if (activeSessionId === sessionId && updated.length > 0) {
                setActiveSessionId(updated[0].id);
            } else if (updated.length === 0) {
                startNewChat();
            }
            return updated;
        });
    };

    const activeSession = chatSessions.find(s => s.id === activeSessionId);
    const messages = activeSession ? activeSession.messages : [];

    const suggestedPrompts = [
        "What documents are in this data room?",
        "Summarize the key findings",
        "Show risk breakdown as a bar chart",
        "What PII was detected?",
        "Compare all vendor contracts",
        "Are there any duplicate invoices?"
    ];

    const formatNewsDate = (dateStr) => {
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

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
                        <div 
                            className="chat-history" 
                            ref={chatContainerRef} 
                            onScroll={handleScroll}
                        >
                            {messages.length === 0 && (
                                <div className="empty-chat">
                                    <span className="material-symbols-outlined empty-icon" style={{ fontSize: '48px', color: '#60A5FA', marginBottom: '16px' }}>smart_toy</span>
                                    <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px' }}>Hi there! How can I help?</h3>
                                    <p style={{ color: '#A1A1AA', lineHeight: '1.6', marginBottom: '24px', maxWidth: '400px', textAlign: 'center' }}>
                                        I am MergerMind, your personal AI Due Diligence Analyst. I can help you analyze risks, find PII, summarize findings, generate charts, detect duplicate invoices, and provide acquisition advice!
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
                                        {msg.role === 'assistant' ? (
                                            <MarkdownErrorBoundary fallback={msg.content}>
                                                <SafeMarkdown>{msg.content}</SafeMarkdown>
                                            </MarkdownErrorBoundary>
                                        ) : (
                                            msg.content
                                        )}
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
                                        <div className="typing-dots">
                                            <span></span><span></span><span></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
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
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
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

                    {/* Right Panel: Chat Context / News */}
                    <aside className="ai-context-panel chat-history-panel">
                        <div className="sidebar-tabs" style={{ display: 'flex', borderBottom: '1px solid #E4E4E7', marginBottom: '16px', background: '#F4F4F5', borderRadius: '8px', padding: '4px' }}>
                            <button
                                style={{ flex: 1, padding: '8px', background: sidebarTab === 'chats' ? 'white' : 'transparent', color: sidebarTab === 'chats' ? '#2563EB' : '#71717A', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, boxShadow: sidebarTab === 'chats' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
                                onClick={() => setSidebarTab('chats')}
                            >
                                Chats
                            </button>
                            <button
                                style={{ flex: 1, padding: '8px', background: sidebarTab === 'news' ? 'white' : 'transparent', color: sidebarTab === 'news' ? '#2563EB' : '#71717A', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, boxShadow: sidebarTab === 'news' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}
                                onClick={() => setSidebarTab('news')}
                            >
                                M&A News
                            </button>
                        </div>

                        {sidebarTab === 'chats' ? (
                            <>
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
                                            <button
                                                className="delete-session-btn"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                                                title="Delete chat"
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="news-panel" style={{ padding: '0 8px', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#60A5FA' }}>
                                    <span className="material-symbols-outlined">newspaper</span>
                                    <h4 style={{ margin: 0 }}>Live M&A Alerts</h4>
                                </div>
                                {newsLastUpdated && (
                                    <div style={{ fontSize: '11px', color: '#A1A1AA', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>schedule</span>
                                        Updated: {newsLastUpdated.toLocaleTimeString()} • Refreshes every hour
                                    </div>
                                )}

                                {liveNews.length === 0 ? (
                                    <div style={{ color: '#71717A', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
                                        Loading latest M&A alerts...
                                    </div>
                                ) : (
                                    liveNews.map((news, idx) => (
                                        <div key={idx} className="news-item" style={{ background: 'white', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #E4E4E7' }}>
                                            <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#71717A', fontWeight: 600 }}>{news.tag} • {formatNewsDate(news.date)}</p>
                                            <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: 1.4, color: '#18181B' }}>
                                                <a href={news.link} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                                    {news.title} <span className="material-symbols-outlined" style={{ fontSize: '12px', verticalAlign: 'middle' }}>open_in_new</span>
                                                </a>
                                            </h5>
                                            <p style={{ margin: 0, fontSize: '12px', color: '#52525B', lineHeight: 1.5 }}>
                                                {news.desc}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}
