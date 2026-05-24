/**
 * Continuous horizontal marquee of country flags.
 * The flag list is duplicated so the CSS keyframe can loop seamlessly
 * (translate from 0% to -50% over the duplicated track).
 * Pauses on hover.
 */

const FLAGS = [
  '🇺🇸', '🇬🇧', '🇮🇳', '🇳🇬', '🇷🇺', '🇧🇷', '🇩🇪', '🇫🇷', '🇨🇦', '🇦🇺',
  '🇮🇩', '🇵🇭', '🇻🇳', '🇲🇽', '🇵🇰', '🇰🇪', '🇿🇦', '🇺🇦', '🇪🇸', '🇮🇹',
  '🇳🇱', '🇵🇱', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮', '🇵🇹', '🇧🇪', '🇦🇹', '🇨🇭',
  '🇬🇷', '🇷🇴', '🇨🇿', '🇭🇺', '🇸🇰', '🇮🇪', '🇱🇹', '🇱🇻', '🇪🇪', '🇧🇬',
  '🇰🇿', '🇰🇭', '🇲🇩', '🇵🇾', '🇸🇦', '🇪🇬', '🇲🇦', '🇮🇱', '🇹🇷', '🇨🇳',
  '🇯🇵', '🇰🇷', '🇹🇼', '🇭🇰', '🇲🇾', '🇸🇬', '🇹🇭', '🇦🇷', '🇨🇴', '🇨🇱',
];

export default function CountryMarquee() {
  // Duplicate so the translateX loop is seamless
  const track = [...FLAGS, ...FLAGS];

  return (
    <div
      className="relative overflow-hidden group"
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
      }}
    >
      <div className="flex gap-6 w-max animate-marquee group-hover:[animation-play-state:paused]">
        {track.map((flag, i) => (
          <span
            key={i}
            className="text-3xl md:text-4xl hover:scale-125 transition-transform cursor-default select-none"
          >
            {flag}
          </span>
        ))}
      </div>
    </div>
  );
}
