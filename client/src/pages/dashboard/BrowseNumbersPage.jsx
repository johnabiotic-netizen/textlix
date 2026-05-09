import { Link } from 'react-router-dom';
import { FiZap, FiCalendar, FiArrowRight } from 'react-icons/fi';
import { useRecentServices } from '../../hooks/useRecentServices';

const SERVICE_EMOJI = { whatsapp:'💬', telegram:'✈️', google:'🔍', instagram:'📸', facebook:'📘', tiktok:'🎵', twitter:'🐦', discord:'🎮', snapchat:'👻', amazon:'📦' };

export default function BrowseNumbersPage() {
  const { recent } = useRecentServices();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-gray-900 mb-1">Get a Number</h1>
        <p className="text-gray-500 text-sm">Choose what type of number you need</p>
      </div>

      {recent.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 text-sm mb-3">Recently Used</h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((s) => (
              <Link
                key={s.slug}
                to={`/numbers/otp/service/${s.slug}`}
                className="flex items-center gap-2 bg-white border border-gray-200 hover:border-brand-400 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-brand-700 transition-all"
              >
                <span>{s.emoji || SERVICE_EMOJI[s.slug] || '📱'}</span>
                {s.name || s.slug}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
        {/* OTP Card */}
        <Link to="/numbers/otp" className="group block border-2 border-gray-200 hover:border-brand-400 rounded-2xl p-7 transition-all hover:shadow-md bg-white">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-brand-100 transition-colors">
            <FiZap size={26} className="text-brand-600" />
          </div>
          <h2 className="font-display font-bold text-xl text-gray-900 mb-2">One-Time OTP</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-5">
            Get a number active for 20 minutes. Receive one SMS verification code. Full refund if no SMS arrives.
          </p>
          <ul className="space-y-2 mb-6">
            {['Active for 20 minutes', 'Full refund if unused', '150+ countries', 'Instant delivery'].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 bg-brand-500 rounded-full shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 text-brand-600 font-semibold text-sm group-hover:gap-3 transition-all">
            Browse OTP Numbers <FiArrowRight size={16} />
          </div>
        </Link>

        {/* Rental Card */}
        <Link to="/numbers/rental" className="group block border-2 border-gray-200 hover:border-purple-400 rounded-2xl p-7 transition-all hover:shadow-md bg-white">
          <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-purple-100 transition-colors">
            <FiCalendar size={26} className="text-purple-600" />
          </div>
          <h2 className="font-display font-bold text-xl text-gray-900 mb-2">Rental Number</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-5">
            Keep a number active for 1 to 30 days. Receive multiple SMS codes on the same number over time.
          </p>
          <ul className="space-y-2 mb-6">
            {['Active for 1, 7, or 30 days', 'Multiple SMS codes', 'WhatsApp, Telegram & more', 'Long-term use'].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 text-purple-600 font-semibold text-sm group-hover:gap-3 transition-all">
            Browse Rental Numbers <FiArrowRight size={16} />
          </div>
        </Link>
      </div>
    </div>
  );
}
