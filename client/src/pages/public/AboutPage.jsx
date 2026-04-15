import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FiGlobe, FiShield, FiZap, FiHeart } from 'react-icons/fi';
import PublicLayout from '../../components/layout/PublicLayout';

const VALUES = [
  { icon: <FiZap size={22} className="text-brand-600" />, title: 'Speed first', desc: 'Verification codes delivered in seconds, not minutes. We poll providers every 5 seconds so you never wait.' },
  { icon: <FiShield size={22} className="text-brand-600" />, title: 'Privacy by design', desc: 'We never sell your data. Numbers are temporary, SMS content is automatically cleaned after 30 days.' },
  { icon: <FiGlobe size={22} className="text-brand-600" />, title: 'Global reach', desc: 'Numbers from 50+ countries so you can verify on any platform, from anywhere in the world.' },
  { icon: <FiHeart size={22} className="text-brand-600" />, title: 'Fair pricing', desc: 'Credits never expire. Cancel before SMS arrives and get a full refund. No tricks, no traps.' },
];

export default function AboutPage() {
  return (
    <PublicLayout>
      <Helmet>
        <title>About TextLix — Virtual Phone Numbers for SMS Verification</title>
        <meta name="description" content="TextLix provides virtual phone numbers from 50+ countries for SMS verification. Learn about our mission, values, and the team behind the platform." />
        <link rel="canonical" href="https://www.textlix.com/about" />
        <meta property="og:title" content="About TextLix" />
        <meta property="og:description" content="Virtual phone numbers for SMS verification from 50+ countries. Learn about our mission and values." />
        <meta property="og:url" content="https://www.textlix.com/about" />
      </Helmet>

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-600 to-purple-600 text-white py-24 px-4 text-center">
        <h1 className="font-display font-extrabold text-4xl md:text-5xl mb-6">Built for people who verify smarter</h1>
        <p className="text-brand-100 text-lg max-w-2xl mx-auto">
          TextLix was built out of frustration with expensive, slow, and unreliable SMS verification services.
          We wanted something fast, affordable, and honest — so we built it.
        </p>
      </section>

      {/* Mission */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display font-bold text-2xl text-gray-900 mb-6">Our mission</h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-6">
            Phone number verification has become the standard for account security — but not everyone has access
            to the right number at the right time. Whether you're protecting your privacy, testing an app,
            or managing multiple accounts, you deserve a reliable way to receive SMS codes without exposing your real number.
          </p>
          <p className="text-gray-600 text-lg leading-relaxed">
            TextLix gives you instant access to virtual numbers from 50+ countries. Real-time delivery,
            fair credit-based pricing, and a no-nonsense refund policy if the SMS never arrives.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display font-bold text-2xl text-gray-900 text-center mb-12">What we stand for</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {VALUES.map((v) => (
              <div key={v.title} className="bg-white border border-gray-100 rounded-2xl p-6">
                <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center mb-4">
                  {v.icon}
                </div>
                <h3 className="font-display font-semibold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display font-bold text-2xl text-gray-900 mb-12">TextLix by the numbers</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '50+', label: 'Countries' },
              { value: '100+', label: 'Services supported' },
              { value: '<5s', label: 'Avg. SMS delivery' },
              { value: '24/7', label: 'Platform uptime' },
            ].map((s) => (
              <div key={s.label}>
                <p className="font-display font-extrabold text-4xl text-brand-600 mb-1">{s.value}</p>
                <p className="text-sm text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-gradient-to-br from-brand-600 to-purple-600 text-white text-center">
        <h2 className="font-display font-bold text-3xl mb-3">Ready to try it?</h2>
        <p className="text-brand-100 mb-8">Join thousands of users who verify smarter with TextLix.</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/register" className="bg-white text-brand-600 font-semibold px-8 py-3 rounded-xl hover:bg-brand-50 transition-colors">
            Create Free Account
          </Link>
          <Link to="/pricing" className="border border-white/40 text-white font-semibold px-8 py-3 rounded-xl hover:bg-white/10 transition-colors">
            View Pricing
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
