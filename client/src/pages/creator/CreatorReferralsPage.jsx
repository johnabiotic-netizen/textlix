import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCreatorReferrals } from '../../api/creator';

export default function CreatorReferralsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['creatorReferrals', page],
    queryFn: () => getCreatorReferrals(page).then((r) => r.data.data),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Referrals</h1>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : !data?.referrals?.length ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium">No referrals yet</p>
          <p className="text-sm mt-1">Share your referral link to bring in users</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.referrals.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{r.name}</td>
                  <td className="px-6 py-4 text-gray-500">{r.email}</td>
                  <td className="px-6 py-4 text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-400">{data.total} total referrals</p>
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
