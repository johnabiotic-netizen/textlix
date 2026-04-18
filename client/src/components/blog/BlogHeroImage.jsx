// Branded SVG hero illustrations for each blog post.
// All use TextLix brand colors — no external image dependencies.

function Base({ id, category, children }) {
  const w = category.length * 8 + 32;
  return (
    <svg viewBox="0 0 1200 500" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id={`bg-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3730a3" />
          <stop offset="55%" stopColor="#6d28d9" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>
        <linearGradient id={`card-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
        </linearGradient>
      </defs>
      {/* Background */}
      <rect width="1200" height="500" fill={`url(#bg-${id})`} />
      {/* Ambient circles */}
      <circle cx="1150" cy="60" r="240" fill="rgba(255,255,255,0.04)" />
      <circle cx="80"   cy="450" r="180" fill="rgba(255,255,255,0.04)" />
      <circle cx="600"  cy="250" r="350" fill="rgba(255,255,255,0.025)" />
      {/* Main illustration */}
      {children}
      {/* TextLix wordmark */}
      <text x="48" y="468" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="20" fontWeight="800" fill="rgba(255,255,255,0.5)" letterSpacing="-0.5">TextLix</text>
      {/* Category pill */}
      <rect x="48" y="28" rx="18" width={w} height="36" fill="rgba(255,255,255,0.18)" />
      <text x={48 + w / 2} y="51" textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="13" fontWeight="600" fill="white">{category}</text>
    </svg>
  );
}

// ── 1. WhatsApp Verification ─────────────────────────────────────────────────
function WhatsAppHero() {
  return (
    <Base id="whatsapp" category="Guide">
      {/* Phone body */}
      <rect x="490" y="100" rx="28" width="220" height="300" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      <rect x="510" y="125" rx="8"  width="180" height="250" fill="rgba(255,255,255,0.08)" />
      {/* Chat bubbles */}
      <rect x="530" y="160" rx="12" width="120" height="36" fill="rgba(255,255,255,0.25)" />
      <text x="590" y="183" textAnchor="middle" fontFamily="sans-serif" fontSize="13" fill="white">+44 7700 900123</text>
      <rect x="530" y="210" rx="12" width="100" height="36" fill="rgba(255,255,255,0.18)" />
      <text x="580" y="233" textAnchor="middle" fontFamily="sans-serif" fontSize="20" fill="white">897 241</text>
      {/* Double tick */}
      <text x="590" y="278" textAnchor="middle" fontFamily="sans-serif" fontSize="22" fill="rgba(255,255,255,0.9)">✓✓</text>
      {/* Signal badge */}
      <circle cx="820" cy="200" r="60" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <text x="820" y="195" textAnchor="middle" fontFamily="sans-serif" fontSize="26" fill="white">💬</text>
      <text x="820" y="220" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="11" fontWeight="600" fill="rgba(255,255,255,0.7)">SMS</text>
      {/* Headline */}
      <text x="600" y="440" textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="28" fontWeight="700" fill="white">WhatsApp Verification with a Virtual Number</text>
    </Base>
  );
}

// ── 2. OTP vs Rental ─────────────────────────────────────────────────────────
function OtpVsRentalHero() {
  return (
    <Base id="otpvsrental" category="Explainer">
      {/* OTP card */}
      <rect x="270" y="120" rx="20" width="240" height="260" fill={`url(#card-otpvsrental)`} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <text x="390" y="180" textAnchor="middle" fontFamily="sans-serif" fontSize="44">⚡</text>
      <text x="390" y="228" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="24" fontWeight="700" fill="white">OTP</text>
      <text x="390" y="258" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="13" fill="rgba(255,255,255,0.7)">One-time use</text>
      <text x="390" y="282" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="13" fill="rgba(255,255,255,0.7)">20-minute window</text>
      <text x="390" y="306" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="13" fill="rgba(255,255,255,0.7)">Auto-refund if unused</text>
      {/* VS divider */}
      <circle cx="600" cy="250" r="32" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      <text x="600" y="258" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="16" fontWeight="700" fill="white">VS</text>
      {/* Rental card */}
      <rect x="690" y="120" rx="20" width="240" height="260" fill={`url(#card-otpvsrental)`} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <text x="810" y="180" textAnchor="middle" fontFamily="sans-serif" fontSize="44">🏢</text>
      <text x="810" y="228" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="24" fontWeight="700" fill="white">Rental</text>
      <text x="810" y="258" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="13" fill="rgba(255,255,255,0.7)">Long-term hosting</text>
      <text x="810" y="282" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="13" fill="rgba(255,255,255,0.7)">Hours or days</text>
      <text x="810" y="306" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="13" fill="rgba(255,255,255,0.7)">Any platform SMS</text>
      {/* Headline */}
      <text x="600" y="440" textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="26" fontWeight="700" fill="white">OTP vs Rental — Know Which to Use</text>
    </Base>
  );
}

// ── 3. Best Countries ────────────────────────────────────────────────────────
function BestCountriesHero() {
  return (
    <Base id="countries" category="Tips">
      {/* Globe circle */}
      <circle cx="600" cy="230" r="140" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      {/* Latitude lines */}
      <ellipse cx="600" cy="230" rx="140" ry="50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <ellipse cx="600" cy="230" rx="140" ry="100" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <line x1="460" y1="230" x2="740" y2="230" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <line x1="600" y1="90"  x2="600" y2="370" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      {/* Country pins */}
      {[
        { x: 545, y: 175, flag: '🇬🇧' },
        { x: 490, y: 195, flag: '🇺🇸' },
        { x: 560, y: 205, flag: '🇩🇪' },
        { x: 635, y: 190, flag: '🇷🇺' },
        { x: 620, y: 265, flag: '🇮🇳' },
      ].map(({ x, y, flag }, i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="18" fill="rgba(255,255,255,0.2)" />
          <text x={x} y={y + 6} textAnchor="middle" fontSize="16">{flag}</text>
        </g>
      ))}
      {/* 150+ badge */}
      <circle cx="820" cy="180" r="64" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <text x="820" y="172" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="26" fontWeight="800" fill="white">150+</text>
      <text x="820" y="196" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="12" fill="rgba(255,255,255,0.7)">countries</text>
      {/* Headline */}
      <text x="600" y="440" textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="26" fontWeight="700" fill="white">Best Countries for SMS Verification</text>
    </Base>
  );
}

// ── 4. SMS API for Developers ────────────────────────────────────────────────
function SmsApiHero() {
  return (
    <Base id="smsapi" category="Guide">
      {/* Terminal window */}
      <rect x="330" y="100" rx="14" width="540" height="300" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      {/* Title bar */}
      <rect x="330" y="100" rx="14" width="540" height="40" fill="rgba(255,255,255,0.1)" />
      <circle cx="360" cy="120" r="7" fill="rgba(255,100,100,0.7)" />
      <circle cx="384" cy="120" r="7" fill="rgba(255,200,50,0.7)" />
      <circle cx="408" cy="120" r="7" fill="rgba(100,220,100,0.7)" />
      <text x="600" y="125" textAnchor="middle" fontFamily="monospace" fontSize="12" fill="rgba(255,255,255,0.5)">TextLix API</text>
      {/* Code lines */}
      <text x="358" y="168" fontFamily="monospace" fontSize="13" fill="rgba(167,139,250,1)">POST</text>
      <text x="405" y="168" fontFamily="monospace" fontSize="13" fill="rgba(255,255,255,0.8)">/api/v1/numbers/order</text>
      <text x="358" y="198" fontFamily="monospace" fontSize="13" fill="rgba(255,255,255,0.4)">{'{'}</text>
      <text x="378" y="220" fontFamily="monospace" fontSize="13" fill="rgba(134,239,172,1)">"country":</text>
      <text x="478" y="220" fontFamily="monospace" fontSize="13" fill="rgba(253,186,116,1)">"US"</text>
      <text x="378" y="242" fontFamily="monospace" fontSize="13" fill="rgba(134,239,172,1)">"service":</text>
      <text x="478" y="242" fontFamily="monospace" fontSize="13" fill="rgba(253,186,116,1)">"telegram"</text>
      <text x="358" y="262" fontFamily="monospace" fontSize="13" fill="rgba(255,255,255,0.4)">{'}'}</text>
      {/* Response */}
      <text x="358" y="295" fontFamily="monospace" fontSize="13" fill="rgba(134,239,172,0.9)">✓ 200 OK — SMS delivered in 4.2s</text>
      <text x="358" y="317" fontFamily="monospace" fontSize="12" fill="rgba(167,139,250,0.8)">"phone": "+1 415 555 0182"</text>
      {/* Headline */}
      <text x="600" y="440" textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="26" fontWeight="700" fill="white">Best SMS API for Developers in 2026</text>
    </Base>
  );
}

// ── 5. 5sim Alternatives ─────────────────────────────────────────────────────
function FivesimAlternativesHero() {
  const items = [
    { label: 'TextLix', score: '★★★★★', highlight: true },
    { label: 'SMS-Man',   score: '★★★★☆', highlight: false },
    { label: 'OnlineSIM', score: '★★★★☆', highlight: false },
    { label: 'Grizzly SMS', score: '★★★☆☆', highlight: false },
    { label: 'SimSMS',    score: '★★★☆☆', highlight: false },
  ];
  return (
    <Base id="alternatives" category="Comparison">
      <text x="600" y="115" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="18" fontWeight="600" fill="rgba(255,255,255,0.6)">SMS Verification Platforms Compared</text>
      {items.map(({ label, score, highlight }, i) => (
        <g key={i}>
          <rect x="320" y={140 + i * 54} rx="10" width="560" height="44"
            fill={highlight ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)'}
            stroke={highlight ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.12)'}
            strokeWidth="1" />
          {highlight && (
            <rect x="320" y={140 + i * 54} rx="10" width="4" height="44" fill="white" />
          )}
          <text x="348" y={167 + i * 54} fontFamily="-apple-system,sans-serif" fontSize="15" fontWeight={highlight ? '700' : '400'} fill="white">{label}</text>
          {highlight && <text x="445" y={167 + i * 54} fontFamily="-apple-system,sans-serif" fontSize="11" fontWeight="600" fill="rgba(167,139,250,1)">  ← Best choice</text>}
          <text x="844" y={167 + i * 54} textAnchor="end" fontFamily="-apple-system,sans-serif" fontSize="15" fill={highlight ? 'rgba(253,224,71,1)' : 'rgba(255,255,255,0.5)'}>{score}</text>
        </g>
      ))}
      <text x="600" y="450" textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="22" fontWeight="700" fill="white">Best SMS Verification Alternatives in 2026</text>
    </Base>
  );
}

// ── 6. OTP for Business ──────────────────────────────────────────────────────
function OtpBusinessHero() {
  return (
    <Base id="otpbiz" category="Business">
      {/* Building */}
      <rect x="380" y="150" rx="6" width="180" height="220" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      {[0,1,2,3].map(row => [0,1,2].map(col => (
        <rect key={`${row}-${col}`} x={400 + col * 46} y={170 + row * 48} rx="4" width="32" height="30" fill="rgba(255,255,255,0.18)" />
      )))}
      {/* Door */}
      <rect x="450" y="318" rx="4" width="40" height="52" fill="rgba(255,255,255,0.25)" />
      {/* Shield */}
      <path d="M720,140 L800,170 L800,250 Q800,300 760,330 Q720,300 720,250 Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      <text x="762" y="248" textAnchor="middle" fontFamily="sans-serif" fontSize="36">🔒</text>
      {/* OTP badge */}
      <rect x="700" y="310" rx="10" width="120" height="40" fill="rgba(255,255,255,0.2)" />
      <text x="760" y="335" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="14" fontWeight="700" fill="white">OTP Verified ✓</text>
      {/* Headline */}
      <text x="600" y="440" textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="26" fontWeight="700" fill="white">Best OTP Verification Services for Business</text>
    </Base>
  );
}

// ── 7. Privacy / Virtual Number ──────────────────────────────────────────────
function PrivacyHero() {
  return (
    <Base id="privacy" category="Privacy">
      {/* Shield */}
      <path d="M540,90 L700,130 L700,270 Q700,360 620,400 Q540,360 540,270 Z" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      {/* Lock body */}
      <rect x="586" y="230" rx="8" width="68" height="56" fill="rgba(255,255,255,0.3)" />
      {/* Lock shackle */}
      <path d="M598,230 L598,210 Q620,185 642,210 L642,230" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="4" strokeLinecap="round" />
      {/* Keyhole */}
      <circle cx="620" cy="252" r="8" fill="rgba(0,0,0,0.3)" />
      <rect x="617" y="256" rx="2" width="6" height="12" fill="rgba(0,0,0,0.3)" />
      {/* Real number crossed out */}
      <rect x="760" y="160" rx="10" width="180" height="44" fill="rgba(255,255,255,0.08)" stroke="rgba(255,100,100,0.5)" strokeWidth="1.5" />
      <text x="850" y="187" textAnchor="middle" fontFamily="monospace" fontSize="14" fill="rgba(255,255,255,0.4)">+44 7700 900456</text>
      <line x1="760" y1="182" x2="940" y2="182" stroke="rgba(255,100,100,0.7)" strokeWidth="2" />
      {/* Virtual number shown */}
      <rect x="760" y="224" rx="10" width="180" height="44" fill="rgba(255,255,255,0.18)" stroke="rgba(134,239,172,0.5)" strokeWidth="1.5" />
      <text x="850" y="251" textAnchor="middle" fontFamily="monospace" fontSize="14" fill="white">Virtual ✓ Private</text>
      {/* Headline */}
      <text x="600" y="440" textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="26" fontWeight="700" fill="white">Protect Your Privacy with a Virtual Number</text>
    </Base>
  );
}

// ── 8. US Phone Number ───────────────────────────────────────────────────────
function UsPhoneHero() {
  return (
    <Base id="usphone" category="Guide">
      {/* US flag stripes (simplified) */}
      {[0,1,2,3,4,5,6].map(i => (
        <rect key={i} x="280" y={120 + i * 30} rx="0" width="200" height="30" fill={i % 2 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'} />
      ))}
      {/* Stars canton */}
      <rect x="280" y="120" rx="0" width="90" height="120" fill="rgba(63,100,200,0.4)" />
      {[0,1,2,3].map(row => [0,1,2].map(col => (
        <text key={`${row}-${col}`} x={291 + col * 25} y={138 + row * 28} fontSize="13" fill="rgba(255,255,255,0.7)">★</text>
      )))}
      {/* Phone */}
      <rect x="530" y="110" rx="24" width="180" height="280" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      <rect x="548" y="134" rx="8" width="144" height="232" fill="rgba(0,0,0,0.2)" />
      <text x="620" y="230" textAnchor="middle" fontFamily="monospace" fontSize="22" fontWeight="700" fill="white">+1 (415)</text>
      <text x="620" y="260" textAnchor="middle" fontFamily="monospace" fontSize="22" fontWeight="700" fill="white">555 0182</text>
      <rect x="565" y="290" rx="8" width="110" height="32" fill="rgba(134,239,172,0.3)" />
      <text x="620" y="311" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="13" fontWeight="600" fill="rgba(134,239,172,1)">US Number ✓</text>
      {/* Headline */}
      <text x="600" y="440" textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="24" fontWeight="700" fill="white">Get a US Phone Number — No SIM Required</text>
    </Base>
  );
}

// ── 9. Telegram Verification ─────────────────────────────────────────────────
function TelegramHero() {
  return (
    <Base id="telegram" category="Guide">
      {/* Paper plane (Telegram icon shape) — TextLix branded, not Telegram blue */}
      <path d="M480,180 L760,250 L660,380 Z" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      <path d="M480,180 L660,380 L630,300 Z" fill="rgba(255,255,255,0.1)" />
      <path d="M480,180 L760,250 L630,300 Z" fill="rgba(255,255,255,0.08)" />
      {/* Phone */}
      <rect x="760" y="140" rx="18" width="140" height="240" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <rect x="776" y="160" rx="6" width="108" height="200" fill="rgba(0,0,0,0.2)" />
      {/* Verification code in phone */}
      <text x="830" y="248" textAnchor="middle" fontFamily="monospace" fontSize="20" fontWeight="700" fill="white">84 291</text>
      <rect x="792" y="264" rx="6" width="76" height="24" fill="rgba(167,139,250,0.4)" />
      <text x="830" y="281" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="11" fontWeight="600" fill="white">Code received ✓</text>
      {/* TextLix shield badge */}
      <circle cx="390" cy="280" r="55" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <text x="390" y="272" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="13" fontWeight="700" fill="white">TextLix</text>
      <text x="390" y="292" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="11" fill="rgba(255,255,255,0.6)">verified</text>
      {/* Headline */}
      <text x="600" y="440" textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="24" fontWeight="700" fill="white">Verify Telegram Without Your Real Number</text>
    </Base>
  );
}

// ── 10. Virtual Numbers for Business (full guide) ────────────────────────────
function BusinessGuideHero() {
  const bars = [60, 95, 75, 120, 100, 140, 110];
  return (
    <Base id="bizguide" category="Business">
      {/* Dashboard card */}
      <rect x="300" y="100" rx="16" width="600" height="300" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* Bar chart */}
      {bars.map((h, i) => (
        <rect key={i} x={340 + i * 60} y={360 - h} rx="6" width="40" height={h}
          fill={`rgba(255,255,255,${0.15 + i * 0.04})`} />
      ))}
      {/* Chart baseline */}
      <line x1="320" y1="360" x2="780" y2="360" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* Metric cards */}
      <rect x="330" y="118" rx="10" width="130" height="72" fill="rgba(255,255,255,0.1)" />
      <text x="395" y="148" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="26" fontWeight="800" fill="white">150+</text>
      <text x="395" y="170" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="11" fill="rgba(255,255,255,0.6)">countries</text>
      <rect x="480" y="118" rx="10" width="130" height="72" fill="rgba(255,255,255,0.1)" />
      <text x="545" y="148" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="26" fontWeight="800" fill="white">30–60%</text>
      <text x="545" y="170" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="11" fill="rgba(255,255,255,0.6)">gross margin</text>
      <rect x="630" y="118" rx="10" width="130" height="72" fill="rgba(255,255,255,0.1)" />
      <text x="695" y="148" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="26" fontWeight="800" fill="white">&lt;5s</text>
      <text x="695" y="170" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="11" fill="rgba(255,255,255,0.6)">SMS delivery</text>
      {/* Headline */}
      <text x="600" y="445" textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="24" fontWeight="700" fill="white">Virtual Phone Numbers for Business — 2026 Guide</text>
    </Base>
  );
}

