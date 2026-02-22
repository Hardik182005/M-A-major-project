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
    // 16 points matches the uploaded geometric mandala
    const strokeW = "4"; // Thinner lines
    return (
        <svg width={size} height={size} viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outermost Chevron Ring (Ring 1) */}
            <polygon
                points={getStarPoints(150, 150, 145, 105, 16)}
                stroke={color}
                strokeWidth={strokeW}
                strokeLinejoin="miter"
                strokeMiterlimit="20"
            />
            {/* Second Chevron Ring (Ring 2) */}
            <polygon
                points={getStarPoints(150, 150, 120, 80, 16)}
                stroke={color}
                strokeWidth={strokeW}
                strokeLinejoin="miter"
                strokeMiterlimit="20"
            />
            {/* Third Chevron Ring (Ring 3) */}
            <polygon
                points={getStarPoints(150, 150, 95, 55, 16)}
                stroke={color}
                strokeWidth={strokeW}
                strokeLinejoin="miter"
                strokeMiterlimit="20"
            />
            {/* Internal Spikes (Ring 4) */}
            <polygon
                points={getStarPoints(150, 150, 68, 26, 16)}
                stroke={color}
                strokeWidth="5"
                strokeLinejoin="miter"
                strokeMiterlimit="20"
            />
            {/* Center Donut Hole */}
            <circle
                cx="150" cy="150" r="14"
                stroke={color} strokeWidth="12"
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
