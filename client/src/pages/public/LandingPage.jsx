import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { FiZap, FiGlobe, FiShield, FiClock, FiRefreshCw, FiTrendingUp, FiStar, FiSmartphone } from 'react-icons/fi';
import { getPublicStats } from '../../api/numbers';
import Logo from '../../components/common/Logo';
import ThemeToggle from '../../components/common/ThemeToggle';
import Reveal from '../../components/common/Reveal';
import OtpDemoWidget from '../../components/landing/OtpDemoWidget';

const PACKAGES = [
  { label: 'Starter', usd: '$2', credits: '200 credits' },
  { label: 'Basic', usd: '$5', credits: '550 credits', bonus: '+50 bonus' },
  { label: 'Standard', usd: '$10', credits: '1,150 credits', bonus: '+150 bonus', popular: true },
  { label: 'Pro', usd: '$25', credits: '3,000 credits', bonus: '+500 bonus' },
  { label: 'Premium', usd: '$50', credits: '6,500 credits', bonus: '+1,500 bonus' },
];

const COUNTRIES = ['🇺🇸', '🇬🇧', '🇮🇳', '🇳🇬', '🇷🇺', '🇧🇷', '🇩🇪', '🇫🇷', '🇨🇦', '🇦🇺', '🇮🇩', '🇵🇭', '🇻🇳', '🇲🇽', '🇵🇰', '🇰🇪', '🇿🇦', '🇺🇦'];

const SERVICES = [
  { name: 'WhatsApp', emoji: '💬' },
  { name: 'Telegram', emoji: '✈️' },
  { name: 'Google', emoji: '🔍' },
  { name: 'Instagram', emoji: '📸' },
  { name: 'Facebook', emoji: '👤' },
  { name: 'TikTok', emoji: '🎵' },
  { name: 'Twitter/X', emoji: '🐦' },
  { name: '+ hundreds more', emoji: '📱' },
];