// ── 11. Phone Number Privacy Weakest Link ────────────────────────────────────
function PhonePrivacyHero() {
  return (
    <Base id="phoneprivacy" category="Privacy">
      {/* Chain links */}
      {[0, 1, 3, 4].map(i => (
        <ellipse key={i} cx={280 + i * 90} cy="230" rx="38" ry="22" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="8" />
      ))}
      {/* Broken/cracked link in center */}
      <ellipse cx="550" cy="230" rx="38" ry="22" fill="rgba(255,100,100,0.15)" stroke="rgba(255,120,120,0.6)" strokeWidth="8" strokeDasharray="12 6" />
      <text x="550" y="238" textAnchor="middle" fontFamily="sans-serif" fontSize="20">💥</text>
      {/* Labels */}
      <text x="280" y="275" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="11" fill="rgba(255,255,255,0.5)">Bank</text>
      <text x="370" y="275" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="11" fill="rgba(255,255,255,0.5)">Google</text>
      <text x="550" y="278" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="11" fill="rgba(255,120,120,0.8)">Phone No.</text>
      <text x="730" y="275" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="11" fill="rgba(255,255,255,0.5)">WhatsApp</text>
      <text x="820" y="275" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="11" fill="rgba(255,255,255,0.5)">Meta</text>
      {/* Warning badge */}
      <circle cx="880" cy="170" r="55" fill="rgba(255,100,50,0.15)" stroke="rgba(255,120,80,0.4)" strokeWidth="1.5" />
      <text x="880" y="160" textAnchor="middle" fontFamily="sans-serif" fontSize="28">⚠️</text>
      <text x="880" y="188" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="11" fontWeight="600" fill="rgba(255,180,120,0.9)">Weak Link</text>
      {/* Solution box */}
      <rect x="680" y="300" rx="10" width="220" height="40" fill="rgba(134,239,172,0.15)" stroke="rgba(134,239,172,0.4)" strokeWidth="1" />
      <text x="790" y="325" textAnchor="middle" fontFamily="-apple-system,sans-serif" fontSize="13" fontWeight="600" fill="rgba(134,239,172,1)">Virtual numbers protect you ✓</text>
      {/* Headline */}
      <text x="600" y="445" textAnchor="middle" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="22" fontWeight="700" fill="white">Your Phone Number is Your Weakest Privacy Link</text>
    </Base>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────
const HERO_MAP = {
  'how-to-get-virtual-phone-number-whatsapp':          WhatsAppHero,
  'otp-vs-rental-number-difference':                   OtpVsRentalHero,
  'best-countries-sms-verification-2025':              BestCountriesHero,
  'best-sms-api-developers-2026':                      SmsApiHero,
  'top-5-5sim-alternatives-sms-verification':          FivesimAlternativesHero,
  'best-otp-verification-services-businesses':         OtpBusinessHero,
  'protect-privacy-virtual-phone-number':              PrivacyHero,
  'how-to-get-us-phone-number-without-sim-card':       UsPhoneHero,
  'how-to-verify-telegram-without-real-phone-number':  TelegramHero,
  'virtual-phone-numbers-for-business-complete-guide-2026': BusinessGuideHero,
  'why-your-phone-number-is-your-weakest-privacy-link': PhonePrivacyHero,
};

export default function BlogHeroImage({ slug, className = '', style = {} }) {
  const Component = HERO_MAP[slug];
  if (!Component) return null;
  return (
    <div className={className} style={{ background: 'linear-gradient(135deg,#3730a3,#6d28d9)', ...style }}>
      <Component />
    </div>
  );
}
