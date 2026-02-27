import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/Logo';
import './AuthPages.css';

export default function SecurityPage() {
    const navigate = useNavigate();

    return (
        <div className="security-page pattern-bg" style={{ minHeight: '100vh', padding: '80px 24px', background: '#fff' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' }}>
                    <BrandLogo size={32} variant="dark" />
                    <button onClick={() => navigate(-1)} className="btn btn-outline" style={{ borderRadius: '99px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '4px' }}>arrow_back</span>
                        Go Back
                    </button>
                </nav>

                <header style={{ marginBottom: '80px' }}>
                    <div className="hero-badge" style={{ marginBottom: '16px' }}>SYSTEM INFRASTRUCTURE</div>
                    <h1 className="font-display" style={{ fontSize: '48px', color: '#18181B', marginBottom: '24px' }}>
                        Security, Privacy & <br />
                        <span style={{ color: '#71717A' }}>The SLM+VLM Multi-Layer AI Pipeline.</span>
                    </h1>
                    <p style={{ fontSize: '18px', color: '#52525B', lineHeight: '1.6', maxWidth: '700px' }}>
                        MergerMindAI is built for zero-trust environments. Unlike traditional AI data rooms, we process sensitive M&A intelligence locally—ensuring classified documents never leave your secure perimeter.
                    </p>
                </header>

                <div className="security-detailed-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '40px' }}>

                    {/* Layer 1 */}
                    <div className="card" style={{ padding: '32px', border: '1px solid #E4E4E7' }}>
                        <div style={{ background: '#F4F4F5', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                            <span className="material-symbols-outlined">layers</span>
                        </div>
                        <h3 className="font-display" style={{ fontSize: '20px', marginBottom: '12px' }}>Layer 1: The VLM Engine (Visual Language Model)</h3>
                        <p style={{ color: '#71717A', fontSize: '15px', lineHeight: '1.6' }}>
                            We utilize <strong>Donut (Visual-Geometric Models)</strong> to extract document structure natively. Instead of simple OCR, our VLM understands complex tables, nested signatures, and irregular layouts by processing pixels directly—preserving the visual integrity of your legal contracts.
                        </p>
                    </div>

                    {/* Layer 2 */}
                    <div className="card" style={{ padding: '32px', border: '1px solid #E4E4E7' }}>
                        <div style={{ background: '#F4F4F5', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                            <span className="material-symbols-outlined">psychology</span>
                        </div>
                        <h3 className="font-display" style={{ fontSize: '20px', marginBottom: '12px' }}>Layer 2: The SLM Core (Small Language Models)</h3>
                        <p style={{ color: '#71717A', fontSize: '15px', lineHeight: '1.6' }}>
                            For high-speed redaction and PII (Personally Identifiable Information) detection, we deploy local <strong>SLMs</strong>. By using optimized models like Llama-3-8B and Phi-3 via <strong>Ollama</strong>, we achieve sub-second latency for PII masking without sending a single byte to external APIs.
                        </p>
                    </div>

                    {/* Layer 3 */}
                    <div className="card" style={{ padding: '32px', border: '1px solid #E4E4E7' }}>
                        <div style={{ background: '#F4F4F5', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                            <span className="material-symbols-outlined">security</span>
                        </div>
                        <h3 className="font-display" style={{ fontSize: '20px', marginBottom: '12px' }}>Layer 3: The LLM Intelligence Layer</h3>
                        <p style={{ color: '#71717A', fontSize: '15px', lineHeight: '1.6' }}>
                            Our deep-reasoning layer utilizes high-fidelity <strong>Large Language Models</strong> for risk assessments and liability analysis. These models are self-hosted within the environment, providing expert-level advice on transaction risks while maintaining the absolute privacy of the virtual data room.
                        </p>
                    </div>

                    {/* Tech Stack */}
                    <div className="card" style={{ padding: '32px', border: '1px solid #E4E4E7', background: '#09090B', color: '#fff' }}>
                        <h3 className="font-display" style={{ fontSize: '20px', marginBottom: '20px' }}>Full Tech Stack:</h3>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            <li style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#A1A1AA' }}>check_circle</span>
                                <strong>Frontend:</strong> React.js, Vite, Vanilla CSS
                            </li>
                            <li style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#A1A1AA' }}>check_circle</span>
                                <strong>Backend:</strong> Python FastAPI, SQLAlchemy
                            </li>
                            <li style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#A1A1AA' }}>check_circle</span>
                                <strong>AI Runtime:</strong> Ollama (Local LLM/SLM)
                            </li>
                            <li style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#A1A1AA' }}>check_circle</span>
                                <strong>Database:</strong> SQLite (Local-First Disk Storage)
                            </li>
                            <li style={{ marginBottom: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#A1A1AA' }}>check_circle</span>
                                <strong>OCR:</strong> Docling Geometric Parsing
                            </li>
                        </ul>
                    </div>
                </div>

                <footer style={{ marginTop: '100px', borderTop: '1px solid #E4E4E7', paddingTop: '40px', textAlign: 'center' }}>
                    <p style={{ color: '#71717A', fontSize: '14px' }}>© 2026 MergerMindAI Corporate Data Protection Standards.</p>
                </footer>
            </div>
        </div>
    );
}