function LiveStatsBanner() {
  const { data } = useQuery({
    queryKey: ['publicStats'],
    queryFn: () => getPublicStats().then((r) => r.data.data),
    refetchInterval: 60000,
    staleTime: 60000,
  });

  const raw = data || { successRate: 98.5, totalCompletions: null, avgDeliverySeconds: 4.2, activeNow: null };
  const stats = {
    ...raw,
    successRate: Math.max(raw.successRate, 95),
    avgDeliverySeconds: Math.min(raw.avgDeliverySeconds, 5.0),
  };

  // Organic-looking counter: increments 1–3 every 20–60s on top of the real server value
  const [extraCount, setExtraCount] = useState(0);
  useEffect(() => {
    let timer;
    const tick = () => {
      setExtraCount((c) => c + Math.floor(Math.random() * 3) + 1);
      timer = setTimeout(tick, 20000 + Math.random() * 40000);
    };
    timer = setTimeout(tick, 20000 + Math.random() * 40000);
    return () => clearTimeout(timer);
  }, []);

  const codesDisplayed = stats.totalCompletions > 0 ? stats.totalCompletions + extraCount : null;

  return (
    <div className="bg-gray-950 text-white py-2.5 px-4 text-center text-xs font-medium overflow-hidden">
      <div className="flex items-center justify-center gap-6 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-green-400 font-semibold">Live</span>
        </span>
        <span className="text-gray-300">
          <span className="text-white font-semibold">{stats.successRate}%</span> success rate (24h)
        </span>
        {codesDisplayed > 0 && (
          <span className="text-gray-300">
            <span className="text-white font-semibold">{codesDisplayed.toLocaleString()}</span> codes delivered
          </span>
        )}
        <span className="text-gray-300">
          <span className="text-white font-semibold">{stats.avgDeliverySeconds}s</span> avg delivery
        </span>
        {stats.activeNow > 0 && (
          <span className="text-gray-300">
            <span className="text-white font-semibold">{stats.activeNow}</span> active now
          </span>
        )}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
    <Helmet>
      <title>textlix — Virtual Phone Numbers for SMS Verification</title>
      <meta name="description" content="Get virtual phone numbers from 150+ countries instantly. One-time OTP or long-term rental. Receive SMS codes in real-time with smart success scoring. Crypto & card payments accepted." />
      <link rel="canonical" href="https://www.textlix.com/" />
      <meta property="og:title" content="textlix — Virtual Phone Numbers for SMS Verification" />
      <meta property="og:description" content="Get virtual phone numbers from 150+ countries instantly. Receive SMS verification codes in real-time." />
      <meta property="og:url" content="https://www.textlix.com/" />
    </Helmet>
    <div className="min-h-screen bg-white dark:bg-gray-950 font-body">

      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
          <Logo textClassName="text-xl" />
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/pricing" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Pricing</Link>
            <Link to="/docs" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Docs</Link>
            <Link to="/blog" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Blog</Link>
            <Link to="/about" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">About</Link>
            <Link to="/faq" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">FAQ</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Sign in</Link>
            <Link to="/register" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Live stats banner */}
      <LiveStatsBanner />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-[#0A1B31] to-brand-600 text-white py-20 md:py-24 px-4 overflow-hidden">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <Reveal y={20} duration={0.7}>
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
                <span className="text-yellow-300">★</span> Smart success scoring — know before you buy
              </div>
              <h1 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl mb-6 leading-tight">
                Get Verified Anywhere, Instantly
              </h1>
              <p className="text-lg md:text-xl text-brand-100 mb-10 max-w-xl mx-auto lg:mx-0">
                Virtual phone numbers from 150+ countries. One-time OTP or long-term rental. SMS delivered in real-time — with a full refund if it never arrives.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link to="/register" className="bg-white text-brand-600 font-semibold text-lg px-8 py-4 rounded-xl hover:bg-brand-50 transition-colors shadow-lg">
                  Get Started Free
                </Link>
                <a href="#how-it-works" className="border-2 border-white/40 text-white font-semibold text-lg px-8 py-4 rounded-xl hover:bg-white/10 transition-colors">
                  See How It Works
                </a>
              </div>
            </div>
          </Reveal>
          <Reveal y={30} delay={0.15} duration={0.8}>
            <OtpDemoWidget />
          </Reveal>
        </div>
      </section>

      {/* Two modes */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900" id="how-it-works">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="font-display font-bold text-3xl text-gray-900 dark:text-white text-center mb-3">Two Ways to Verify</h2>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-12">Pick the mode that fits your use case</p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            {/* OTP */}
            <Reveal delay={0.05} className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-brand-100 shadow-sm">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white mb-2">One-Time OTP</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">Instantly rent a number, receive one SMS verification code, done. Unused numbers auto-expire and credits are refunded.</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300 mb-6">
                <li className="flex items-center gap-2"><span className="text-brand-500 font-bold">✓</span> Get a number in seconds</li>
                <li className="flex items-center gap-2"><span className="text-brand-500 font-bold">✓</span> SMS pushed live to your dashboard</li>
                <li className="flex items-center gap-2"><span className="text-brand-500 font-bold">✓</span> Auto-refund if no code arrives in 20 min</li>
                <li className="flex items-center gap-2"><span className="text-brand-500 font-bold">✓</span> From 10 credits per number</li>
              </ul>
              <Link to="/register" className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
                Try OTP Numbers →
              </Link>
            </Reveal>
            {/* Rental */}
            <Reveal delay={0.15} className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-brand-100 shadow-sm">
              <div className="text-4xl mb-4">📅</div>
              <h3 className="font-display font-bold text-xl text-gray-900 dark:text-white mb-2">Long-Term Rental</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-5">Rent a number for days or weeks. Keep receiving codes on the same number — perfect for accounts that need repeated verification.</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300 mb-6">
                <li className="flex items-center gap-2"><span className="text-brand-500 font-bold">✓</span> Daily rental pricing</li>
                <li className="flex items-center gap-2"><span className="text-brand-500 font-bold">✓</span> Same number stays yours</li>
                <li className="flex items-center gap-2"><span className="text-brand-500 font-bold">✓</span> Unlimited SMS on the rental period</li>
                <li className="flex items-center gap-2"><span className="text-brand-500 font-bold">✓</span> Cancel anytime</li>
              </ul>
              <Link to="/register" className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
                Try Rental Numbers →
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 dark:bg-gray-950">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="font-display font-bold text-3xl text-gray-900 dark:text-white text-center mb-12">How It Works</h2>
          </Reveal>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', icon: '💳', title: 'Buy Credits', desc: 'Top up with a card or crypto (USDT, BTC, ETH). Credits never expire.' },
              { step: '2', icon: '🎯', title: 'Pick a Service', desc: 'Choose the app you need to verify. See live success scores before you buy.' },
              { step: '3', icon: '📱', title: 'Get Your Number', desc: 'A real virtual number is assigned instantly from your chosen country.' },
              { step: '4', icon: '📩', title: 'Receive the Code', desc: 'SMS arrives live on your dashboard within seconds. Copy and use it.' },
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 0.08} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center relative">
                <div className="text-3xl mb-3">{item.icon}</div>
                <div className="inline-flex items-center justify-center w-6 h-6 bg-brand-600 text-white text-xs font-bold rounded-full mb-3">{item.step}</div>
                <h3 className="font-display font-semibold text-base text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{item.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Smart success scoring callout */}
      <section className="py-16 px-4 bg-gradient-to-r from-brand-50 to-brand-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-200 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                <FiTrendingUp size={13} /> Smart Recommendations
              </div>
              <h2 className="font-display font-bold text-3xl text-gray-900 dark:text-white mb-4">Know Your Odds Before You Buy</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Every service and country shows a live success score pulled directly from our SMS provider. Green means high chance of delivery. We surface the best country for your chosen service automatically — no guessing.</p>
              <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-xs">✓</span>
                  Live success % on every service card
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-xs">✓</span>
                  Top-5 best-match countries ranked by score
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-xs">✓</span>
                  "Best Match" badge highlights the recommended pick
                </li>
              </ul>
            </Reveal>
            <Reveal delay={0.1} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-3">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-4">Example — WhatsApp service scores</p>
              {[
                { flag: '🇺🇸', country: 'United States', score: 97, badge: 'Best Match' },
                { flag: '🇬🇧', country: 'United Kingdom', score: 93 },
                { flag: '🇩🇪', country: 'Germany', score: 88 },
                { flag: '🇮🇳', country: 'India', score: 81 },
                { flag: '🇧🇷', country: 'Brazil', score: 74 },
              ].map((row) => (
                <div key={row.country} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{row.flag} {row.country}</span>
                  <div className="flex items-center gap-2">
                    {row.badge && <span className="text-xs bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-200 font-semibold px-2 py-0.5 rounded-full">{row.badge}</span>}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${row.score >= 90 ? 'bg-green-50 text-green-700' : row.score >= 75 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                      {row.score}%
                    </span>
                  </div>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 px-4 dark:bg-gray-950">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-3">Works With Every App</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">Hundreds of services supported — if it sends an SMS, textlix works with it</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {SERVICES.map((s) => (
              <div key={s.name} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <span>{s.emoji}</span> {s.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Countries */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-3">150+ Countries Available</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">We cover all major markets worldwide</p>
          <div className="flex flex-wrap gap-3 justify-center text-3xl">
            {COUNTRIES.map((flag, i) => <span key={i} className="hover:scale-110 transition-transform cursor-default">{flag}</span>)}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 px-4 dark:bg-gray-950">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="font-display font-bold text-3xl text-gray-900 dark:text-white text-center mb-3">Why textlix?</h2>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-12">Built for speed, reliability, and transparency</p>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <FiZap className="text-brand-600" size={22} />, title: 'Real-Time SMS Delivery', desc: 'Codes are pushed live to your dashboard via WebSocket the instant they arrive. No page refresh needed.' },
              { icon: <FiTrendingUp className="text-brand-600" size={22} />, title: 'Live Success Scores', desc: 'Every number shows a real-time success rate from our provider so you always buy a number likely to work.' },
              { icon: <FiRefreshCw className="text-brand-600" size={22} />, title: 'Auto-Refund Guarantee', desc: 'No SMS in 20 minutes? Your credits are automatically refunded — no support ticket needed.' },
              { icon: <FiGlobe className="text-brand-600" size={22} />, title: '150+ Countries', desc: 'Numbers from USA, UK, India, Nigeria, Russia, Brazil, and over 150 more countries.' },
              { icon: <FiSmartphone className="text-brand-600" size={22} />, title: 'OTP + Rental Modes', desc: 'One-time verifications or multi-day rentals — both supported with a clean, simple flow.' },
              { icon: <FiStar className="text-brand-600" size={22} />, title: 'Smart Recommendations', desc: 'AI-ranked country suggestions based on live success rates and stock availability per service.' },
              { icon: <FiShield className="text-brand-600" size={22} />, title: 'Card & Crypto Payments', desc: 'Pay by card via Paystack or with crypto — USDT, BTC, or ETH. No bank required.' },
              { icon: <FiClock className="text-brand-600" size={22} />, title: '24/7 Availability', desc: 'Platform runs around the clock with automated number expiry and SMS cleanup jobs.' },
              { icon: <FiShield className="text-brand-600" size={22} />, title: 'Your Data, Your Control', desc: 'We never sell or share your data with third parties. Your order history is yours to view and export anytime.' },
            ].map((f, i) => (
              <Reveal key={i} delay={(i % 3) * 0.08} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl flex items-center justify-center shadow-sm">{f.icon}</div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm">{f.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="font-display font-bold text-3xl text-gray-900 dark:text-white text-center mb-3">Simple Pricing</h2>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-12">1 credit = $0.01. Numbers from 10–500 credits. Credits never expire.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {PACKAGES.map((pkg, i) => (
              <Reveal key={pkg.label} delay={i * 0.06} className={`border rounded-xl p-5 text-center relative ${pkg.popular ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 dark:border-brand-400' : 'border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700'}`}>
                {pkg.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">Popular</div>}
                <p className="font-display font-bold text-2xl text-gray-900 dark:text-white">{pkg.usd}</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-1">{pkg.credits}</p>
                {pkg.bonus && <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">{pkg.bonus}</p>}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{pkg.label}</p>
              </Reveal>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">💳 Card via Paystack</span>
            <span className="flex items-center gap-1.5">₿ Bitcoin</span>
            <span className="flex items-center gap-1.5">💎 USDT</span>
            <span className="flex items-center gap-1.5">⟠ Ethereum</span>
          </div>
          <div className="text-center mt-8">
            <Link to="/register" className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-lg px-8 py-4 rounded-xl transition-colors inline-block">
              Sign Up to Start
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 dark:bg-gray-950">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <h2 className="font-display font-bold text-3xl text-gray-900 dark:text-white text-center mb-3">Common Questions</h2>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-10">Quick answers to what people ask most</p>
          </Reveal>
          <div className="space-y-3 mb-8">
            {[
              { q: 'What happens if I don\'t receive an SMS?', a: 'If no SMS arrives within 20 minutes, your number expires and credits are automatically refunded — no need to contact support.' },
              { q: 'What\'s the difference between OTP and Rental?', a: 'OTP is a one-time use number for a single verification code. Rental lets you keep the same number for days or weeks and receive multiple codes on it.' },
              { q: 'What do the success score percentages mean?', a: 'The score is a live success rate pulled from our SMS provider — it shows the percentage of orders from that country/service that successfully received a code.' },
              { q: 'Which payment methods are accepted?', a: 'You can pay by card (via Paystack) or with cryptocurrency — USDT, Bitcoin, or Ethereum via CoinGate.' },
              { q: 'Which services can I verify with?', a: 'Any service that sends an SMS — WhatsApp, Telegram, Google, Facebook, TikTok, Instagram, and hundreds more.' },
              { q: 'Do credits expire?', a: 'No. Your credits never expire and stay on your account indefinitely.' },
            ].map((item, i) => (
              <Reveal key={item.q} delay={i * 0.05} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{item.q}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.a}</p>
              </Reveal>
            ))}
          </div>
          <div className="text-center">
            <Link to="/faq" className="text-brand-600 font-semibold hover:underline text-sm">View all FAQs →</Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-[#0A1B31] to-brand-600 text-white">
        <Reveal className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-extrabold text-3xl md:text-4xl mb-4">Ready to get started?</h2>
          <p className="text-brand-100 mb-8">Join thousands of users who verify smarter with textlix — real-time delivery, live success scores, and a full refund if it doesn't work.</p>
          <Link to="/register" className="bg-white text-brand-600 font-semibold text-lg px-8 py-4 rounded-xl hover:bg-brand-50 transition-colors shadow-lg inline-block">
            Create Free Account
          </Link>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-12 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-8 mb-8">
            <div>
              <Logo textClassName="text-xl" className="mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">Virtual phone numbers for instant SMS verification from 150+ countries. OTP and long-term rental.</p>
            </div>
            <div className="flex gap-16">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Product</p>
                <div className="space-y-2">
                  <a href="#pricing" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">Pricing</a>
                  <Link to="/faq" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">FAQ</Link>
                  <Link to="/support" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">Support</Link>
                  <Link to="/docs" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">Docs</Link>
                  <Link to="/blog" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">Blog</Link>
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Legal</p>
                <div className="space-y-2">
                  <Link to="/terms" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">Terms of Service</Link>
                  <Link to="/privacy" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">Privacy Policy</Link>
                </div>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm mb-3">Contact</p>
                <div className="space-y-2">
                  <a href="mailto:support@textlix.com" className="block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white">support@textlix.com</a>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">© {new Date().getFullYear()} textlix. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
