import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCreatorEarnings } from '../../api/creator';

const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function CreatorEarningsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['creatorEarnings', page],
    queryFn: () => getCreatorEarnings(page).then((r) => r.data.data),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Earnings History</h1>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">Loading...</div>
      ) : !data?.earnings?.length ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <p className="text-4xl mb-3">💸</p>
          <p className="font-medium dark:text-gray-300">No earnings yet</p>
          <p className="text-sm mt-1">Share your referral link to start earning</p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="space-y-3 sm:hidden">
            {data.earnings.map((e) => (
              <div key={e._id} className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-white text-sm">{e.referredUserId?.name || '—'}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.status === 'withdrawn' ? 'bg-gray-100 dark:bg-gray-800 text-gray-500' : 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'}`}>
                    {e.status === 'withdrawn' ? 'Paid out' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Top-up: ${e.amountUSD?.toFixed(2)} · ₦{e.usdNgnRate?.toLocaleString()}/USD</span>
                  <span className="font-bold text-brand-700 dark:text-brand-400">{fmt(e.commissionNaira)}</span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(e.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">User</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Top-up</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rate</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Commission</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {data.earnings.map((e) => (
                    <tr key={e._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{e.referredUserId?.name || '—'}</td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">${e.amountUSD?.toFixed(2)}</td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">₦{e.usdNgnRate?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-semibold text-brand-700 dark:text-brand-400">{fmt(e.commissionNaira)}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.status === 'withdrawn' ? 'bg-gray-100 dark:bg-gray-800 text-gray-500' : 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'}`}>
                          {e.status === 'withdrawn' ? 'Paid out' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 dark:text-gray-500">{new Date(e.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400 dark:text-gray-500">{data.total} total</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 dark:text-gray-300">Prev</button>
                <span className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">Page {page}/{data.pages}</span>
                <button disabled={page === data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 dark:text-gray-300">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
