import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RiCheckLine, RiFileCopyLine } from 'react-icons/ri';
import toast from 'react-hot-toast';
import { getPromoStatus } from '../../api/payments';
import { copyToClipboard } from '../../utils/clipboard';
import Card from '../common/Card';

const PROMO_CODE = 'LAUNCH10';

export default function LaunchPromoCard() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['promoStatus', PROMO_CODE],
    queryFn: () => getPromoStatus(PROMO_CODE).then((r) => r.data.data),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Banner disappears on its own once the promo is exhausted or deactivated.
  if (isLoading || !data?.active) return null;

  const { value, minAmountUSD, maxUses, remaining } = data.promo;
  const example = (usd) => {
    const base = usd * 100;
    const bonus = Math.floor((base * value) / 100);
    return { base, bonus, total: base + bonus };
  };
  const ex10 = example(minAmountUSD);
  const ex15 = example(15);
  const ex20 = example(20);
  const bigBonus = Math.floor((5000 * value) / 100);
  const lowSpots = remaining !== null && remaining <= 100;
  const claimedPct = maxUses ? Math.min(100, Math.round(((maxUses - remaining) / maxUses) * 100)) : 0;

  const copyCode = async () => {
    const ok = await copyToClipboard(PROMO_CODE);
    if (!ok) { toast.error('Copy failed — type LAUNCH10 at checkout'); return; }
    setCopied(true);
    toast.success('Code copied — paste it at checkout!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-brand-50 via-white to-violet-50 dark:from-brand-900/30 dark:via-gray-800 dark:to-violet-900/20 border-2 border-brand-300 dark:border-brand-700/60 relative overflow-hidden">
      <div className="absolute -top-6 -right-6 text-9xl opacity-10 select-none pointer-events-none">🚀</div>

      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap relative">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="text-3xl shrink-0">🚀</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-600 text-white px-2 py-0.5 rounded-full">
                This month only
              </span>
              {lowSpots && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                  Almost gone
                </span>
              )}
            </div>
            <h3 className="font-display font-bold text-lg text-gray-900 dark:text-white leading-tight">
              We just launched — grab +{value}% extra credits 🎉
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
              First {maxUses} recharges only. Code <span className="font-mono font-bold">{PROMO_CODE}</span> on any top-up of ${minAmountUSD}+.
            </p>
          </div>
        </div>
        {remaining !== null && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">Spots left</p>
            <p className="font-mono font-bold text-2xl text-brand-600 dark:text-brand-300 leading-none">
              {remaining}
              <span className="text-gray-300 dark:text-gray-600 text-base">/{maxUses}</span>
            </p>
          </div>
        )}
      </div>

      <ul className="space-y-2 mb-4">
        {[
          <>Top up ${minAmountUSD} → get <strong>{ex10.total.toLocaleString()} credits</strong> instead of {ex10.base.toLocaleString()} — that's {ex10.bonus.toLocaleString()} free</>,
          <>Top up $15 → get <strong>{ex15.total.toLocaleString()} credits</strong> instead of {ex15.base.toLocaleString()} — that's {ex15.bonus.toLocaleString()} free</>,
          <>Top up $20 → get <strong>{ex20.total.toLocaleString()} credits</strong> instead of {ex20.base.toLocaleString()} — that's {ex20.bonus.toLocaleString()} free</>,
          <>The more you load, the more you get: $50 → <strong>+{bigBonus.toLocaleString()} free credits</strong></>,
          <>Bonus credits <strong>never expire</strong> and work on every number and service</>,
        ].map((benefit, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
            <RiCheckLine size={18} className="text-green-500 shrink-0 mt-0.5" />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      {maxUses && (
        <div className="mb-4">
          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full transition-all"
              style={{ width: `${Math.max(claimedPct, 4)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{claimedPct}% claimed</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={copyCode}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono font-bold text-sm tracking-widest border-2 border-dashed border-brand-400 dark:border-brand-600 text-brand-700 dark:text-brand-300 bg-white/60 dark:bg-gray-900/40 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
        >
          {copied ? <><RiCheckLine size={16} /> Copied!</> : <>{PROMO_CODE} <RiFileCopyLine size={14} /></>}
        </button>
        <Link
          to={`/credits?promo=${PROMO_CODE}`}
          className="flex-1 flex items-center justify-center bg-brand-600 text-white font-semibold text-sm py-3 px-4 rounded-xl hover:bg-brand-700 shadow-sm transition-colors"
        >
          Claim my +{value}% bonus →
        </Link>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
        Applied automatically at checkout — gone when the {maxUses} spots fill up.
      </p>
    </Card>
  );
}
