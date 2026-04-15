import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FiChevronRight } from 'react-icons/fi';
import PublicLayout from '../../components/layout/PublicLayout';

const SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    articles: [
      {
        title: 'How to create an account',
        content: `Creating a TextLix account takes less than 60 seconds.\n\n1. Go to textlix.com and click **Get Started**.\n2. Enter your name, email address, and a password — or sign in with Google or GitHub.\n3. Verify your email address by clicking the link we send you.\n4. You're in. Your account starts with 0 credits.`,
      },
      {
        title: 'How to buy credits',
        content: `Credits are the currency of TextLix. 1 credit = $0.01 USD.\n\n1. Go to **Buy Credits** from your dashboard.\n2. Choose a package (starting from $2 / 200 credits).\n3. Pay with Paystack (card or bank transfer) or CoinGate (USDT, BTC, ETH).\n4. Credits are added to your account instantly after payment is confirmed.\n\nCredits never expire — buy as many as you need and use them at your own pace.`,
      },
      {
        title: 'How to get a virtual number',
        content: `1. Go to **Get a Number** from your dashboard.\n2. Browse the country list and select your target country.\n3. Pick a service (WhatsApp, Telegram, Google, etc.).\n4. Confirm the order — credits are deducted from your balance.\n5. Your virtual number appears on screen. Use it on the target platform.\n6. The SMS verification code appears in real-time (usually within seconds).`,
      },
    ],
  },
  {
    id: 'numbers',
    title: 'Numbers & SMS',
    articles: [
      {
        title: 'How long does a number stay active?',
        content: `One-time OTP numbers stay active for **20 minutes** by default. If no SMS arrives within that time, the number expires and your credits are automatically refunded.\n\nLong-term rental numbers stay active for the duration you selected (4 hours, 8 hours, or 24 hours). Rentals are not refunded on cancellation.`,
      },
      {
        title: 'What if no SMS arrives?',
        content: `If you cancel an OTP number before an SMS arrives, you get a full credit refund instantly.\n\nIf the number expires (20 minutes) without receiving an SMS, your credits are also automatically refunded — no action needed on your part.\n\nNote: Rental numbers (long-term) are not refunded since you are paying for time, not SMS delivery.`,
      },
      {
        title: 'OTP numbers vs rental numbers',
        content: `**OTP numbers** are for one-time use. You get a number, receive one verification code, done. These are the cheapest option.\n\n**Rental numbers** stay active for hours. They can receive SMS from any platform — WhatsApp, Telegram, Google, banking apps, anything. Ideal if you need to receive multiple codes or use the number across several services.`,
      },
      {
        title: 'How many numbers can I have at once?',
        content: `By default each account can have up to **5 active numbers** at the same time. If you need more, contact support at support@textlix.com.`,
      },
    ],
  },
  {
    id: 'credits',
    title: 'Credits & Billing',
    articles: [
      {
        title: 'How is the price of a number calculated?',
        content: `Number prices are based on real-time provider rates plus a service margin. Prices vary by country and service.\n\nThe price shown before you order is an estimate. The final charge is confirmed at order time and may differ slightly. You will always see the exact amount charged in your order history.`,
      },
      {
        title: 'Payment methods accepted',
        content: `**Paystack** — Debit/credit card, bank transfer (Nigeria and other African countries supported).\n\n**CoinGate** — USDT (TRC20/ERC20), Bitcoin, Ethereum, and other cryptocurrencies.\n\nAll payments are processed securely. TextLix does not store your card details.`,
      },
      {
        title: 'Can I get a refund to my card?',
        content: `Credit purchases are non-refundable to card or crypto wallet. However, unused credits stay in your account indefinitely and never expire.\n\nSMS-related refunds (cancelled number, expired number) are always returned to your credit balance automatically.`,
      },
    ],
  },
  {
    id: 'account',
    title: 'Account & Security',
    articles: [
      {
        title: 'How to change your password',
        content: `1. Go to **Settings** from your dashboard.\n2. Click **Change Password**.\n3. Enter your current password and your new password.\n4. Save changes.\n\nIf you forgot your password, use the **Forgot Password** link on the login page.`,
      },
      {
        title: 'Is my data safe?',
        content: `Yes. TextLix takes privacy seriously:\n\n- SMS content is automatically deleted after **30 days**.\n- We never sell or share your personal data.\n- All connections are encrypted via HTTPS.\n- Passwords are hashed using bcrypt — we never store them in plain text.\n\nSee our [Privacy Policy](/privacy) for full details.`,
      },
    ],
  },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [activeArticle, setActiveArticle] = useState(0);

  const section = SECTIONS.find((s) => s.id === activeSection);

  return (
    <PublicLayout>
      <Helmet>
        <title>Documentation — TextLix Virtual Phone Numbers</title>
        <meta name="description" content="Learn how to use TextLix virtual phone numbers. Step-by-step guides for getting numbers, receiving SMS codes, buying credits, and managing your account." />
        <link rel="canonical" href="https://www.textlix.com/docs" />
        <meta property="og:title" content="TextLix Documentation" />
        <meta property="og:description" content="Step-by-step guides for getting virtual numbers and receiving SMS verification codes." />
        <meta property="og:url" content="https://www.textlix.com/docs" />
      </Helmet>

      <div className="max-w-6xl mx-auto px-4 py-12 flex gap-8">
        {/* Sidebar */}
        <aside className="hidden md:block w-56 shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Documentation</p>
          <nav className="space-y-1">
            {SECTIONS.map((s) => (
              <div key={s.id}>
                <button
                  onClick={() => { setActiveSection(s.id); setActiveArticle(0); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === s.id ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
                >
                  {s.title}
                </button>
                {activeSection === s.id && (
                  <div className="ml-3 mt-1 space-y-1">
                    {s.articles.map((a, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveArticle(i)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${activeArticle === i ? 'text-brand-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        {a.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile section selector */}
          <div className="md:hidden mb-6 flex gap-2 overflow-x-auto pb-2">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => { setActiveSection(s.id); setActiveArticle(0); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${activeSection === s.id ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600'}`}
              >
                {s.title}
              </button>
            ))}
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <span>{section?.title}</span>
            <FiChevronRight size={14} />
            <span className="text-gray-700">{section?.articles[activeArticle]?.title}</span>
          </div>

          {/* Article */}
          {section && (
            <article className="prose prose-gray max-w-none">
              <h1 className="font-display font-bold text-2xl text-gray-900 mb-6">
                {section.articles[activeArticle].title}
              </h1>
              <div className="space-y-4">
                {section.articles[activeArticle].content.split('\n\n').map((para, i) => (
                  <p key={i} className="text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-brand-600 hover:underline">$1</a>').replace(/\n/g, '<br/>') }}
                  />
                ))}
              </div>
            </article>
          )}

          {/* Article navigation */}
          <div className="flex justify-between mt-12 pt-6 border-t border-gray-200">
            <button
              onClick={() => activeArticle > 0 && setActiveArticle(activeArticle - 1)}
              disabled={activeArticle === 0}
              className="text-sm text-gray-500 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              onClick={() => activeArticle < section.articles.length - 1 && setActiveArticle(activeArticle + 1)}
              disabled={activeArticle === section.articles.length - 1}
              className="text-sm text-gray-500 hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>

          {/* Help box */}
          <div className="mt-10 bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-600">
            Can't find what you're looking for? <Link to="/support" className="text-brand-600 hover:underline font-medium">Contact support →</Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
