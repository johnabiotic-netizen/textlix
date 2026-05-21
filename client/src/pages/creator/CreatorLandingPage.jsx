import { Link } from 'react-router-dom';
import { FiDollarSign, FiUsers, FiLink, FiArrowRight, FiCheck } from 'react-icons/fi';
import Logo from '../../components/common/Logo';

export default function CreatorLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex flex-col">
            <Logo textClassName="text-lg" />
            <span className="text-xs text-brand-600 font-medium ml-7 -mt-0.5">Creator Program</span>
          </div>
          <div className="flex gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2">
              Sign In
            </Link>
            <Link to="/apply" className="text-sm font-medium bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
              Apply Now
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A1B31] to-brand-600 text-white py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-white/10 border border-white/20 text-white text-xs font-semibold px-4 py-1.5 rounded-full mb-6 uppercase tracking-wide">
            Influencer Program
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
            Earn real money<br />promoting textlix
          </h1>
          <p className="text-xl text-brand-100 mb-10 max-w-2xl mx-auto">
            Share your unique referral link. Earn <strong className="text-white">10% of every top-up</strong> your referrals make — paid in Naira directly to your bank account.
          </p>
          <Link
            to="/apply"
            className="inline-flex items-center gap-2 bg-white text-brand-700 font-semibold px-8 py-4 rounded-xl hover:bg-brand-50 transition-colors text-lg shadow-lg"
          >
            Apply to become a creator <FiArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">How it works</h2>
          <p className="text-gray-500 text-center mb-12">Three steps to start earning</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: FiLink, step: '01', title: 'Apply & get approved', desc: 'Submit your social media handles and audience proof. We review within 24–48 hours.' },
              { icon: FiUsers, step: '02', title: 'Share your link', desc: 'Post your unique referral link on WhatsApp, TikTok, Instagram, Facebook — anywhere your audience is.' },
              { icon: FiDollarSign, step: '03', title: 'Earn 10% on every top-up', desc: 'Every time your referral buys credits, you earn 10% in Naira. Withdraw once you hit ₦50,000.' },
            ].map(({ icon: Icon, step, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
                    <Icon size={20} className="text-brand-600" />
                  </div>
                  <span className="text-xs font-bold text-brand-400 uppercase tracking-widest">{step}</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Why join our creator program?</h2>
              <ul className="space-y-4">
                {[
                  '10% commission on every credit top-up — no cap',
                  'Paid in Naira directly to your bank account',
                  'Live earnings dashboard with real-time tracking',
                  'Withdraw anytime after hitting ₦50,000',
                  'Works on WhatsApp, TikTok, Instagram, Facebook & more',
                  'No minimum audience size required to apply',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="w-5 h-5 bg-brand-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <FiCheck size={12} className="text-brand-700" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-[#0A1B31] to-brand-700 rounded-2xl p-8 text-white">
              <p className="text-sm font-medium text-brand-200 mb-1">Example earnings</p>
              <p className="text-4xl font-extrabold mb-2">₦15,000+</p>
              <p className="text-brand-100 text-sm mb-6">If 10 users each top up $10 USD</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-brand-200">
                  <span>10 referrals × $10</span><span>$100 USD</span>
                </div>
                <div className="flex justify-between text-brand-200">
                  <span>10% commission</span><span>$10 USD</span>
                </div>
                <div className="flex justify-between text-white font-bold border-t border-white/20 pt-2">
                  <span>You earn</span><span>~₦15,000+</span>
                </div>
              </div>
              <p className="text-xs text-brand-300 mt-4">Based on live USD/NGN rate. Amounts vary with exchange rate.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gradient-to-br from-[#0A1B31] to-brand-600 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to start earning?</h2>
          <p className="text-brand-100 mb-8">Join creators who are already earning with textlix</p>
          <Link
            to="/apply"
            className="inline-flex items-center gap-2 bg-white text-brand-700 font-semibold px-8 py-4 rounded-xl hover:bg-brand-50 transition-colors"
          >
            Apply Now <FiArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} textlix ·{' '}
        <a href="https://www.textlix.com" className="hover:text-gray-600">Main Platform</a>
      </footer>
    </div>
  );
}
