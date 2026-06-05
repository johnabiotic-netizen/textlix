import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCreatorMe, updateReferralCode } from '../../api/creator';
import { FiCopy, FiDollarSign, FiUsers, FiTrendingUp, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { copyToClipboard } from '../../utils/clipboard';

const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function CreatorDashboardPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['creatorMe'],
    queryFn: () => getCreatorMe().then((r) => r.data.data.creator),
  });

  const [editingCode, setEditingCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [savingCode, setSavingCode] = useState(false);

  if (isLoading) return <div className="text-center py-20 text-gray-400 dark:text-gray-500">Loading...</div>;

  const c = data;

  const copyLink = async () => {
    const ok = await copyToClipboard(c.referralLink || '');
    if (ok) toast.success('Referral link copied!');
    else toast.error('Copy failed — long-press the link to copy manually');
  };

  const startEditCode = () => {
    setCodeInput(c.referralCode || '');
    setEditingCode(true);
  };

  const saveCode = async () => {
    if (!codeInput.trim()) return;
    setSavingCode(true);
    try {
      await updateReferralCode(codeInput.trim());
      toast.success('Referral code updated!');
      qc.invalidateQueries({ queryKey: ['creatorMe'] });
      setEditingCode(false);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update code');
    } finally {
      setSavingCode(false);
    }
  };

  const referralBase = 'https://www.textlix.com/register?ref=';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back, {c.name.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Your creator dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Pending Earnings', value: fmt(c.pendingEarningsNaira), icon: FiDollarSign, color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/20' },
          { label: 'Total Earned', value: fmt(c.totalEarningsNaira), icon: FiTrendingUp, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Total Referrals', value: c.totalReferrals, icon: FiUsers, color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Referral link + code customization */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Your Referral Link</h2>
          {!editingCode && (
            <button
              onClick={startEditCode}
              className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              <FiEdit2 size={12} /> Customize code
            </button>
          )}
        </div>

        {/* Referral code editor */}
        {editingCode ? (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Your referral code</label>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">textlix.com/register?ref=</span>
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                maxLength={20}
                placeholder="YOURNAME"
                className="flex-1 px-3 py-2 text-sm border border-brand-300 dark:border-gray-600 rounded-lg font-mono focus:ring-2 focus:ring-brand-500 outline-none"
                autoFocus
              />
              <button
                onClick={saveCode}
                disabled={savingCode || !codeInput.trim()}
                className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                <FiCheck size={15} />
              </button>
              <button
                onClick={() => setEditingCode(false)}
                className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              >
                <FiX size={15} />
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Letters, numbers and underscores only (3–20 chars)</p>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">textlix.com/register?ref=</span>
            <span className="font-mono font-bold text-gray-900 dark:text-white bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded text-xs">{c.referralCode}</span>
          </div>
        )}

        {/* Full link + copy */}
        <div className="flex gap-2">
          <input
            readOnly
            value={c.referralLink || `${referralBase}${c.referralCode}`}
            className="flex-1 px-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-mono text-gray-700 dark:text-gray-200"
          />
          <button
            onClick={copyLink}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            <FiCopy size={14} /> Copy
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">Share on WhatsApp, TikTok, Instagram, Facebook. You earn 10% of every top-up your referrals make.</p>
      </div>

      {/* Withdrawal info */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Withdrawals</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Available for withdrawal</p>
            <p className="text-xl font-bold text-brand-700 dark:text-brand-400">{fmt(c.pendingEarningsNaira)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Minimum withdrawal: {fmt(c.minWithdrawalNaira)}</p>
          </div>
          <a href="/withdrawals" className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
            {c.pendingEarningsNaira >= c.minWithdrawalNaira ? 'Withdraw Now' : 'Manage Withdrawals'}
          </a>
        </div>
        {c.pendingWithdrawal && (
          <p className="text-xs text-amber-600 dark:text-amber-300 mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">You have a pending withdrawal request being processed.</p>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        Current USD/NGN rate: ₦{c.currentUsdNgnRate?.toLocaleString()} · Updated hourly
      </p>
    </div>
  );
}
