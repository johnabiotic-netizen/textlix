import { Link } from 'react-router-dom';
import { FiDollarSign, FiUsers, FiLink, FiArrowRight } from 'react-icons/fi';

export default function CreatorLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <FiLink size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900">textlix Creators</span>
        </div>
        <div className="flex gap-3">
          <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2">
            Sign In
          </Link>
          <Link to="/apply" className="text-sm font-medium bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
            Apply Now
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <span className="inline-block bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full mb-6 uppercase tracking-wide">
          Influencer Program
        </span>
        <h1 className="text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
          Earn real money<br />promoting textlix
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Share your unique referral link with your audience. Earn <strong className="text-gray-900">10% of every top-up</strong> your referrals make — paid in Naira directly to your bank account.
        </p>
        <Link
          to="/apply"
          className="inline-flex items-center gap-2 bg-emerald-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-emerald-700 transition-colors text-lg"
        >
          Apply to become a creator <FiArrowRight size={20} />
        </Link>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: FiLink, title: 'Apply & get approved', desc: 'Submit your social media handles and audience proof. We review within 24–48 hours.' },
              { icon: FiUsers, title: 'Share your link', desc: 'Post your unique referral link on WhatsApp, TikTok, Instagram, Facebook — anywhere your audience is.' },
              { icon: FiDollarSign, title: 'Earn 10% on every top-up', desc: 'Every time your referral buys credits, you earn 10% of that amount in Naira. Withdraw once you hit ₦50,000.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                  <Icon size={22} className="text-emerald-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to start earning?</h2>
        <p className="text-gray-500 mb-8">Join other creators who are already earning with textlix</p>
        <Link
          to="/apply"
          className="inline-flex items-center gap-2 bg-emerald-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-emerald-700 transition-colors"
        >
          Apply Now <FiArrowRight size={18} />
        </Link>
      </section>

      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} textlix · <a href="https://textlix.com" className="hover:text-gray-600">Main Platform</a>
      </footer>
    </div>
  );
}
