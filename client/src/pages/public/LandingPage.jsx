import { Link } from 'react-router-dom';
import { FiZap, FiGlobe, FiShield, FiClock } from 'react-icons/fi';

const PACKAGES = [
  { label: 'Starter', usd: '$2', credits: '200 credits' },
  { label: 'Basic', usd: '$5', credits: '550 credits', bonus: '+50 bonus' },
  { label: 'Standard', usd: '$10', credits: '1,150 credits', bonus: '+150 bonus', popular: true },
  { label: 'Pro', usd: '$25', credits: '3,000 credits', bonus: '+500 bonus' },
  { label: 'Premium', usd: '$50', credits: '6,500 credits', bonus: '+1,500 bonus' },
];

const COUNTRIES = ['🇺🇸', '🇬🇧', '🇮🇳', '🇳🇬', '🇷🇺', '🇧🇷', '🇩🇪', '🇫🇷', '🇨🇦', '🇦🇺', '🇮🇩', '🇵🇭', '🇻🇳', '🇲🇽', '🇵🇰', '🇰🇪', '🇿🇦', '🇺🇦'];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-body">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 font-display font-bold text-xl text-gray-900">
            <span>✓</span> VerifyNow
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">Sign in</Link>
            <Link to="/register" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-600 to-purple-600 text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display font-extrabold text-5xl md:text-6xl mb-6 leading-tight">
            Get Verified Anywhere, Instantly
          </h1>
          <p className="text-lg md:text-xl text-brand-100 mb-10 max-w-2xl mx-auto">
            Buy virtual phone numbers from 50+ countries and receive SMS verification codes in real-time. No SIM card needed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="bg-white text-brand-600 font-semibold text-lg px-8 py-4 rounded-xl hover:bg-brand-50 transition-colors shadow-lg">
              Get Started Free
            </Link>
            <a href="#pricing" className="border-2 border-white/40 text-white font-semibold text-lg px-8 py-4 rounded-xl hover:bg-white/10 transition-colors">
              See Pricing
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-3xl text-gray-900 text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', icon: '💳', title: 'Buy Credits', desc: 'Purchase credits securely with your card or cryptocurrency.' },
              { step: '2', icon: '📱', title: 'Choose a Number', desc: 'Pick a country and service, get a real virtual number instantly.' },
              { step: '3', icon: '📩', title: 'Get Your Code', desc: 'SMS arrives in real-time on your dashboard. Copy the code.' },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-xl p-6 shadow-sm text-center">
                <div className="text-4xl mb-4">{item.icon}</div>
                <div className="inline-flex items-center justify-center w-7 h-7 bg-brand-600 text-white text-xs font-bold rounded-full mb-3">{item.step}</div>
                <h3 className="font-display font-semibold text-lg text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Countries */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl text-gray-900 mb-3">50+ Countries Available</h2>
          <p className="text-gray-500 mb-8">We cover all major markets worldwide</p>
          <div className="flex flex-wrap gap-3 justify-center text-3xl">
            {COUNTRIES.map((flag, i) => <span key={i} className="hover:scale-110 transition-transform cursor-default">{flag}</span>)}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-3xl text-gray-900 text-center mb-12">Why VerifyNow?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: <FiZap className="text-brand-600" size={24} />, title: 'Instant SMS Delivery', desc: 'SMS codes appear on your screen within seconds of being sent.' },
              { icon: <FiGlobe className="text-brand-600" size={24} />, title: '50+ Countries', desc: 'Numbers from USA, UK, India, Nigeria, Russia, and dozens more.' },
              { icon: <FiShield className="text-brand-600" size={24} />, title: 'Secure & Private', desc: 'SMS content auto-deleted after 24 hours. No data retention.' },
              { icon: <FiClock className="text-brand-600" size={24} />, title: '24/7 Availability', desc: 'Platform runs around the clock. Numbers available anytime.' },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center">{f.icon}</div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                  <p className="text-sm text-gray-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-3xl text-gray-900 text-center mb-3">Simple Pricing</h2>
          <p className="text-gray-500 text-center mb-12">1 credit = $0.01. Numbers from 10–500 credits.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {PACKAGES.map((pkg) => (
              <div key={pkg.label} className={`border rounded-xl p-5 text-center relative ${pkg.popular ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'}`}>
                {pkg.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">Popular</div>}
                <p className="font-display font-bold text-2xl text-gray-900">{pkg.usd}</p>
                <p className="text-sm font-semibold text-gray-700 mt-1">{pkg.credits}</p>
                {pkg.bonus && <p className="text-xs text-green-600 font-medium mt-1">{pkg.bonus}</p>}
                <p className="text-xs text-gray-400 mt-1">{pkg.label}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/register" className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-lg px-8 py-4 rounded-xl transition-colors inline-block">
              Sign Up to Start
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">© 2024 VerifyNow. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-gray-700">Terms</a>
            <a href="#" className="hover:text-gray-700">Privacy</a>
            <a href="#" className="hover:text-gray-700">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
