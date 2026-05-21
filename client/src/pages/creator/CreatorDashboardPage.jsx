import { useQuery } from '@tanstack/react-query';
import { getCreatorMe } from '../../api/creator';
import { FiCopy, FiDollarSign, FiUsers, FiTrendingUp } from 'react-icons/fi';
import toast from 'react-hot-toast';

const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function CreatorDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['creatorMe'],
    queryFn: () => getCreatorMe().then((r) => r.data.data.creator),
  });

  if (isLoading) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  const c = data;

  const copyLink = () => {
    navigator.clipboard.writeText(c.referralLink);
    toast.success('Referral link copied!');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {c.name.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Your creator dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Earnings', value: fmt(c.pendingEarningsNaira), icon: FiDollarSign, color: 'text-brand-600', bg: 'bg-brand-50' },
          { label: 'Total Earned', value: fmt(c.totalEarningsNaira), icon: FiTrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Referrals', value: c.totalReferrals, icon: FiUsers, color: 'text-brand-600', bg: 'bg-brand-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">Your Referral Link</h2>
        <div className="flex gap-2">
          <input
            readOnly
            value={c.referralLink || ''}
            className="flex-1 px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg font-mono text-gray-700"
          />
          <button
            onClick={copyLink}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            <FiCopy size={14} /> Copy
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Share this link on WhatsApp, TikTok, Instagram, Facebook and more. You earn 10% of every top-up your referrals make.</p>
      </div>

      {/* Withdrawal info */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-2">Withdrawals</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Available for withdrawal</p>
            <p className="text-xl font-bold text-brand-700">{fmt(c.pendingEarningsNaira)}</p>
            <p className="text-xs text-gray-400 mt-1">Minimum withdrawal: {fmt(c.minWithdrawalNaira)}</p>
          </div>
          <a href="/withdrawals" className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
            {c.pendingEarningsNaira >= c.minWithdrawalNaira ? 'Withdraw Now' : 'Manage Withdrawals'}
          </a>
        </div>
        {c.pendingWithdrawal && (
          <p className="text-xs text-amber-600 mt-3 bg-amber-50 rounded-lg px-3 py-2">You have a pending withdrawal request being processed.</p>
        )}
      </div>

      {/* Live rate */}
      <p className="text-xs text-gray-400 text-center">
        Current USD/NGN rate: ₦{c.currentUsdNgnRate?.toLocaleString()} · Updated hourly
      </p>
    </div>
  );
}
