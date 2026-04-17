interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

function Logo({ size = 32, showText = true, className = '' }: LogoProps) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      {/* Icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="40" height="40" rx="7" fill="#e63946" />

        {/* Speed lines */}
        <line x1="20" y1="19" x2="2"  y2="2"  stroke="white" strokeWidth="0.8" strokeOpacity="0.15" />
        <line x1="20" y1="19" x2="38" y2="2"  stroke="white" strokeWidth="0.8" strokeOpacity="0.15" />
        <line x1="20" y1="19" x2="2"  y2="38" stroke="white" strokeWidth="0.7" strokeOpacity="0.10" />
        <line x1="20" y1="19" x2="38" y2="38" stroke="white" strokeWidth="0.7" strokeOpacity="0.10" />
        <line x1="20" y1="19" x2="1"  y2="13" stroke="white" strokeWidth="0.6" strokeOpacity="0.09" />
        <line x1="20" y1="19" x2="39" y2="13" stroke="white" strokeWidth="0.6" strokeOpacity="0.09" />
        <line x1="20" y1="19" x2="1"  y2="27" stroke="white" strokeWidth="0.6" strokeOpacity="0.07" />
        <line x1="20" y1="19" x2="39" y2="27" stroke="white" strokeWidth="0.6" strokeOpacity="0.07" />

        {/* Left page */}
        <path d="M20 8.5 L5.5 10.5 L5.5 30.5 L20 28.5 Z" fill="white" fillOpacity="0.95" />
        {/* Right page */}
        <path d="M20 8.5 L34.5 10.5 L34.5 30.5 L20 28.5 Z" fill="white" fillOpacity="0.80" />

        {/* Panel lines – left */}
        <line x1="6.5"  y1="16.5" x2="19"   y2="15.8" stroke="#e63946" strokeWidth="1.1" strokeOpacity="0.60" strokeLinecap="round" />
        <line x1="6.5"  y1="22.5" x2="19"   y2="21.8" stroke="#e63946" strokeWidth="1.1" strokeOpacity="0.60" strokeLinecap="round" />

        {/* Panel lines – right */}
        <line x1="21"   y1="15.8" x2="33.5" y2="16.5" stroke="#c42b38" strokeWidth="1.1" strokeOpacity="0.45" strokeLinecap="round" />
        <line x1="21"   y1="21.8" x2="33.5" y2="22.5" stroke="#c42b38" strokeWidth="1.1" strokeOpacity="0.45" strokeLinecap="round" />

        {/* Spine */}
        <path d="M19.3 8.5 L20.7 8.5 L20.7 28.5 L19.3 28.5 Z" fill="#c42b38" fillOpacity="0.55" />
      </svg>

      {showText && (
        <span
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: size * 0.56,
            letterSpacing: '0.04em',
          }}
          className="text-textPrimary leading-none"
        >
          Kamoola
        </span>
      )}
    </span>
  );
}

export default Logo;
