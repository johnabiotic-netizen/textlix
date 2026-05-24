import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCalendar, FiCheckCircle, FiSmartphone } from 'react-icons/fi';

/**
 * Looping mock of the long-term rental flow for the hero alternate widget.
 * Shows a 7-day rental with multiple SMS arriving on the same number over time.
 * Pure presentational — no network calls.
 */

const SCENARIO = {
  service: 'Telegram',
  emoji: '✈️',
  country: '🇩🇪 +49',
  number: '162 904 1733',
  totalDays: 7,
  messages: [
    { from: 'Telegram',   text: 'Login code: 47812.', code: '47812', age: 'Day 1' },
    { from: 'Telegram',   text: 'New device login: 92341', code: '92341', age: 'Day 3' },
    { from: 'Telegram',   text: 'Security check: 16085', code: '16085', age: 'Day 5' },
    { from: 'Telegram',   text: 'Login code: 39472', code: '39472', age: 'Day 7' },
  ],
};

export default function RentalDemoWidget() {
  const [count, setCount] = useState(1);
  const [daysRemaining, setDaysRemaining] = useState(7);

  // Stream messages: add one every ~2.5s, when full, hold then reset
  useEffect(() => {
    const total = SCENARIO.messages.length;
    if (count < total) {
      const t = setTimeout(() => setCount((n) => n + 1), 2500);
      return () => clearTimeout(t);
    }
    // After all messages shown, pause then reset
    const t = setTimeout(() => setCount(1), 4500);
    return () => clearTimeout(t);
  }, [count]);

  // Days remaining ticks down slowly
  useEffect(() => {
    const t = setInterval(() => {
      setDaysRemaining((d) => (d <= 1 ? 7 : d - 1));
    }, 3500);
    return () => clearInterval(t);
  }, []);

  const visibleMessages = SCENARIO.messages.slice(0, count);

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-6 bg-gradient-to-bl from-brand-400/30 via-brand-200/20 to-transparent rounded-[2.5rem] blur-2xl" aria-hidden="true" />

      <div className="relative bg-white dark:bg-gray-900 rounded-3xl border border-white/20 dark:border-gray-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-base">{SCENARIO.emoji}</div>
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{SCENARIO.service} Rental</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">7-day plan</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full px-2.5 py-1">
            <FiCalendar size={11} />
            <span className="text-[10px] font-semibold">{daysRemaining}d left</span>
          </div>
        </div>

        {/* Number */}
        <div className="px-5 pt-5 pb-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Your rented number</p>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 flex items-center justify-center">
              <FiSmartphone size={16} />
            </div>
            <div className="font-mono-num flex-1">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{SCENARIO.country}</p>
              <p className="text-base font-semibold text-gray-900 dark:text-white leading-tight">{SCENARIO.number}</p>
            </div>
            <FiCheckCircle className="text-green-500 dark:text-green-400" size={18} />
          </div>
        </div>

        {/* SMS stream */}
        <div className="px-5 pb-5 min-h-[180px]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Messages received</p>
            <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-300">{visibleMessages.length}</span>
          </div>

          <div className="space-y-1.5 max-h-[160px] overflow-hidden">
            <AnimatePresence initial={false}>
              {visibleMessages.map((msg, i) => (
                <motion.div
                  key={`${count}-${i}`}
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <p className="text-gray-500 dark:text-gray-400 text-[10px]">{msg.age}</p>
                    <p className="text-gray-700 dark:text-gray-200 truncate">{msg.text}</p>
                  </div>
                  <span className="ml-2 font-mono-num font-bold text-brand-700 dark:text-brand-200 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded text-xs flex-shrink-0">
                    {msg.code}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
