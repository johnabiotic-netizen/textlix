import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCreatorMe, updateCreatorBank, requestWithdrawal, getCreatorWithdrawals } from '../../api/creator';
import toast from 'react-hot-toast';

const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function CreatorWithdrawalsPage() {
  const qc = useQueryClient();
  const [editingBank, setEditingBank] = useState(false);
  const [bank, setBank] = useState({ bankName: '', accountNumber: '', accountName: '' });
  const [savingBank, setSavingBank] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const { data: creator } = useQuery({
    queryKey: ['creatorMe'],
    queryFn: () => getCreatorMe().then((r) => r.data.data.creator),
  });

  const { data: withdrawalsData } = useQuery({
    queryKey: ['creatorWithdrawals'],
    queryFn: () => getCreatorWithdrawals().then((r) => r.data.data),
  });

  const handleSaveBank = async (e) => {
    e.preventDefault();
    setSavingBank(true);
    try {
      await updateCreatorBank(bank);
      toast.success('Bank account saved');
      setEditingBank(false);
      qc.invalidateQueries({ queryKey: ['creatorMe'] });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSavingBank(false);
    }
  };

  const handleWithdraw = async () => {
    if (!confirm(`Request withdrawal of ${fmt(creator?.pendingEarningsNaira)}?`)) return;
    setRequesting(true);
    try {
      await requestWithdrawal();
      toast.success('Withdrawal request submitted!');
      qc.invalidateQueries({ queryKey: ['creatorMe'] });
      qc.invalidateQueries({ queryKey: ['creatorWithdrawals'] });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to request withdrawal');
    } finally {
      setRequesting(false);
    }
  };

  const hasBank = creator?.bankAccount?.accountNumber;
  const canWithdraw = creator?.pendingEarningsNaira >= (creator?.minWithdrawalNaira || 50000);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Withdrawals</h1>

      {/* Balance */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500">Available balance</p>
            <p className="text-3xl font-bold text-brand-700">{fmt(creator?.pendingEarningsNaira)}</p>
            <p className="text-xs text-gray-400 mt-1">Minimum: {fmt(creator?.minWithdrawalNaira)}</p>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={!canWithdraw || !hasBank || requesting || creator?.pendingWithdrawal}
            className="px-6 py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {requesting ? 'Requesting...' : 'Request Withdrawal'}
          </button>
        </div>
        {!hasBank && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Set up your bank account below before requesting a withdrawal.</p>}
        {creator?.pendingWithdrawal && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">You have a pending withdrawal being processed.</p>}
        {!canWithdraw && hasBank && !creator?.pendingWithdrawal && (
          <p className="text-xs text-gray-400">You need {fmt((creator?.minWithdrawalNaira || 50000) - (creator?.pendingEarningsNaira || 0))} more to reach the minimum.</p>
        )}
      </div>

      {/* Bank account */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Bank Account</h2>
          {!editingBank && (
            <button onClick={() => { setEditingBank(true); setBank(creator?.bankAccount || { bankName: '', accountNumber: '', accountName: '' }); }} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              {hasBank ? 'Edit' : 'Set up'}
            </button>
          )}
        </div>

        {editingBank ? (
          <form onSubmit={handleSaveBank} className="space-y-3">
            <input required placeholder="Bank Name (e.g. Access Bank)" value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500" />
            <input required placeholder="Account Number" value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500" />
            <input required placeholder="Account Name" value={bank.accountName} onChange={(e) => setBank({ ...bank, accountName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500" />
            <div className="flex gap-2">
              <button type="submit" disabled={savingBank} className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {savingBank ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditingBank(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        ) : hasBank ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Bank</span><span className="font-medium">{creator.bankAccount.bankName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Account Number</span><span className="font-medium font-mono">{creator.bankAccount.accountNumber}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Account Name</span><span className="font-medium">{creator.bankAccount.accountName}</span></div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No bank account set up yet.</p>
        )}
      </div>

      {/* Withdrawal history */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Withdrawal History</h2>
        </div>
        {!withdrawalsData?.withdrawals?.length ? (
          <div className="text-center py-8 text-gray-400 text-sm">No withdrawal history</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {withdrawalsData.withdrawals.map((w) => (
                <tr key={w._id}>
                  <td className="px-6 py-4 font-semibold text-gray-900">{fmt(w.amountNaira)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${w.status === 'paid' ? 'bg-brand-100 text-brand-700' : w.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400">{new Date(w.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
