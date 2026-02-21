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
    // 16 points perfectly matches the uploaded geometric mandala
    return (
        <svg width={size} height={size} viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outermost Chevron Ring (Ring 1) */}
            <polygon
                points={getStarPoints(150, 150, 140, 100, 16)}
                stroke={color}
                strokeWidth="7"
                strokeLinejoin="miter"
                strokeMiterlimit="20"
            />
            {/* Second Chevron Ring (Ring 2) */}
            <polygon
                points={getStarPoints(150, 150, 115, 75, 16)}
                stroke={color}
                strokeWidth="7"
                strokeLinejoin="miter"
                strokeMiterlimit="20"
            />
            {/* Third Chevron Ring (Ring 3) */}
            <polygon
                points={getStarPoints(150, 150, 90, 50, 16)}
                stroke={color}
                strokeWidth="7"
                strokeLinejoin="miter"
                strokeMiterlimit="20"
            />
            {/* Solid Internal Spikes (Ring 4) */}
            <polygon
                points={getStarPoints(150, 150, 65, 20, 16)}
                fill={color}
            />
            {/* Center Donut Hole */}
            <circle
                cx="150" cy="150" r="8"
                stroke={color} strokeWidth="6"
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
