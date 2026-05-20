function TIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="2" y="4" width="20" height="5" rx="1.5" />
      <rect x="9.5" y="4" width="5" height="16" rx="1.5" />
      <rect x="2" y="13" width="3" height="3" rx="0.5" />
    </svg>
  );
}

export default function Logo({ className = '', iconClassName = '', textClassName = '', dark = false }) {
  const iconColor = dark ? 'text-white' : 'text-[#0A1B31]';
  const textColor = dark ? 'text-white' : 'text-[#0A1B31]';

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <TIcon className={`w-6 h-6 ${iconColor} ${iconClassName}`} />
      <span className={`font-display font-bold tracking-tight ${textColor} ${textClassName}`}>
        textlix
      </span>
    </span>
  );
}
