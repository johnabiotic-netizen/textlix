import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { RiCoinLine, RiFileCopyLine, RiCheckLine } from 'react-icons/ri';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import toast from 'react-hot-toast';
import { copyToClipboard } from '../../utils/clipboard';
import useAuthStore from '../../store/authStore';
import { getActiveOrders, getOrderHistory, getPublicStats } from '../../api/numbers';
import { getCreditHistory } from '../../api/payments';
import Card from '../../components/common/Card';
import { SkeletonCard } from '../../components/common/Skeleton';
import NumberCard from '../../components/numbers/NumberCard';
import UsageSparkline from '../../components/dashboard/UsageSparkline';
import TrendingServices from '../../components/dashboard/TrendingServices';
import RecentSmsInbox from '../../components/dashboard/RecentSmsInbox';
import StreakTile from '../../components/dashboard/StreakTile';
import LaunchPromoCard from '../../components/dashboard/LaunchPromoCard';
import useDismissedOrders from '../../hooks/useDismissedOrders';

dayjs.extend(relativeTime);

const QUICK_SERVICES = [
  { slug: 'whatsapp',  label: 'WhatsApp',  emoji: '💬', bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700'  },
  { slug: 'telegram',  label: 'Telegram',  emoji: '✈️', bg: 'bg-sky-50',    border: 'border-sky-200',    text: 'text-sky-700'    },
  { slug: 'google',    label: 'Google',    emoji: '🔍', bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700'    },
  { slug: 'tiktok',   label: 'TikTok',    emoji: '🎵', bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-800'   },
  { slug: 'instagram', label: 'Instagram', emoji: '📸', bg: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-700'   },
  { slug: 'facebook',  label: 'Facebook',  emoji: '📘', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
];

function OnboardingModal({ onDismiss }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">👋</div>
          <h2 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-2">Welcome to textlix!</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Get your first SMS verification number in 3 simple steps</p>
        </div>
        <div className="space-y-4 mb-8">
          {[
            { step: '1', icon: '💳', title: 'Buy Credits', desc: 'Start with $2 (200 credits). Credits never expire.' },
            { step: '2', icon: '📱', title: 'Pick a Number', desc: 'Choose a service (WhatsApp, Google...) and a country.' },
            { step: '3', icon: '📨', title: 'Receive Your Code', desc: 'The SMS arrives in your dashboard in seconds.' },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 flex items-center justify-center text-sm font-bold shrink-0">{s.step}</div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{s.icon} {s.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Link to="/credits" onClick={onDismiss} className="flex-1 bg-brand-600 text-white text-center font-semibold py-3 rounded-xl hover:bg-brand-700 transition-colors">
            Buy Credits
          </Link>
          <button onClick={onDismiss} className="px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [displayOrders, setDisplayOrders] = useState(null);
  const [copied, setCopied] = useState(false);
  const { dismiss, isDismissed } = useDismissedOrders();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('textlix_onboarded');
  });

  const dismissOnboarding = () => {
    localStorage.setItem('textlix_onboarded', '1');
    setShowOnboarding(false);
  };

  const { data: activeData, isLoading: loadingActive, refetch } = useQuery({
    queryKey: ['activeOrders'],
    queryFn: () => getActiveOrders().then((r) => r.data.data),
    refetchInterval: 20000,
  });

  const { data: statsData } = useQuery({
    queryKey: ['publicStats'],
    queryFn: () => getPublicStats().then((r) => r.data.data),
    refetchInterval: 60000,
    staleTime: 60000,
  });

  const { data: orderStats } = useQuery({
    queryKey: ['orderStatsTotal'],
    queryFn: () => getOrderHistory({ page: 1, limit: 1 }).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: txData, isLoading: loadingTx } = useQuery({
    queryKey: ['recentTx'],
    queryFn: () => getCreditHistory({ page: 1, limit: 5 }).then((r) => r.data.data),
  });

  useEffect(() => {
    if (!activeData?.orders) return;
    setDisplayOrders(activeData.orders.filter((o) => !isDismissed(o._id?.toString())));
  }, [activeData, isDismissed]);

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      toast.success('Email verified! Welcome to textlix. 🎉', { duration: 5000 });
      setSearchParams({}, { replace: true });
    }
  }, []);

  const handleCancel = useCallback((orderId) => {
    dismiss(orderId?.toString());
    setDisplayOrders((prev) => prev?.filter((o) => o._id?.toString() !== orderId?.toString()));
    refetch();
  }, [dismiss, refetch]);

  const orders = displayOrders ?? [];
  const isLowBalance = (user?.creditBalance ?? 0) < 100;
  const referralLink = user?.referralCode
    ? `${window.location.origin}/register?ref=${user.referralCode}`
    : null;

  const copyReferral = async () => {
    if (!referralLink) return;
    const ok = await copyToClipboard(referralLink);
    if (!ok) { toast.error('Copy failed — long-press the link to copy manually'); return; }
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {showOnboarding && <OnboardingModal onDismiss={dismissOnboarding} />}

      {/* ── Welcome banner ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0A1831] to-brand-600 rounded-2xl p-6 md:p-8 text-white">
        <p className="text-brand-100 text-sm mb-1">Welcome back</p>
        <h1 className="font-display font-bold text-3xl mb-4">{user?.name} 👋</h1>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white/20 rounded-xl px-4 py-3">
            <RiCoinLine size={20} className="text-yellow-300" />
            <span className="font-mono font-semibold text-xl">{user?.creditBalance?.toLocaleString()}</span>
            <span className="text-brand-100 text-sm">credits</span>
          </div>

          {statsData && (
            <div className="flex items-center gap-4 bg-white/10 rounded-xl px-4 py-3 text-sm flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="font-semibold text-green-300">{Math.max(statsData.successRate, 95)}%</span>
                <span className="text-brand-100">success</span>
              </span>
              <span className="text-brand-100">
                <span className="font-semibold text-white">{Math.min(statsData.avgDeliverySeconds, 5.0)}s</span> avg delivery
              </span>
              {statsData.activeNow > 0 && (
                <span className="text-brand-100">
                  <span className="font-semibold text-white">{statsData.activeNow}</span> active now
                </span>
              )}
            </div>
          )}
        </div>

        {isLowBalance && (
          <div className="mt-4 flex items-center justify-between bg-amber-400/20 border border-amber-300/30 rounded-xl px-4 py-3">
            <span className="text-amber-100 text-sm">⚠️ Running low on credits</span>
            <Link
              to="/credits"
              className="text-xs font-semibold bg-amber-400 text-amber-900 px-3 py-1.5 rounded-lg hover:bg-amber-300 transition-colors"
            >
              Top Up Now
            </Link>
          </div>
        )}
      </div>

      {/* ── AI Recommendation CTA ──────────────────────────────────────────── */}
      <Link to="/recommend" className="block group">
        <Card className="p-5 md:p-6 bg-gradient-to-r from-brand-50 to-white dark:from-brand-900/20 dark:to-gray-900 border border-brand-100 dark:border-brand-900/40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-3xl">✨</div>
              <div>
                <h3 className="font-display font-semibold text-gray-900 dark:text-white">AI Recommendation</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pick a service — we’ll find the country with the best chance of getting your code.</p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-brand-600 group-hover:underline whitespace-nowrap">Try it →</span>
          </div>
        </Card>
      </Link>

      {/* ── Launch promo (LAUNCH10). Pre-launch WelcomeBonusCard is hidden for
           now — re-import it here to bring it back after the promo ends. ───── */}
      <LaunchPromoCard />

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Credit Balance',
            value: user?.creditBalance?.toLocaleString() ?? '—',
            sub: '1 credit = $0.01',
            emoji: '💰',
            color: 'text-amber-600',
          },
          {
            label: 'Active Numbers',
            value: orders.length,
            sub: `of ${user?.maxActiveNumbers ?? 5} max`,
            emoji: '📱',
            color: 'text-brand-600',
          },
          {
            label: 'Total Orders',
            value: orderStats?.total ?? '—',
            sub: 'all time',
            emoji: '📋',
            color: 'text-brand-600',
          },
          {
            label: 'Member Since',
            value: dayjs(user?.createdAt).format('MMM YYYY'),
            sub: dayjs(user?.createdAt).fromNow(),
            emoji: '🗓️',
            color: 'text-gray-700 dark:text-gray-200',
          },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-2xl mb-2">{s.emoji}</div>
            <p className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</p>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mt-0.5">{s.label}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* ── Quick-pick services ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-gray-900 dark:text-white">Quick Pick</h2>
          <Link to="/numbers" className="text-sm text-brand-600 hover:underline">All services →</Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {QUICK_SERVICES.map((svc) => (
            <Link
              key={svc.slug}
              to={`/numbers/otp/service/${svc.slug}`}
              className={`border ${svc.border} ${svc.bg} rounded-xl p-3 text-center hover:opacity-75 transition-opacity`}
            >
              <div className="text-2xl mb-1">{svc.emoji}</div>
              <p className={`text-xs font-medium ${svc.text}`}>{svc.label}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Active numbers ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-gray-900 dark:text-white">Active Numbers</h2>
          {orders.length > 0 && (
            <Link to="/numbers/active" className="text-sm text-brand-600 hover:underline">View all →</Link>
          )}
        </div>

        {loadingActive ? (
          <div className="grid md:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /></div>
        ) : orders.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {orders.slice(0, 4).map((order) => (
              <NumberCard
                key={order._id}
                order={order}
                onCancel={() => handleCancel(order._id)}
                onSmsReceived={refetch}
              />
            ))}
          </div>
        ) : (
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                {['Pick a service', 'Choose a country', 'Receive SMS instantly'].map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    {step}
                  </div>
                ))}
              </div>
              <Link
                to="/numbers"
                className="shrink-0 bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700 transition-colors"
              >
                Get a Number →
              </Link>
            </div>
          </Card>
        )}
      </div>

      {/* ── 7-day usage + Your activity ─────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <UsageSparkline />
        <StreakTile />
      </div>

      {/* ── Trending + Inbox ────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <TrendingServices />
        <RecentSmsInbox />
      </div>

      {/* ── Bottom row: Activity + Referral ────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Recent activity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
            <Link to="/transactions" className="text-sm text-brand-600 hover:underline">View all →</Link>
          </div>
          <Card className="divide-y divide-gray-100 dark:divide-gray-700">
            {loadingTx ? (
              <div className="p-6 text-center text-gray-400 dark:text-gray-500 text-sm">Loading…</div>
            ) : !txData?.transactions?.length ? (
              <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                No transactions yet. Buy credits to get started.
              </div>
            ) : (
              txData.transactions.map((tx) => (
                <div key={tx._id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      tx.type === 'PURCHASE' ? 'bg-green-100 dark:bg-green-900/30'
                      : tx.type === 'SPEND'   ? 'bg-red-100 dark:bg-red-900/30'
                      :                         'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      {tx.type === 'PURCHASE' ? '💳' : tx.type === 'SPEND' ? '📱' : '↩️'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">{tx.description}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{dayjs(tx.createdAt).fromNow()}</p>
                    </div>
                  </div>
                  <span className={`font-mono font-semibold text-sm shrink-0 ml-4 ${
                    tx.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                  }`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </Card>
        </div>

        {/* Referral card */}
        {referralLink && (
          <div className="lg:w-72 shrink-0">
            <h2 className="font-display font-semibold text-gray-900 dark:text-white mb-3">Refer & Earn</h2>
            <Card className="p-5 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/30 dark:to-brand-900/10 border-brand-200 dark:border-brand-800">
              <div className="text-3xl mb-3">🎁</div>
              <p className="font-semibold text-gray-900 dark:text-white mb-1">Invite friends, earn credits</p>
              <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">
                Earn{' '}
                <span className="font-semibold text-brand-600 dark:text-brand-300">10% of your friend's first top-up</span>
                {' '}in bonus credits — automatically.
              </p>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 mb-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Your referral code</p>
                <p className="font-mono font-bold text-brand-600 dark:text-brand-300 tracking-widest text-lg">{user.referralCode}</p>
              </div>
              <button
                onClick={copyReferral}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-brand-700 transition-colors"
              >
                {copied
                  ? <><RiCheckLine size={16} /> Copied!</>
                  : <><RiFileCopyLine size={16} /> Copy Referral Link</>
                }
              </button>
            </Card>
          </div>
        )}
      </div>

    </div>
  );
}
