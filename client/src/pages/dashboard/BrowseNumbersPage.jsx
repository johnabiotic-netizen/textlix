import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { FiZap, FiCalendar, FiArrowRight, FiSmartphone, FiCheck, FiTrendingUp, FiClock, FiGlobe, FiRefreshCw } from 'react-icons/fi';
import { useRecentServices } from '../../hooks/useRecentServices';
import { getTrendingServices } from '../../api/numbers';
import Card from '../../components/common/Card';

const SERVICE_EMOJI = {
  whatsapp:'💬', telegram:'✈️', google:'🔍', instagram:'📸', facebook:'📘',
  tiktok:'🎵', twitter:'🐦', discord:'🎮', snapchat:'👻', amazon:'📦',
  netflix:'🎬', linkedin:'💼', uber:'🚗', paypal:'💳', binance:'🪙',
  coinbase:'🟦', revolut:'💳', steam:'🎮', apple:'🍎',
};

/* ─── Compact looping preview for the OTP card ──────────────────────────── */
const OTP_DEMOS = [
  { country: '🇬🇧 +44 7700 900 142', code: '482 715', service: 'WhatsApp' },
  { country: '🇺🇸 +1 415 555 0186', code: '93 821', service: 'Telegram' },
  { country: '🇩🇪 +49 162 904 1733', code: '628 491', service: 'Google' },
];

