import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCopy, FiCheck, FiSmartphone } from 'react-icons/fi';

/**
 * Looping mock of the OTP receive flow for the hero.
 * Cycles: waiting → typing → SMS arrives → copied → reset.
 * Pure presentational — no network calls, no real numbers.
 */

const SCENARIOS = [
  { service: 'WhatsApp', emoji: '💬', country: '🇬🇧 +44', number: '7700 900 142', code: '482 715', message: 'Your WhatsApp code is 482-715. Don\'t share it.' },
  { service: 'Telegram', emoji: '✈️', country: '🇺🇸 +1',  number: '415 555 0186', code: '93 821',  message: 'Login code: 93821. Do not share.' },
  { service: 'Google',   emoji: '🔍', country: '🇩🇪 +49', number: '162 904 1733', code: '628 491', message: 'G-628491 is your Google verification code.' },
];

const PHASES = ['waiting', 'typing', 'sms', 'copied'];

export default function OtpDemoWidget() {
  const [phase, setPhase] = useState('waiting');
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const scenario = SCENARIOS[scenarioIdx];

  useEffect(() => {
    const timings = { waiting: 2200, typing: 1600, sms: 4200, copied: 1800 };
    const timer = setTimeout(() => {
      const next = PHASES[(PHASES.indexOf(phase) + 1) % PHASES.length];
      if (next === 'waiting') setScenarioIdx((i) => (i + 1) % SCENARIOS.length);
      setPhase(next);
    }, timings[phase]);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* Soft brand glow behind the widget */}
      <div className="absolute -inset-6 bg-gradient-to-tr from-brand-500/30 via-brand-300/20 to-transparent rounded-[2.5rem] blur-2xl" aria-hidden="true" />

      <div className="relative bg-white dark:bg-gray-900 rounded-3xl border border-white/20 dark:border-gray-700 shadow-2xl overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-base">{scenario.emoji}</div>
            <div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{scenario.service}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Verification</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Live</span>
          </div>
        </div>

        {/* Phone number row */}
        <div className="px-5 pt-5 pb-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Your virtual number</p>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 flex items-center justify-center">
              <FiSmartphone size={16} />
            </div>
            <div className="font-mono-num">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{scenario.country}</p>
              <p className="text-base font-semibold text-gray-900 dark:text-white leading-tight">{scenario.number}</p>
            </div>
          </div>
        </div>

        {/* SMS area */}
        <div className="px-5 pb-5 min-h-[180px] flex flex-col justify-end">
          <AnimatePresence mode="wait">
            {phase === 'waiting' && (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center text-center py-8"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Dot delay={0} />
                  <Dot delay={0.15} />
                  <Dot delay={0.3} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Waiting for SMS…</p>
              </motion.div>
            )}

            {phase === 'typing' && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-end gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex-shrink-0" />
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Dot delay={0} small />
                    <Dot delay={0.15} small />
                    <Dot delay={0.3} small />
                  </div>
                </div>
              </motion.div>
            )}

            {(phase === 'sms' || phase === 'copied') && (
              <motion.div
                key="sms"
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-3"
              >
                <div className="flex items-end gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex-shrink-0" />
                  <div className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5 text-xs leading-relaxed max-w-[85%]">
                    {scenario.message}
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25, type: 'spring', stiffness: 220, damping: 16 }}
                  className="bg-gradient-to-r from-brand-50 to-brand-100 dark:from-brand-900/40 dark:to-brand-800/40 border border-brand-200 dark:border-brand-700 rounded-xl px-3 py-2.5 flex items-center justify-between"
                >
                  <div>
                    <p className="text-[10px] font-semibold text-brand-600 dark:text-brand-300 uppercase tracking-wider">Code detected</p>
                    <p className="font-mono-num text-xl font-bold text-brand-700 dark:text-brand-200 tracking-wider leading-tight">{scenario.code}</p>
                  </div>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className={`text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors ${
                      phase === 'copied'
                        ? 'bg-green-500 text-white'
                        : 'bg-white dark:bg-gray-800 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-700'
                    }`}
                  >
                    {phase === 'copied' ? <><FiCheck size={13} /> Copied</> : <><FiCopy size={13} /> Copy</>}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay = 0, small = false }) {
  return (
    <motion.span
      animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 1.1, repeat: Infinity, delay, ease: 'easeInOut' }}
      className={`${small ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-brand-500 dark:bg-brand-400`}
    />
  );
}
