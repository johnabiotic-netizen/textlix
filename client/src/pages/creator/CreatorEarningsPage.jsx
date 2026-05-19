import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCreatorEarnings } from '../../api/creator';

export default function CreatorEarningsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['creatorEarnings', page],
    queryFn: () => getCreatorEarnings(page).then((r) => r.data.data),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Earnings History</h1>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : !data?.earnings?.length ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">💸</p>
          <p className="font-medium">No earnings yet</p>
          <p className="text-sm mt-1">Share your referral link to start earning</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Top-up</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Commission</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.earnings.map((e) => (
                <tr key={e._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-700">{e.referredUserId?.name || '—'}</td>
                  <td className="px-6 py-4 text-gray-700">${e.amountUSD?.toFixed(2)}</td>
                  <td className="px-6 py-4 text-gray-500">₦{e.usdNgnRate?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-semibold text-emerald-700">₦{e.commissionNaira?.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.status === 'withdrawn' ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>
                      {e.status === 'withdrawn' ? 'Paid out' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400">{new Date(e.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-400">{data.total} total earnings</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40">Prev</button>
                <span className="px-3 py-1.5 text-sm text-gray-500">Page {page} of {data.pages}</span>
                <button disabled={page === data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
