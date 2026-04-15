import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FiCheck, FiZap } from 'react-icons/fi';
import PublicLayout from '../../components/layout/PublicLayout';

const PACKAGES = [
  { label: 'Starter', usd: 2, credits: 200, bonus: 0 },
  { label: 'Basic', usd: 5, credits: 500, bonus: 50 },
  { label: 'Standard', usd: 10, credits: 1000, bonus: 150, popular: true },
  { label: 'Pro', usd: 25, credits: 2500, bonus: 500 },
  { label: 'Premium', usd: 50, credits: 5000, bonus: 1500 },
];

const FEATURES = [
  'Numbers from 50+ countries',
  'Real-time SMS delivery',
  'WhatsApp, Telegram, Google & more',
  'Long-term number rental',
  'Pay with card or cryptocurrency',
  'Credits never expire',
  'Cancel & refund if no SMS received',
  '24/7 support',
];

export default function PricingPage() {
  return (
    <PublicLayout>
      <Helmet>
        <title>Pricing — TextLix Virtual Phone Numbers</title>
        <meta name="description" content="Simple credit-based pricing. Buy credits from $2 and use them to get virtual phone numbers from 50+ countries. Credits never expire. No subscriptions." />
        <link rel="canonical" href="https://www.textlix.com/pricing" />
        <meta property="og:title" content="Pricing — TextLix Virtual Phone Numbers" />
        <meta property="og:description" content="Simple credit-based pricing starting from $2. No subscriptions, credits never expire." />
        <meta property="og:url" content="https://www.textlix.com/pricing" />
      </Helmet>

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-600 to-purple-600 text-white py-20 px-4 text-center">
        <h1 className="font-display font-extrabold text-4xl md:text-5xl mb-4">Simple, transparent pricing</h1>
        <p className="text-brand-100 text-lg max-w-xl mx-auto">
          Buy credits once, use them whenever you need. No subscriptions, no hidden fees. Credits never expire.
        </p>
      </section>

      {/* Credit packages */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-2xl text-gray-900 text-center mb-3">Credit packages</h2>
          <p className="text-gray-500 text-center mb-12">1 credit = $0.01 USD. Numbers cost 50–500 credits depending on country and service.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PACKAGES.map((pkg) => (
              <div key={pkg.label} className={`relative border rounded-2xl p-6 ${pkg.popular ? 'border-brand-500 shadow-lg shadow-brand-100' : 'border-gray-200'}`}>
                {pkg.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most popular
                  </span>
                )}
                <p className="font-display font-bold text-lg text-gray-900 mb-1">{pkg.label}</p>
                <p className="font-extrabold text-4xl text-gray-900 mb-1">${pkg.usd}</p>
                <p className="text-brand-600 font-semibold mb-1">{(pkg.credits + pkg.bonus).toLocaleString()} credits</p>
                {pkg.bonus > 0 && <p className="text-xs text-green-600 font-medium mb-4">+{pkg.bonus} bonus credits</p>}
                {pkg.bonus === 0 && <p className="text-xs text-gray-400 mb-4">{pkg.credits} credits</p>}
                <Link to="/register" className={`block text-center text-sm font-semibold py-2.5 rounded-xl transition-colors ${pkg.popular ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}>
                  Get started
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-8">Pay with Paystack (card, bank transfer) or CoinGate (USDT, BTC, ETH)</p>
        </div>
      </section>

      {/* What's included */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl text-gray-900 mb-10">Everything included in every plan</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-left">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                <FiCheck size={16} className="text-green-500 shrink-0" />
                <span className="text-sm text-gray-700">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How credits work */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display font-bold text-2xl text-gray-900 mb-8 text-center">How credits work</h2>
          <div className="space-y-4">
            {[
              { q: 'How much does a number cost?', a: 'Numbers cost between 50 and 500 credits ($0.50–$5.00) depending on the country and service. UK WhatsApp is typically around 180 credits, while US Google can be as low as 60 credits.' },
              { q: 'Do credits expire?', a: 'No. Credits never expire. Buy once and use them at any time.' },
              { q: 'What if no SMS arrives?', a: 'If you cancel before receiving an SMS, you get a full refund to your credit balance instantly.' },
              { q: 'Can I get a refund to my card?', a: 'Credit purchases are non-refundable to card/crypto. Unused credits stay in your account indefinitely.' },
            ].map((item) => (
              <div key={item.q} className="border border-gray-200 rounded-xl p-5">
                <p className="font-semibold text-gray-900 mb-2">{item.q}</p>
                <p className="text-sm text-gray-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-gradient-to-br from-brand-600 to-purple-600 text-white text-center">
        <FiZap size={32} className="mx-auto mb-4 text-yellow-300" />
        <h2 className="font-display font-bold text-3xl mb-3">Start verifying in 60 seconds</h2>
        <p className="text-brand-100 mb-8">Create a free account, top up, and get your first number instantly.</p>
        <Link to="/register" className="bg-white text-brand-600 font-semibold px-8 py-3 rounded-xl hover:bg-brand-50 transition-colors inline-block">
          Create Free Account
        </Link>
      </section>
    </PublicLayout>
  );
}
