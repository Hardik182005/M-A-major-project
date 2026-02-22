import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { BrandLogo, LogoIcon } from '../components/Logo';
import './LandingPage.css';

const ROTATING_WORDS = ['Due Diligence', 'Contract Analysis', 'Risk Assessment', 'M&A Research', 'Compliance'];

export default function LandingPage() {
    const [scrollY, setScrollY] = useState(0);
    const [wordIndex, setWordIndex] = useState(0);
    const [isFlipping, setIsFlipping] = useState(false);
    const capRef = useRef(null);
    const [capVisible, setCapVisible] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (localStorage.getItem('access_token')) {
            navigate('/dashboard');
        }
    }, [navigate]);

    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Rotating words animation
    useEffect(() => {
        const interval = setInterval(() => {
            setIsFlipping(true);
            setTimeout(() => {
                setWordIndex(prev => (prev + 1) % ROTATING_WORDS.length);
                setIsFlipping(false);
            }, 400);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Capabilities scroll reveal
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setCapVisible(true); },
            { threshold: 0.3 }
        );
        if (capRef.current) observer.observe(capRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div className="landing pattern-bg">

            {/* ── Navigation ────────────────────── */}
            <nav className={`landing-nav ${scrollY > 50 ? 'nav-scrolled' : ''}`}>
                <div className="nav-inner">
                    <Link to="/" className="nav-brand-link">
                        <BrandLogo size={36} variant="dark" />
                    </Link>
                    <div className="nav-links">
                        <a href="#platform">Platform</a>
                        <a href="#security">Security</a>
                        <a href="#insights">Insights</a>
                    </div>
                    <div className="nav-actions">
                        <Link to="/login" className="nav-login">Login</Link>
                        <Link to="/register" className="btn btn-primary">Sign Up</Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero Section ──────────────────── */}
            <header className="hero">
                <div className="hero-inner">
                    <div className="hero-content">
                        <div className="hero-badge animate-hero-badge">
                            <span className="hero-badge-dot" />
                            AI-Powered Intelligence Platform
                        </div>
                        <h1 className="hero-title font-display animate-hero-title">
                            <span className="hero-line hero-line-1">
                                <span className={`rotating-word ${isFlipping ? 'flip-out' : 'flip-in'}`}>
                                    {ROTATING_WORDS[wordIndex]},
                                </span>
                            </span>
                            <span className="hero-line hero-line-2 hero-title-accent">Reimagined.</span>
                        </h1>
                        <p className="hero-subtitle animate-hero-subtitle">
                            Empowering top-tier legal and financial teams with obsidian-sharp AI analysis to navigate the world's most complex deals.
                        </p>
                        <div className="hero-ctas animate-hero-ctas">
                            <Link to="/register" className="btn btn-primary btn-lg">
                                Get Started Free
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                            </Link>
                            <a href="#platform" className="btn btn-outline btn-lg">
                                View Demo
                            </a>
                        </div>
                        <div className="hero-trust animate-hero-trust">
                            <span>Trusted by 200+ firms</span>
                            <span className="trust-divider">•</span>
                            <span>SOC 2 Certified</span>
                            <span className="trust-divider">•</span>
                            <span>Enterprise Ready</span>
                        </div>
                    </div>

                    <div className="hero-visual animate-hero-visual">
                        <div className="dashboard-panel hero-dashboard">
                            <div className="mock-header">
                                <div className="mock-dots"><span /><span /><span /></div>
                                <div className="mock-bar" />
                            </div>
                            <div className="mock-grid">
                                <div className="mock-chart-card">
                                    <div className="mock-chart-header">
                                        <div className="mock-line w60" />
                                        <span className="mock-label">VOL_INDX: 1.294</span>
                                    </div>
                                    <svg className="mock-chart" viewBox="0 0 200 60">
                                        <path d="M0 45 L30 40 L60 48 L90 20 L120 25 L150 5 L180 12 L200 8" stroke="rgba(255,255,255,0.5)" fill="none" strokeWidth="1.5" />
                                        <path d="M0 45 L30 40 L60 48 L90 20 L120 25 L150 5 L180 12 L200 8 L200 60 L0 60 Z" fill="rgba(255,255,255,0.03)" />
                                    </svg>
                                </div>
                                <div className="mock-score-card">
                                    <div className="mock-score-circle">
                                        <svg viewBox="0 0 64 64">
                                            <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.1)" fill="none" strokeWidth="2" />
                                            <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.6)" fill="none" strokeWidth="2"
                                                strokeDasharray="175.9" strokeDashoffset="35" transform="rotate(-90 32 32)" />
                                        </svg>
                                        <span className="mock-score-text">82%</span>
                                    </div>
                                    <div className="mock-line w40" style={{ marginTop: 8 }} />
                                </div>
                                <div className="mock-rows-card">
                                    {[1, 2].map(i => (
                                        <div className="mock-row" key={i}>
                                            <div className="mock-row-icon">
                                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'white' }}>
                                                    {i === 1 ? 'description' : 'gavel'}
                                                </span>
                                            </div>
                                            <div className="mock-row-lines">
                                                <div className="mock-line w75" />
                                                <div className="mock-line w50" style={{ opacity: 0.5, marginTop: 4 }} />
                                            </div>
                                            <span className="mock-badge">{i === 1 ? 'STABLE' : 'ACTIVE'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Scrollable Core Capabilities ──── */}
            <section className="capabilities" ref={capRef}>
                <div className="capabilities-label">Core Capabilities</div>
                <div className={`capabilities-scroller ${capVisible ? 'cap-animate' : ''}`}>
                    {[
                        'Contract Analysis',
                        'Complex Workflows',
                        'Document Storage',
                        'Risk Detection',
                        'AI Analysis',
                        'Legal Research',
                        'Compliance',
                    ].map((text, i) => {
                        const isCenter = text === 'AI Analysis';
                        return (
                            <h2
                                key={text}
                                className={`cap-item font-display ${isCenter ? 'cap-bold' : 'cap-faded'}`}
                                style={{ animationDelay: `${i * 0.12}s` }}
                            >
                                {text}
                            </h2>
                        );
                    })}
                </div>
                <div className="capabilities-explore">
                    <a href="#platform" className="btn btn-outline" style={{ borderRadius: 999 }}>
                        Explore Platform
                    </a>
                </div>
            </section>

            {/* ── Features ──────────────────────── */}
            <section id="platform" className="features">
                <div className="features-inner">
                    <div className="features-header">
                        <h3 className="features-title font-display">
                            Intelligence for <br />
                            <span className="features-title-accent">the Next Deal.</span>
                        </h3>
                        <p className="features-subtitle">
                            Unlocking M&A success with high-contrast precision. Our platform handles the complexity so you can focus on decisions.
                        </p>
                    </div>
                    <div className="features-grid">
                        {[
                            { icon: 'search', title: 'AI Due Diligence', desc: 'Automate risk assessment and document review. Reveal hidden liabilities in seconds with our high-fidelity processing core.' },
                            { icon: 'contract', title: 'Smart Contracts Analysis', desc: 'Extract key terms and compare agreements instantly. Ensure absolute compliance across all jurisdictions.' },
                            { icon: 'monitoring', title: 'Market & Competitor Mapping', desc: 'Visualize competitive landscapes with high-contrast data visualization. Identify synergies invisible to legacy tools.' },
                            { icon: 'hub', title: 'Post-Merger Integration', desc: 'Streamline post-merger processes. Align global teams, systems, and culture with expert-grade precision.' },
                        ].map((f) => (
                            <div className="card feature-card" key={f.title}>
                                <div className="feature-icon-wrap">
                                    <span className="material-symbols-outlined">{f.icon}</span>
                                </div>
                                <h4 className="feature-title font-display">{f.title}</h4>
                                <p className="feature-desc">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Security Section ───────────────── */}
            <section id="security" className="security-section">
                <div className="security-inner">
                    <div className="security-badge">SECURITY & COMPLIANCE</div>
                    <h3 className="security-title font-display">Enterprise-Grade Protection</h3>
                    <p className="security-subtitle">Your data room is protected by the same standards trusted by Fortune 500 firms.</p>
                    <div className="security-grid">
                        {[
                            { icon: 'lock', label: 'AES-256 Encryption' },
                            { icon: 'verified_user', label: 'SOC 2 Type II' },
                            { icon: 'shield', label: 'GDPR Compliant' },
                            { icon: 'fingerprint', label: 'SSO / SAML 2.0' },
                            { icon: 'admin_panel_settings', label: 'Role-Based Access' },
                            { icon: 'history', label: 'Immutable Audit Trail' },
                        ].map(s => (
                            <div className="security-item" key={s.label}>
                                <span className="material-symbols-outlined">{s.icon}</span>
                                <span>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA Section ───────────────────── */}
            <section className="cta-section">
                <div className="cta-inner">
                    <h3 className="cta-title font-display">Ready to Transform Your Due Diligence?</h3>
                    <p className="cta-subtitle">Join the firms using AI to make smarter acquisition decisions.</p>
                    <div className="cta-buttons">
                        <Link to="/register" className="btn btn-white btn-lg">Get Started Free</Link>
                        <a href="#platform" className="btn btn-white-outline btn-lg">Schedule Demo</a>
                    </div>
                    <p className="cta-note">No credit card required. Setup in 2 minutes.</p>
                </div>
            </section>

            {/* ── Footer ────────────────────────── */}
            <footer className="landing-footer">
                <div className="footer-inner">
                    <div className="footer-brand">
                        <LogoIcon size={24} color="black" />
                        <p>© 2026 MergerMindAI. Precision Standard.</p>
                    </div>
                    <div className="footer-links">
                        <a href="#">Privacy</a>
                        <a href="#">Terms</a>
                        <a href="#">Inquiries</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