function OtpMiniPreview() {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState('arrive');
  useEffect(() => {
    if (phase === 'arrive') {
      const t = setTimeout(() => setPhase('hold'), 1700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setI((n) => (n + 1) % OTP_DEMOS.length);
      setPhase('arrive');
    }, 1800);
    return () => clearTimeout(t);
  }, [phase, i]);

  const demo = OTP_DEMOS[i];
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-3 flex items-center gap-3 shadow-sm">
      <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 flex items-center justify-center shrink-0">
        <FiSmartphone size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{demo.service}</p>
        <p className="text-xs font-mono-num font-semibold text-gray-900 dark:text-white truncate">{demo.country}</p>
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={`${i}-${demo.code}`}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="font-mono-num font-bold text-sm text-brand-700 dark:text-brand-200 bg-brand-50 dark:bg-brand-900/40 px-2 py-1 rounded shrink-0"
        >
          {demo.code}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/* ─── Compact looping preview for the Rental card ───────────────────────── */
function RentalMiniPreview() {
  const [days, setDays] = useState(7);
  const [msgCount, setMsgCount] = useState(1);
  useEffect(() => {
    const t = setInterval(() => {
      setMsgCount((c) => (c >= 4 ? 1 : c + 1));
      setDays((d) => (d <= 1 ? 7 : d - 1));
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 flex items-center justify-center">
            <FiCalendar size={14} />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Telegram · 7-day rental</p>
            <p className="text-xs font-mono-num font-semibold text-gray-900 dark:text-white">🇩🇪 162 904 1733</p>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 rounded-full px-2 py-0.5 whitespace-nowrap">
          {days}d left
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-2">
        <p className="text-[10px] text-gray-500 dark:text-gray-400">
          <AnimatePresence mode="wait">
            <motion.span
              key={msgCount}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="inline-block"
            >
              <span className="font-mono-num font-bold text-brand-700 dark:text-brand-300">{msgCount}</span>{' '}
              code{msgCount === 1 ? '' : 's'} received
            </motion.span>
          </AnimatePresence>
        </p>
        <FiCheck className="text-green-500" size={13} />
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function BrowseNumbersPage() {
  const { recent } = useRecentServices();

  const { data: trendingData } = useQuery({
    queryKey: ['trendingServices'],
    queryFn: () => getTrendingServices().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const trending = (trendingData?.trending || []).slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-1">Get a Number</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Choose what type of number you need</p>
      </div>

      {recent.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 dark:text-gray-200 text-sm mb-3">Recently used</h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((s) => (
              <Link
                key={s.slug}
                to={`/numbers/otp/service/${s.slug}`}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-brand-400 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-brand-700 transition-all"
              >
                <span>{s.emoji || SERVICE_EMOJI[s.slug] || '📱'}</span>
                {s.name || s.slug}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* OTP + Rental hero cards */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* OTP */}
        <Link to="/numbers/otp" className="group block relative overflow-hidden">
          <div className="relative border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-400 rounded-2xl p-6 lg:p-8 bg-white dark:bg-gray-800 transition-all hover:shadow-xl hover:-translate-y-0.5 duration-300">
            {/* Decorative gradient */}
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-gradient-to-br from-brand-200/40 to-brand-400/10 dark:from-brand-700/20 dark:to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex items-start justify-between mb-5">
              <div className="w-14 h-14 bg-brand-100 dark:bg-brand-900/40 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <FiZap size={26} className="text-brand-600 dark:text-brand-300" />
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-3 py-1 rounded-full">
                <FiClock size={11} /> 20 min
              </span>
            </div>

            <h2 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-2">One-Time OTP</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
              A fresh number active for 20 minutes. One SMS code. <span className="font-semibold text-brand-600 dark:text-brand-300">Full refund if no code arrives.</span>
            </p>

            <OtpMiniPreview />

            <ul className="grid grid-cols-2 gap-2 mt-5 mb-6 text-xs">
              {[
                { icon: <FiZap size={11} />, text: 'Seconds to issue' },
                { icon: <FiGlobe size={11} />, text: '150+ countries' },
                { icon: <FiRefreshCw size={11} />, text: 'Auto refund' },
                { icon: <FiSmartphone size={11} />, text: 'From 10 cr' },
              ].map((f) => (
                <li key={f.text} className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <span className="text-brand-500">{f.icon}</span>
                  {f.text}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2 text-brand-600 dark:text-brand-300 font-semibold text-sm group-hover:gap-3 transition-all">
              Browse OTP numbers <FiArrowRight size={16} />
            </div>
          </div>
        </Link>

        {/* Rental */}
        <Link to="/numbers/rental" className="group block relative overflow-hidden">
          <div className="relative border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-400 rounded-2xl p-6 lg:p-8 bg-white dark:bg-gray-800 transition-all hover:shadow-xl hover:-translate-y-0.5 duration-300">
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-gradient-to-br from-brand-300/30 to-brand-500/10 dark:from-brand-600/20 dark:to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex items-start justify-between mb-5">
              <div className="w-14 h-14 bg-brand-100 dark:bg-brand-900/40 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <FiCalendar size={26} className="text-brand-600 dark:text-brand-300" />
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-3 py-1 rounded-full">
                <FiCalendar size={11} /> 7–30 days
              </span>
            </div>

            <h2 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-2">Long-Term Rental</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
              Keep the same number for days or weeks. Receive <span className="font-semibold text-brand-600 dark:text-brand-300">unlimited codes</span> on it over the rental period.
            </p>

            <RentalMiniPreview />

            <ul className="grid grid-cols-2 gap-2 mt-5 mb-6 text-xs">
              {[
                { icon: <FiCalendar size={11} />, text: '7 / 14 / 21 / 30 days' },
                { icon: <FiSmartphone size={11} />, text: 'Unlimited SMS' },
                { icon: <FiGlobe size={11} />, text: '30 countries' },
                { icon: <FiZap size={11} />, text: '100+ services' },
              ].map((f) => (
                <li key={f.text} className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <span className="text-brand-500">{f.icon}</span>
                  {f.text}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2 text-brand-600 dark:text-brand-300 font-semibold text-sm group-hover:gap-3 transition-all">
              Browse rental numbers <FiArrowRight size={16} />
            </div>
          </div>
        </Link>
      </div>

      {/* Popular right now */}
      {trending.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FiTrendingUp className="text-orange-500" size={16} />
              <h2 className="font-semibold text-gray-900 dark:text-white">Popular right now</h2>
              <span className="text-xs text-gray-400 dark:text-gray-500">· last 24h</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {trending.map((svc, i) => (
              <Link
                key={svc.slug}
                to={`/numbers/otp/service/${svc.slug}`}
                className="group"
              >
                <Card hover className="p-4 flex items-center gap-3">
                  <span className="text-[10px] font-bold text-gray-300 dark:text-gray-600 w-3 text-center">{i + 1}</span>
                  <span className="text-2xl shrink-0">{SERVICE_EMOJI[svc.slug] || '📱'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{svc.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{svc.count} ordered</p>
                  </div>
                  <FiArrowRight size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
