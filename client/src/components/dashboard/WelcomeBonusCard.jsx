import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RiCheckLine, RiExternalLinkLine } from 'react-icons/ri';
import toast from 'react-hot-toast';
import { getWelcomeBonusStatus, claimWelcomeBonus } from '../../api/payments';
import useAuthStore from '../../store/authStore';
import Card from '../common/Card';

const IG_URL = 'https://instagram.com/gettextlix';
const TT_URL = 'https://tiktok.com/@gettextlix';

export default function WelcomeBonusCard() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();

  const [igClicked, setIgClicked] = useState(false);
  const [ttClicked, setTtClicked] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['welcomeBonusStatus'],
    queryFn: () => getWelcomeBonusStatus().then((r) => r.data.data),
    staleTime: 30000,
  });

  const claim = useMutation({
    mutationFn: () => claimWelcomeBonus().then((r) => r.data.data),
    onSuccess: (data) => {
      toast.success(`🎉 +${data.credits} credits added to your account!`, { duration: 5000 });
      if (user) setUser({ ...user, creditBalance: data.newBalance });
      qc.invalidateQueries({ queryKey: ['welcomeBonusStatus'] });
      qc.invalidateQueries({ queryKey: ['recentTx'] });
    },
    onError: (err) => {
      const msg = err?.response?.data?.error?.message || 'Could not claim — try again';
      toast.error(msg);
    },
  });

  if (isLoading || !status || !status.eligible) return null;

  const openLink = (url, setter) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setter(true);
  };

  const canClaim = igClicked && ttClicked && !claim.isPending;
  const lowSpots = status.remaining <= 100;

  return (
    <Card className="p-6 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-amber-900/20 dark:via-gray-800 dark:to-orange-900/20 border-2 border-amber-300 dark:border-amber-700/50 relative overflow-hidden">
      <div className="absolute -top-6 -right-6 text-9xl opacity-10 select-none pointer-events-none">🎁</div>

      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap relative">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="text-3xl shrink-0">🎁</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-full">
                Pre-launch only
              </span>
              {lowSpots && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                  Almost gone
                </span>
              )}
            </div>
            <h3 className="font-display font-bold text-lg text-gray-900 dark:text-white leading-tight">
              Get {status.credits} free credits
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
              First {status.totalCap} sign-ups only — follow us on both platforms, then claim.
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Spots left</p>
          <p className="font-mono font-bold text-2xl text-amber-600 dark:text-amber-400 leading-none">
            {status.remaining}
            <span className="text-gray-300 dark:text-gray-600 text-base">/{status.totalCap}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <button
          type="button"
          onClick={() => openLink(IG_URL, setIgClicked)}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
            igClicked
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-300 dark:border-green-700'
              : 'bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white hover:opacity-90 border-2 border-transparent shadow-sm'
          }`}
        >
          {igClicked
            ? <><RiCheckLine size={18} /> Followed on Instagram</>
            : <>📸 Follow @gettextlix on Instagram <RiExternalLinkLine size={14} /></>}
        </button>
        <button
          type="button"
          onClick={() => openLink(TT_URL, setTtClicked)}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
            ttClicked
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-2 border-green-300 dark:border-green-700'
              : 'bg-gray-900 text-white hover:bg-black border-2 border-transparent shadow-sm'
          }`}
        >
          {ttClicked
            ? <><RiCheckLine size={18} /> Followed on TikTok</>
            : <>🎵 Follow @gettextlix on TikTok <RiExternalLinkLine size={14} /></>}
        </button>
      </div>

      <button
        type="button"
        onClick={() => claim.mutate()}
        disabled={!canClaim}
        className={`w-full font-semibold text-sm py-3 rounded-xl transition-all ${
          canClaim
            ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
        }`}
      >
        {claim.isPending
          ? 'Claiming…'
          : canClaim
            ? `Done — claim my ${status.credits} free credits`
            : 'Follow both to unlock claim'}
      </button>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
        Spot checks performed. One claim per account.
      </p>
    </Card>
  );
}
