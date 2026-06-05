import { Link } from 'react-router-dom';
import { FiMail, FiMessageCircle, FiBook } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';

export default function SupportPage() {
  const { user } = useAuthStore();
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 font-body">
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl text-gray-900 dark:text-white">
            <span>✓</span> textlix
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Sign in</Link>
            <Link to="/register" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">Get Started</Link>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-br from-[#0A1831] to-brand-600 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display font-extrabold text-4xl md:text-5xl mb-4">Support</h1>
          <p className="text-brand-100 text-lg">We're here to help. Choose how you'd like to reach us.</p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {/* Live Chat */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-center hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
              <div className="w-14 h-14 bg-brand-50 dark:bg-brand-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FiMessageCircle size={26} className="text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="font-display font-bold text-lg text-gray-900 dark:text-white mb-2">Live Chat</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Chat with our assistant in real-time. Available 24/7 from your dashboard.</p>
              <Link
                to={user ? '/dashboard' : '/login'}
                className="w-full block bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {user ? 'Open Chat' : 'Sign in to Chat'}
              </Link>
            </div>

            {/* Email */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-center hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
              <div className="w-14 h-14 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FiMail size={26} className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-display font-bold text-lg text-gray-900 dark:text-white mb-2">Email Us</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Send us an email and we'll respond within 24 hours.</p>
              <a
                href="mailto:support@textlix.com"
                className="w-full block bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                support@textlix.com
              </a>
            </div>

            {/* FAQ */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-center hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
              <div className="w-14 h-14 bg-brand-50 dark:bg-brand-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FiBook size={26} className="text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="font-display font-bold text-lg text-gray-900 dark:text-white mb-2">FAQ</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Find instant answers to common questions.</p>
              <Link
                to="/faq"
                className="w-full block bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                Browse FAQ
              </Link>
            </div>
          </div>

          {/* Common issues */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-8">
            <h2 className="font-display font-bold text-xl text-gray-900 dark:text-white mb-6">Common Issues</h2>
            <div className="space-y-4">
              {[
                { issue: 'I didn\'t receive an SMS', answer: 'If no SMS arrives within 20 minutes, the number expires and your credits are automatically refunded.' },
                { issue: 'My payment failed', answer: 'Check that your card details are correct. For crypto payments, ensure you sent the exact amount within the time window.' },
                { issue: 'I can\'t log in', answer: 'Try resetting your password. If you signed up with Google, use the "Continue with Google" button.' },
                { issue: 'Credits not added after payment', answer: 'Credits are added instantly after payment confirmation. If delayed, please contact support with your payment reference.' },
              ].map((item) => (
                <div key={item.issue} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{item.issue}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 dark:border-gray-800 py-10 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">© {new Date().getFullYear()} textlix. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-gray-500 dark:text-gray-400">
            <Link to="/faq" className="hover:text-gray-700 dark:hover:text-gray-200">FAQ</Link>
            <Link to="/support" className="hover:text-gray-700 dark:hover:text-gray-200">Support</Link>
            <Link to="/terms" className="hover:text-gray-700 dark:hover:text-gray-200">Terms</Link>
            <Link to="/privacy" className="hover:text-gray-700 dark:hover:text-gray-200">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
