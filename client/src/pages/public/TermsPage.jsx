import { Link } from 'react-router-dom';

export default function TermsPage() {
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
        <h1 className="font-display font-extrabold text-4xl text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-gray-400 text-sm mb-10">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-600 leading-relaxed">
          {[
            { title: '1. Acceptance of Terms', body: 'By accessing and using TextLix ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.' },
            { title: '2. Description of Service', body: 'TextLix provides temporary virtual phone numbers for receiving SMS verification codes. The Service is intended for legitimate personal and business use only.' },
            { title: '3. Acceptable Use', body: 'You agree not to use TextLix for any illegal activity, fraud, spam, harassment, or violation of any third-party terms of service. You are solely responsible for how you use virtual numbers obtained through the Service.' },
            { title: '4. Credits and Payments', body: 'Credits are non-refundable except as outlined in our refund policy. Credits are automatically refunded if no SMS is received within 20 minutes of obtaining a number. Minimum purchase is $2 USD equivalent.' },
            { title: '5. Privacy', body: 'SMS content received through the Service is automatically deleted after 24 hours. We do not sell or share your personal data with third parties. See our Privacy Policy for full details.' },
            { title: '6. Service Availability', body: 'We strive for 99.9% uptime but do not guarantee uninterrupted service. Number and SMS availability depends on third-party providers and may vary by country and service.' },
            { title: '7. Account Termination', body: 'We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or abuse the Service. Remaining credits may be forfeited upon termination for policy violations.' },
            { title: '8. Limitation of Liability', body: 'TextLix is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.' },
            { title: '9. Changes to Terms', body: 'We may update these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.' },
            { title: '10. Contact', body: 'For questions about these terms, contact us at support@textlix.com.' },
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
