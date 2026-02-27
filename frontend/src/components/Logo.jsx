import './Logo.css';

const getStarPoints = (cx, cy, outerRadius, innerRadius, points) => {
    const result = [];
    const angle = Math.PI / points;
    for (let i = 0; i < 2 * points; i++) {
        const r = (i % 2 === 0) ? outerRadius : innerRadius;
        const a = i * angle - Math.PI / 2;
        result.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
    }
    return result.join(' ');
};

export function LogoIcon({ size = 32, color = 'white' }) {
    // 12 points matches the uploaded geometric mandala perfectly
    const strokeW = "3"; // Slight thin lines
    return (
        <svg width={size} height={size} viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outermost Chevron Ring */}
            <polygon
                points={getStarPoints(150, 150, 145, 100, 12)}
                stroke={color}
                strokeWidth={strokeW}
                strokeLinejoin="miter"
                strokeMiterlimit="20"
            />
            {/* Second Chevron Ring */}
            <polygon
                points={getStarPoints(150, 150, 120, 75, 12)}
                stroke={color}
                strokeWidth={strokeW}
                strokeLinejoin="miter"
                strokeMiterlimit="20"
            />
            {/* Third Chevron Ring */}
            <polygon
                points={getStarPoints(150, 150, 95, 50, 12)}
                stroke={color}
                strokeWidth={strokeW}
                strokeLinejoin="miter"
                strokeMiterlimit="20"
            />
            {/* Internal Petals */}
            <polygon
                points={getStarPoints(150, 150, 65, 18, 12)}
                stroke={color}
                strokeWidth={strokeW}
                strokeLinejoin="miter"
                strokeMiterlimit="20"
            />
            {/* Center Donut Hole */}
            <circle
                cx="150" cy="150" r="10"
                stroke={color} strokeWidth="4"
            />
        </svg>
    );
}

export function BrandLogo({ size = 28, variant = 'dark', className = '' }) {
    return (
        <div className={`brand-logo ${variant === 'light' ? 'brand-logo-light' : ''} ${className}`}>
            <LogoIcon size={size} color={variant === 'dark' ? 'black' : 'white'} />
            <span className="brand-name font-display">
                MergerMind<span className="brand-ai">AI</span>
            </span>
        </div>
    );
}
