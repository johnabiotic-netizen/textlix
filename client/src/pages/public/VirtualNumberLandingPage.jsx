import { useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { COUNTRIES, SERVICES, STATS } from '../../data/pseoContent';
import { landingJsonLd } from '../../lib/jsonld';

const STEPS = [
  { step: '1', icon: '📝', title: 'Create a Free Account', desc: 'Sign up in seconds — no credit card required just to look around.' },
  { step: '2', icon: '💳', title: 'Add Credits', desc: 'Top up with a card or crypto (USDT, BTC, ETH). Credits start from $2 and never expire.' },
  { step: '3', icon: '📱', title: 'Get Your Number', desc: 'Pick your country and service. A real virtual number is assigned to you instantly.' },
  { step: '4', icon: '📩', title: 'Paste the Code', desc: 'The SMS arrives live on your dashboard within seconds. Copy and paste it into the app.' },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="font-medium text-gray-900 dark:text-white text-sm">{q}</span>
        {open
          ? <FiChevronUp className="text-gray-400 dark:text-gray-500 flex-shrink-0 ml-3" />
          : <FiChevronDown className="text-gray-400 dark:text-gray-500 flex-shrink-0 ml-3" />}
      </button>
      {/* Answer is always in the DOM (so crawlers index it); the toggle only
          controls visibility. */}
      <div className={open ? 'block' : 'hidden'}>
        <div className="px-5 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

function buildFaqs(countryName, service) {
  return [
    {
      q: `Can I really get a ${countryName} number for ${service.name}?`,
      a: `Yes. textlix provides real virtual phone numbers registered in ${countryName}. ${service.name} sends the SMS verification code to that number, and you see it live on your dashboard within ${STATS.delivery}.`,
    },
    service.faq,
    {
      q: 'What happens if the SMS never arrives?',
      a: 'If no SMS is received within the active window, your number expires automatically and your credits are fully refunded — no support ticket needed.',
    },
    {
      q: 'Is this safe and private?',
      a: `Your real phone number is never shared with ${service.name} or anyone else. We store your order history but never sell or share your data with third parties.`,
    },
    {
      q: 'How much does a number cost?',
      a: `Credits start at $2 (200 credits). A ${countryName} number for ${service.name} typically costs 50–500 credits depending on availability, and you always see the exact price before you confirm.`,
    },
  ];
}

export default function VirtualNumberLandingPage() {
  const { countryCode, serviceSlug } = useParams();

  const cc = countryCode?.toLowerCase();
  const ss = serviceSlug?.toLowerCase();
  const country = COUNTRIES[cc];
  const service = SERVICES[ss];

  // Unknown combination — send to the in-app browse page.
  if (!country || !service) {
    return <Navigate to="/numbers" replace />;
  }

  const { name: countryName, flag } = country;
  const { name: serviceName, emoji: serviceEmoji } = service;
  const faqs = buildFaqs(countryName, service);

  const canonical = `https://www.textlix.com/virtual-numbers/${cc}/${ss}`;
  const pageTitle = `${countryName} Phone Number for ${serviceName} Verification — textlix`;
  const metaDesc = `Get a virtual ${countryName} phone number for ${serviceName} verification instantly. Receive the SMS code in real time, with a full refund if no code arrives.`;
  const jsonLd = landingJsonLd({ countryName, serviceName, canonical, faqs });

  // Cross-link targets (same service, other countries — and same country, other services).
  const relatedCountries = (country.related || []).filter((code) => COUNTRIES[code]);
  const relatedServices = (service.related || []).filter((slug) => SERVICES[slug]);

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDesc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDesc} />
        <meta property="og:url" content={canonical} />
        {jsonLd.map((obj, i) => (
          <script key={i} type="application/ld+json">{JSON.stringify(obj)}</script>
        ))}
      </Helmet>

      <div className="min-h-screen bg-white dark:bg-gray-900 font-body">

        {/* Navbar */}
        <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl text-gray-900 dark:text-white">
              <span>✓</span> textlix
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/virtual-numbers" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Virtual Numbers</Link>
              <Link to="/pricing" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Pricing</Link>
              <Link to="/faq" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">FAQ</Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Sign in</Link>
              <Link to="/register" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">Get Started</Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="bg-gradient-to-br from-[#0A1831] to-brand-600 text-white py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="text-5xl mb-4">{flag}</div>
            <h1 className="font-display font-extrabold text-4xl md:text-5xl mb-5 leading-tight">
              {countryName} Phone Number<br />for {serviceEmoji} {serviceName} Verification
            </h1>
            <p className="text-lg text-brand-100 mb-8 max-w-2xl mx-auto">
              Get a virtual {countryName} number and receive your {serviceName} SMS code live on your dashboard in {STATS.delivery}. No SIM, no subscription, and a full refund if no code arrives.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" className="bg-white text-brand-600 font-semibold text-lg px-8 py-4 rounded-xl hover:bg-brand-50 transition-colors shadow-lg">
                Get My Number Now
              </Link>
              <Link to="/login" className="border-2 border-white/40 text-white font-semibold text-lg px-8 py-4 rounded-xl hover:bg-white/10 transition-colors">
                Sign In
              </Link>
            </div>
            <p className="text-brand-200 text-sm mt-6">No subscription. Credits from $2. Numbers ready in seconds.</p>
          </div>
        </section>

        {/* Static brand stats */}
        <section className="bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 py-8 px-4">
          <div className="max-w-4xl mx-auto grid grid-cols-3 gap-4 text-center">
            {[
              { value: STATS.successRate, label: 'Delivery success' },
              { value: STATS.countries, label: 'Countries' },
              { value: STATS.services, label: 'Services' },
            ].map((s) => (
              <div key={s.label}>
                <p className="font-display font-extrabold text-2xl md:text-3xl text-brand-600 dark:text-brand-300">{s.value}</p>
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* About this country + service (unique editorial per combo) */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto space-y-8">
            <div>
              <h2 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-3">
                Why use {serviceName} with a {countryName} number?
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{service.blurb}</p>
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-3">
                About {countryName} virtual numbers
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{country.blurb}</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-display font-bold text-3xl text-gray-900 dark:text-white text-center mb-3">
              How to Verify {serviceName} with a {countryName} Number
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-12">Four simple steps — takes under two minutes</p>
            <div className="grid md:grid-cols-4 gap-6">
              {STEPS.map((item) => (
                <div key={item.step} className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <div className="inline-flex items-center justify-center w-6 h-6 bg-brand-600 text-white text-xs font-bold rounded-full mb-3">{item.step}</div>
                  <h3 className="font-display font-semibold text-base text-gray-900 dark:text-white mb-2">{item.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why textlix / trust signals */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="font-display font-bold text-3xl text-gray-900 dark:text-white text-center mb-3">
              Why Use textlix for {serviceName}?
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-12">Built for reliability — not just cheapness</p>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: '⚡', title: 'Real-Time SMS Delivery', desc: 'Codes are pushed to your dashboard via a live connection the moment they arrive. No polling, no waiting.' },
                { icon: '🔁', title: 'Auto-Refund Guarantee', desc: 'No code in time? Your credits are automatically refunded — zero hassle, no support ticket.' },
                { icon: '✅', title: `${STATS.successRate} Delivery Success`, desc: `Our network is tuned for reliable ${serviceName} delivery, so codes land fast and accounts get verified.` },
                { icon: '🌍', title: `${STATS.countries} Countries`, desc: 'Not just the big ones — we cover emerging markets across Africa, Asia, and Latin America.' },
                { icon: '💳', title: 'Flexible Payment', desc: 'Top up with a debit/credit card or crypto (USDT, BTC, ETH). No bank account required.' },
                { icon: '🔒', title: 'Private & Secure', desc: `Your real number stays hidden. ${serviceName} only sees the virtual number — your identity stays yours.` },
              ].map((f, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">{f.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing callout */}
        <section className="py-16 px-4 bg-gradient-to-r from-brand-50 to-brand-100">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display font-bold text-3xl text-gray-900 dark:text-white mb-3">Simple Credit Pricing</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              1 credit = $0.01. {countryName} {serviceName} numbers typically cost 50–300 credits. Credits never expire.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Starter', usd: '$2', credits: '200 credits', note: 'Perfect for a quick test' },
                { label: 'Standard', usd: '$10', credits: '1,150 credits', note: '+150 bonus credits', popular: true },
                { label: 'Pro', usd: '$25', credits: '3,000 credits', note: '+500 bonus credits' },
              ].map((pkg) => (
                <div key={pkg.label} className={`border rounded-xl p-5 text-center relative bg-white dark:bg-gray-800 ${pkg.popular ? 'border-brand-500' : 'border-gray-200 dark:border-gray-700'}`}>
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</div>
                  )}
                  <p className="font-display font-bold text-2xl text-gray-900 dark:text-white">{pkg.usd}</p>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-1">{pkg.credits}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">{pkg.note}</p>
                </div>
              ))}
            </div>
            <Link to="/register" className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-lg px-8 py-4 rounded-xl transition-colors inline-block">
              Start for $2
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display font-bold text-3xl text-gray-900 dark:text-white text-center mb-3">Common Questions</h2>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-10">About {countryName} virtual numbers for {serviceName}</p>
            <div className="space-y-3 mb-10">
              {faqs.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
            <div className="text-center">
              <Link to="/faq" className="text-brand-600 dark:text-brand-400 font-semibold hover:underline text-sm">View all FAQs →</Link>
            </div>
          </div>
        </section>

        {/* Cross-links: related countries + services */}
        <section className="py-16 px-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10">
            <div>
              <h2 className="font-display font-bold text-lg text-gray-900 dark:text-white mb-4">
                {serviceName} numbers in other countries
              </h2>
              <ul className="space-y-2">
                {relatedCountries.map((code) => (
                  <li key={code}>
                    <Link to={`/virtual-numbers/${code}/${ss}`} className="text-sm text-brand-600 dark:text-brand-300 hover:underline">
                      {COUNTRIES[code].flag} {COUNTRIES[code].name} number for {serviceName}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-gray-900 dark:text-white mb-4">
                Other services with a {countryName} number
              </h2>
              <ul className="space-y-2">
                {relatedServices.map((slug) => (
                  <li key={slug}>
                    <Link to={`/virtual-numbers/${cc}/${slug}`} className="text-sm text-brand-600 dark:text-brand-300 hover:underline">
                      {SERVICES[slug].emoji} {countryName} number for {SERVICES[slug].name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="max-w-4xl mx-auto mt-8 text-center">
            <Link to="/virtual-numbers" className="text-sm font-semibold text-brand-600 dark:text-brand-300 hover:underline">
              Browse all countries &amp; services →
            </Link>
          </div>
        </section>

        {/* CTA footer */}
        <section className="py-20 px-4 bg-gradient-to-br from-[#0A1831] to-brand-600 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-4xl mb-4">{flag} {serviceEmoji}</div>
            <h2 className="font-display font-extrabold text-3xl md:text-4xl mb-4">Ready to get your {countryName} number?</h2>
            <p className="text-brand-100 mb-8">
              Create a free account, top up with $2, and get a {countryName} virtual number for {serviceName} in under a minute.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" className="bg-white text-brand-600 font-semibold text-lg px-8 py-4 rounded-xl hover:bg-brand-50 transition-colors shadow-lg">Create Free Account</Link>
              <Link to="/login" className="border-2 border-white/40 text-white font-semibold text-lg px-8 py-4 rounded-xl hover:bg-white/10 transition-colors">Sign In</Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-800 py-10 px-4 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl text-gray-900 dark:text-white">
              <span>✓</span> textlix
            </Link>
            <div className="flex gap-6 text-sm text-gray-500 dark:text-gray-400">
              <Link to="/virtual-numbers" className="hover:text-gray-700 dark:hover:text-gray-200">Virtual Numbers</Link>
              <Link to="/pricing" className="hover:text-gray-700 dark:hover:text-gray-200">Pricing</Link>
              <Link to="/faq" className="hover:text-gray-700 dark:hover:text-gray-200">FAQ</Link>
              <Link to="/support" className="hover:text-gray-700 dark:hover:text-gray-200">Support</Link>
              <Link to="/terms" className="hover:text-gray-700 dark:hover:text-gray-200">Terms</Link>
              <Link to="/privacy" className="hover:text-gray-700 dark:hover:text-gray-200">Privacy</Link>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">© 2026 textlix</p>
          </div>
        </footer>
      </div>
    </>
  );
}
