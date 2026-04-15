import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

const FAQS = [
  {
    category: 'Getting Started',
    items: [
      { q: 'What is TextLix?', a: 'TextLix is a platform that provides temporary virtual phone numbers from 50+ countries. You can use these numbers to receive SMS verification codes for any online service without using your real phone number.' },
      { q: 'How do I get started?', a: 'Create a free account, buy credits (starting from $2), choose a country and service, get a virtual number, and receive your SMS code instantly on your dashboard.' },
      { q: 'Do I need a SIM card?', a: 'No. Everything is virtual. You receive SMS codes directly on your TextLix dashboard in real-time.' },
    ],
  },
  {
    category: 'Credits & Pricing',
    items: [
      { q: 'How does the credit system work?', a: '1 credit = $0.01 USD. Numbers cost between 50–500 credits depending on the country and service. Credits are deducted when you successfully receive an SMS.' },
      { q: 'What happens if I don\'t receive an SMS?', a: 'If no SMS is received within 20 minutes, your number expires and credits are automatically refunded to your account.' },
      { q: 'What payment methods do you accept?', a: 'We accept card payments via Paystack (Visa, Mastercard) and cryptocurrency (USDT, BTC, ETH) via CoinGate.' },
      { q: 'Do credits expire?', a: 'No. Your credits never expire and remain on your account indefinitely.' },
    ],
  },
  {
    category: 'Numbers & SMS',
    items: [
      { q: 'Which countries are available?', a: 'We support 50+ countries including USA, UK, India, Nigeria, Russia, Brazil, Germany, France, Canada, Australia, and many more.' },
      { q: 'How many numbers can I have at once?', a: 'By default, you can have up to 5 active numbers at the same time.' },
      { q: 'How long does a number stay active?', a: 'Numbers stay active for 20 minutes. If you receive an SMS before then, the number is marked as complete. If not, it expires and credits are refunded.' },
      { q: 'Can I use the same number twice?', a: 'No. Each number is single-use for privacy and security reasons.' },
    ],
  },
  {
    category: 'Account & Security',
    items: [
      { q: 'Is my data safe?', a: 'Yes. SMS content is automatically deleted after 24 hours. We use industry-standard encryption for all data.' },
      { q: 'Can I sign in with Google?', a: 'Yes. You can sign in with your Google account for a faster login experience.' },
      { q: 'How do I reset my password?', a: 'Click "Forgot password?" on the login page and we\'ll send a reset link to your email.' },
    ],
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
        {open ? <FiChevronUp className="text-gray-400 flex-shrink-0 ml-3" /> : <FiChevronDown className="text-gray-400 flex-shrink-0 ml-3" />}
      </button>
      {open && (
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  return (
    <>
    <Helmet>
      <title>FAQ — TextLix Virtual Phone Numbers</title>
      <meta name="description" content="Frequently asked questions about TextLix virtual phone numbers. Learn how to receive SMS verification codes, top up credits, and more." />
      <link rel="canonical" href="https://www.textlix.com/faq" />
    </Helmet>
    <div className="min-h-screen bg-white font-body">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl text-gray-900">
            <span>✓</span> TextLix
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">Sign in</Link>
            <Link to="/register" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">Get Started</Link>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-br from-brand-600 to-purple-600 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display font-extrabold text-4xl md:text-5xl mb-4">Frequently Asked Questions</h1>
          <p className="text-brand-100 text-lg">Everything you need to know about TextLix</p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-12">
          {FAQS.map((section) => (
            <div key={section.category}>
              <h2 className="font-display font-bold text-xl text-gray-900 mb-4">{section.category}</h2>
              <div className="space-y-3">
                {section.items.map((item) => (
                  <FaqItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}

          <div className="bg-brand-50 border border-brand-200 rounded-2xl p-8 text-center">
            <h3 className="font-display font-bold text-xl text-gray-900 mb-2">Still have questions?</h3>
            <p className="text-gray-500 mb-6">Our support team is here to help.</p>
            <Link to="/support" className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors inline-block">
              Contact Support
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">© {new Date().getFullYear()} TextLix. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link to="/faq" className="hover:text-gray-700">FAQ</Link>
            <Link to="/support" className="hover:text-gray-700">Support</Link>
            <Link to="/terms" className="hover:text-gray-700">Terms</Link>
            <Link to="/privacy" className="hover:text-gray-700">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
