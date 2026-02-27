import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { BrandLogo } from '../components/Logo';
import { getAINews } from '../api';
import './AuthPages.css';

export default function InsightsPage() {
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [newsItems, setNewsItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        setIsLoggedIn(!!token);

        const fetchNews = () => {
            if (token) {
                getAINews().then(res => {
                    // API returns { articles: [...], last_updated, cache_age_seconds, next_refresh_seconds }
                    const data = res.data;
                    if (data.articles && Array.isArray(data.articles)) {
                        setNewsItems(data.articles);
                    } else if (Array.isArray(data)) {
                        setNewsItems(data);
                    } else {
                        setNewsItems(getFallbackNews());
                    }
                    setLoading(false);
                }).catch(err => {
                    console.error('News fetch error:', err);
                    setNewsItems(getFallbackNews());
                    setLoading(false);
                });
            } else {
                setNewsItems(getFallbackNews());
                setLoading(false);
            }
        };

        fetchNews();
        // Refresh every 1 hour
        const interval = setInterval(fetchNews, 3600000);
        return () => clearInterval(interval);
    }, []);

    function getFallbackNews() {
        return [
            {
                tag: "LAW COMPLIANCE",
                date: "FEB 28, 2026",
                title: "Delaware Court Imposes Stricter M&A Disclosure Requirements",
                link: "https://www.reuters.com/business/finance/",
                desc: "New ruling imposes stricter requirements on controlling shareholder buyout disclosures, impacting recent going-private M&A clauses."
            },
            {
                tag: "ANTITRUST",
                date: "FEB 27, 2026",
                title: "FTC Updates Guidelines for Technology Mergers",
                link: "https://www.reuters.com/markets/deals/",
                desc: "Increased scrutiny on data privacy and API lockdown practices post-acquisition. Tech acquisitions larger than $500M now subject to 90-day extended review period."
            },
            {
                tag: "DEAL FLOW",
                date: "FEB 26, 2026",
                title: "Global M&A Deal Volume Rises 15% in Q1 2026",
                link: "https://www.reuters.com/markets/deals/",
                desc: "Private equity firms driving deal volume with increased focus on technology and healthcare sectors. Cross-border deals account for 35% of total volume."
            },
            {
                tag: "REGULATION",
                date: "FEB 25, 2026",
                title: "EU Digital Markets Act Impacts Cross-Border M&A Strategy",
                link: "https://www.reuters.com/technology/",
                desc: "New compliance requirements under the DMA are forcing acquirers to reassess integration timelines for EU-based platform companies."
            },
            {
                tag: "MARKET NEWS",
                date: "FEB 24, 2026",
                title: "Healthcare M&A Activity Surges as AI Integration Accelerates",
                link: "https://www.reuters.com/business/healthcare-pharmaceuticals/",
                desc: "AI-driven diagnostics companies are becoming prime acquisition targets as major healthcare conglomerates seek digital transformation."
            }
        ];
    }

    function formatToIST(dateStr) {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }) + ' IST';
        } catch {
            return dateStr;
        }
    }

    if (isLoggedIn) {
        return (
            <AppLayout selectedProject={selectedProject} onSelectProject={setSelectedProject}>
                <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }} className="fade-in">
                    <header style={{ marginBottom: '40px' }}>
                        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#18181B', marginBottom: '8px' }}>M&A News & Insights</h1>
                        <p style={{ color: '#71717A' }}>Stay ahead of regulatory shifts and market trends impacting your data room.</p>
                    </header>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '40px' }}>
                        {/* Main Feed */}
                        <div className="news-feed">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {newsItems.map((item, i) => (
                                    <div key={i} className="card" style={{ padding: '32px', background: 'white', border: '1px solid #E4E4E7', borderRadius: '12px', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={e => e.currentTarget.style.transform = 'none'}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563EB', letterSpacing: '0.5px' }}>{item.tag}</span>
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#A1A1AA' }}>{formatToIST(item.date)}</span>
                                        </div>
                                        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px', color: '#18181B' }}>
                                            <a href={item.link} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {item.title}
                                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#D4D4D8' }}>open_in_new</span>
                                            </a>
                                        </h3>
                                        <p style={{ color: '#52525B', lineHeight: '1.6', fontSize: '15px' }}>{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Sidebar info */}
                        <aside>
                            <div className="card" style={{ padding: '24px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', marginBottom: '24px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#2563EB' }}>hub</span>
                                    Analytic Engine
                                </h4>
                                <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.5' }}>
                                    Our AI MergerMind automatically adjusts its scrutiny levels based on these latest alerts.
                                </p>
                            </div>

                            <div className="card" style={{ padding: '24px', background: '#18181B', color: 'white', borderRadius: '12px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Weekly Briefing</h4>
                                <p style={{ fontSize: '13px', color: '#A1A1AA', lineHeight: '1.5', marginBottom: '16px' }}>Get the summary of regulatory changes directly to your dashboard.</p>
                                <button className="btn btn-primary" style={{ width: '100%', fontSize: '12px' }}>SUBSCRIBE</button>
                            </div>
                        </aside>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <div className="insights-page pattern-bg" style={{ minHeight: '100vh', padding: '80px 24px', background: '#FAFAFA' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' }}>
                    <BrandLogo size={32} variant="dark" />
                    <button onClick={() => navigate(-1)} className="btn btn-outline" style={{ borderRadius: '99px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '4px' }}>arrow_back</span>
                        Go Back
                    </button>
                </nav>

                <header style={{ marginBottom: '80px' }}>
                    <div className="hero-badge" style={{ marginBottom: '16px' }}>ANALYTIC CAPABILITIES</div>
                    <h1 className="font-display" style={{ fontSize: '48px', color: '#18181B', marginBottom: '24px' }}>
                        Deep Analytics & <br />
                        <span style={{ color: '#71717A' }}>AI-Driven Predictive Intelligence.</span>
                    </h1>
                    <p style={{ fontSize: '18px', color: '#52525B', lineHeight: '1.6', maxWidth: '750px' }}>
                        The MergerMind insight engine converts raw, unstructured document repositories into actionable mathematical risk scores and comparative intelligence.
                    </p>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                    {/* Feature cards ... keep existing marketing content for guests */}
                    <div className="card" style={{ padding: '40px', background: '#fff', border: '1px solid #E4E4E7' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#18181B', marginBottom: '24px' }}>monitoring</span>
                        <h3 className="font-display" style={{ fontSize: '24px', marginBottom: '16px' }}>Predictive Risk Health</h3>
                        <p style={{ color: '#71717A', lineHeight: '1.7' }}>
                            Our proprietary algorithm scans for 50+ risk categories including change-of-control clauses, restrictive covenants, and non-compliance flags.
                        </p>
                    </div>
                    <div className="card" style={{ padding: '40px', background: '#fff', border: '1px solid #E4E4E7' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#18181B', marginBottom: '24px' }}>newspaper</span>
                        <h3 className="font-display" style={{ fontSize: '24px', marginBottom: '16px' }}>Real-time Regulatory Bias</h3>
                        <p style={{ color: '#71717A', lineHeight: '1.7' }}>
                            Insights are informed by real-time M&A updates. If the Delaware Supreme Court issues a new ruling, the AI Assistant instantly shifts its analysis.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
