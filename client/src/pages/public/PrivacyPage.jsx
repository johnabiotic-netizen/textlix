import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white font-body">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl text-gray-900">
            <span>✓</span> TextLix
          </Link>
          <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">Sign in</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="font-display font-extrabold text-4xl text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-400 text-sm mb-10">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="space-y-8 text-sm text-gray-600 leading-relaxed">
          {[
            { title: '1. Information We Collect', body: 'We collect your name, email address, and payment information when you create an account or make a purchase. We also collect usage data such as numbers ordered and SMS received.' },
            { title: '2. How We Use Your Information', body: 'Your information is used to provide and improve the Service, process payments, send account-related emails, and comply with legal obligations. We do not sell your personal data to third parties.' },
            { title: '3. SMS Data', body: 'SMS content received through our platform is stored temporarily to display it on your dashboard and is automatically deleted after 24 hours. We do not read or analyze SMS content.' },
            { title: '4. Cookies', body: 'We use cookies to maintain your login session and improve your experience. You can disable cookies in your browser settings, but this may affect Service functionality.' },
            { title: '5. Third-Party Services', body: 'We use third-party services including MongoDB Atlas (database), Railway (hosting), Paystack and CoinGate (payments), 5sim and SMSActivate (SMS providers), and Resend (email). Each has their own privacy policies.' },
            { title: '6. Data Security', body: 'We use industry-standard encryption and security practices to protect your data. Passwords are hashed using bcrypt. Access tokens expire after 15 minutes.' },
            { title: '7. Data Retention', body: 'Account data is retained until you delete your account. SMS content is deleted after 24 hours. Payment records are retained for 7 years for legal compliance.' },
            { title: '8. Your Rights', body: 'You have the right to access, correct, or delete your personal data at any time. Contact us at support@textlix.com to exercise these rights.' },
            { title: '9. Children\'s Privacy', body: 'TextLix is not intended for users under 18 years of age. We do not knowingly collect data from children.' },
            { title: '10. Contact', body: 'For privacy-related questions or requests, contact us at support@textlix.com.' },
          ].map((section) => (
            <div key={section.title}>
              <h2 className="font-display font-bold text-lg text-gray-900 mb-2">{section.title}</h2>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
      </div>

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
  );
}
