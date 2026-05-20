import { useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

const COUNTRY_DATA = {
  us: { name: 'United States', flag: '🇺🇸', article: 'a' },
  gb: { name: 'United Kingdom', flag: '🇬🇧', article: 'a' },
  ca: { name: 'Canada', flag: '🇨🇦', article: 'a' },
  au: { name: 'Australia', flag: '🇦🇺', article: 'an' },
  de: { name: 'Germany', flag: '🇩🇪', article: 'a' },
  fr: { name: 'France', flag: '🇫🇷', article: 'a' },
  ru: { name: 'Russia', flag: '🇷🇺', article: 'a' },
  in: { name: 'India', flag: '🇮🇳', article: 'an' },
  ng: { name: 'Nigeria', flag: '🇳🇬', article: 'a' },
  br: { name: 'Brazil', flag: '🇧🇷', article: 'a' },
};

const SERVICE_DATA = {
  whatsapp: { name: 'WhatsApp', emoji: '💬', description: 'Create a WhatsApp account without using your personal phone number.' },
  telegram: { name: 'Telegram', emoji: '✈️', description: 'Sign up for Telegram privately using a virtual number.' },
  google:   { name: 'Google', emoji: '🔍', description: 'Verify a Google or Gmail account with a virtual number.' },
  instagram:{ name: 'Instagram', emoji: '📸', description: 'Register an Instagram account without your real phone.' },
  facebook: { name: 'Facebook', emoji: '📘', description: 'Create a Facebook account and verify it instantly.' },
  tiktok:   { name: 'TikTok', emoji: '🎵', description: 'Verify your TikTok account with a virtual number.' },
  twitter:  { name: 'Twitter / X', emoji: '🐦', description: 'Verify a Twitter or X account using a virtual number.' },
};

const STEPS = [
  {
    step: '1',
    icon: '📝',
    title: 'Create a Free Account',
    desc: 'Sign up in seconds — no credit card required just to look around.',
  },
  {
    step: '2',
    icon: '💳',
    title: 'Add Credits',
    desc: 'Top up with a card or crypto (USDT, BTC, ETH). Credits start from $2 and never expire.',
  },
  {
    step: '3',
    icon: '📱',
    title: 'Get Your Number',
    desc: 'Pick your country and service. A real virtual number is assigned to you instantly.',
  },
  {
    step: '4',
    icon: '📩',
    title: 'Paste the Code',
    desc: 'The SMS arrives live on your dashboard within seconds. Copy and paste it into the app.',
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium text-gray-900 text-sm">{q}</span>
        {open
          ? <FiChevronUp className="text-gray-400 flex-shrink-0 ml-3" />
          : <FiChevronDown className="text-gray-400 flex-shrink-0 ml-3" />}
      </button>
      {open && (
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

function buildFaqs(country, service) {
  return [
    {
      q: `Can I really get ${country.article} ${country.name} number for ${service.name}?`,
      a: `Yes. textlix provides real virtual phone numbers registered in ${country.name}. ${service.name} will send the SMS verification code to that number, and you'll see it live on your dashboard within seconds.`,
    },
    {
      q: 'What happens if the SMS never arrives?',
      a: 'If no SMS is received within 20 minutes, your number expires automatically and your credits are fully refunded — no support ticket needed.',
    },
    {
      q: 'Is this safe and private?',
      a: `Your real phone number is never shared with ${service.name} or anyone else. We store your order history but never sell or share your data with third parties.`,
    },
    {
      q: 'How much does it cost?',
      a: `Credits start at $2 (200 credits). A ${country.name} number for ${service.name} typically costs 50–500 credits depending on availability. You can see the exact price before confirming.`,
    },
  ];
}

export default function VirtualNumberLandingPage() {
  const { countryCode, serviceSlug } = useParams();

  const country = COUNTRY_DATA[countryCode?.toLowerCase()];
  const service = SERVICE_DATA[serviceSlug?.toLowerCase()];

  // If unknown, redirect to numbers page
  if (!country || !service) {
    return <Navigate to="/numbers" replace />;
  }

  const { name: countryName, flag, article } = country;
  const { name: serviceName, emoji: serviceEmoji, description: serviceDesc } = service;
  const faqs = buildFaqs(country, service);

  const pageTitle = `Get ${article} ${countryName} Phone Number for ${serviceName} — textlix`;
  const metaDesc = `Get ${article} ${countryName} virtual phone number for ${serviceName} verification instantly. Receive SMS codes in real-time. From $1. Full refund if no SMS arrives.`;
  const canonical = `https://www.textlix.com/virtual-numbers/${countryCode.toLowerCase()}/${serviceSlug.toLowerCase()}`;

  return (
    <>
      <Helmet>
        <title>{`Get ${article} ${countryName} Phone Number for ${serviceName} Verification — textlix`}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={canonical} />
      </Helmet>

      <div className="min-h-screen bg-white font-body">

        {/* Navbar */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl text-gray-900">
              <span>✓</span> textlix
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900">Pricing</Link>
              <Link to="/docs" className="text-sm font-medium text-gray-600 hover:text-gray-900">Docs</Link>
              <Link to="/faq" className="text-sm font-medium text-gray-600 hover:text-gray-900">FAQ</Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">Sign in</Link>
              <Link
                to="/register"
                className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="bg-gradient-to-br from-brand-600 to-purple-600 text-white py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="text-5xl mb-4">{flag}</div>
            <h1 className="font-display font-extrabold text-4xl md:text-5xl mb-5 leading-tight">
              {article.charAt(0).toUpperCase() + article.slice(1)} {countryName} Phone Number<br />
              for {serviceEmoji} {serviceName}
            </h1>
            <p className="text-lg text-brand-100 mb-8 max-w-2xl mx-auto">
              {serviceDesc} Virtual numbers from {countryName} — SMS code delivered live in seconds. Full refund if nothing arrives.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="bg-white text-brand-600 font-semibold text-lg px-8 py-4 rounded-xl hover:bg-brand-50 transition-colors shadow-lg"
              >
                Get My Number Now
              </Link>
              <Link
                to="/login"
                className="border-2 border-white/40 text-white font-semibold text-lg px-8 py-4 rounded-xl hover:bg-white/10 transition-colors"
              >
                Sign In
              </Link>
            </div>
            <p className="text-brand-200 text-sm mt-6">No subscription. Credits from $2. Numbers ready in seconds.</p>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-display font-bold text-3xl text-gray-900 text-center mb-3">
              How to Verify {serviceName} with {article} {countryName} Number
            </h2>
            <p className="text-gray-500 text-center mb-12">Four simple steps — takes under two minutes</p>
            <div className="grid md:grid-cols-4 gap-6">
              {STEPS.map((item) => (
                <div key={item.step} className="bg-white rounded-xl p-6 text-center shadow-sm border border-gray-100">
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <div className="inline-flex items-center justify-center w-6 h-6 bg-brand-600 text-white text-xs font-bold rounded-full mb-3">
                    {item.step}
                  </div>
                  <h3 className="font-display font-semibold text-base text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why textlix / trust signals */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-display font-bold text-3xl text-gray-900 text-center mb-3">
              Why Use textlix for {serviceName}?
            </h2>
            <p className="text-gray-500 text-center mb-12">Built for reliability — not just cheapness</p>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  icon: '⚡',
                  title: 'Real-Time SMS Delivery',
                  desc: 'Codes are pushed to your dashboard via live connection the moment they arrive. No polling, no waiting.',
                },
                {
                  icon: '🔁',
                  title: 'Auto-Refund Guarantee',
                  desc: 'No code in 20 minutes? Your credits are automatically refunded — zero hassle.',
                },
                {
                  icon: '📊',
                  title: 'Live Success Scores',
                  desc: `See the real success rate for ${countryName} ${serviceName} numbers before you buy — no surprises.`,
                },
                {
                  icon: '🌍',
                  title: '150+ Countries',
                  desc: 'Not just the big ones — we cover emerging markets across Africa, Asia, and Latin America.',
                },
                {
                  icon: '💳',
                  title: 'Flexible Payment',
                  desc: 'Top up with a debit/credit card or crypto (USDT, BTC, ETH). No bank account required.',
                },
                {
                  icon: '🔒',
                  title: 'Private & Secure',
                  desc: `Your real number stays hidden. ${serviceName} only sees the virtual number — your identity stays yours.`,
                },
              ].map((f, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-6">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm">{f.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing callout */}
        <section className="py-16 px-4 bg-gradient-to-r from-brand-50 to-purple-50">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display font-bold text-3xl text-gray-900 mb-3">
              Simple Credit Pricing
            </h2>
            <p className="text-gray-500 mb-8">
              1 credit = $0.01. {countryName} {serviceName} numbers typically cost 50–300 credits. Credits never expire.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Starter', usd: '$2', credits: '200 credits', note: 'Perfect for a quick test' },
                { label: 'Standard', usd: '$10', credits: '1,150 credits', note: '+150 bonus credits', popular: true },
                { label: 'Pro', usd: '$25', credits: '3,000 credits', note: '+500 bonus credits' },
              ].map((pkg) => (
                <div
                  key={pkg.label}
                  className={`border rounded-xl p-5 text-center relative bg-white ${
                    pkg.popular ? 'border-brand-500' : 'border-gray-200'
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Most Popular
                    </div>
                  )}
                  <p className="font-display font-bold text-2xl text-gray-900">{pkg.usd}</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1">{pkg.credits}</p>
                  <p className="text-xs text-green-600 font-medium mt-1">{pkg.note}</p>
                </div>
              ))}
            </div>
            <Link
              to="/register"
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-lg px-8 py-4 rounded-xl transition-colors inline-block"
            >
              Start for $2
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display font-bold text-3xl text-gray-900 text-center mb-3">
              Common Questions
            </h2>
            <p className="text-gray-500 text-center mb-10">
              About {countryName} virtual numbers for {serviceName}
            </p>
            <div className="space-y-3 mb-10">
              {faqs.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
            <div className="text-center">
              <Link to="/faq" className="text-brand-600 font-semibold hover:underline text-sm">
                View all FAQs →
              </Link>
            </div>
          </div>
        </section>

        {/* CTA footer */}
        <section className="py-20 px-4 bg-gradient-to-br from-brand-600 to-purple-600 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-4xl mb-4">{flag} {serviceEmoji}</div>
            <h2 className="font-display font-extrabold text-3xl md:text-4xl mb-4">
              Ready to get your {countryName} number?
            </h2>
            <p className="text-brand-100 mb-8">
              Create a free account, top up with $2, and get a {countryName} virtual number for {serviceName} in under a minute.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="bg-white text-brand-600 font-semibold text-lg px-8 py-4 rounded-xl hover:bg-brand-50 transition-colors shadow-lg"
              >
                Create Free Account
              </Link>
              <Link
                to="/login"
                className="border-2 border-white/40 text-white font-semibold text-lg px-8 py-4 rounded-xl hover:bg-white/10 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 py-10 px-4 bg-white">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl text-gray-900">
              <span>✓</span> textlix
            </Link>
            <div className="flex gap-6 text-sm text-gray-500">
              <Link to="/pricing" className="hover:text-gray-700">Pricing</Link>
              <Link to="/faq" className="hover:text-gray-700">FAQ</Link>
              <Link to="/docs" className="hover:text-gray-700">Docs</Link>
              <Link to="/support" className="hover:text-gray-700">Support</Link>
              <Link to="/terms" className="hover:text-gray-700">Terms</Link>
              <Link to="/privacy" className="hover:text-gray-700">Privacy</Link>
            </div>
            <p className="text-sm text-gray-400">© {new Date().getFullYear()} textlix</p>
          </div>
        </footer>
      </div>
    </>
  );
}
