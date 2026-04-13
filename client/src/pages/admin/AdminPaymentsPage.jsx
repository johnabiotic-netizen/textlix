import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { getPayments } from '../../api/admin';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import Input from '../../components/common/Input';

const STATUSES = ['All', 'PENDING', 'COMPLETED', 'FAILED'];
const METHODS = ['All', 'PAYSTACK', 'CRYPTO'];

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState('All');
  const [method, setMethod] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['adminPayments', status, method, search, page],
    queryFn: () => getPayments({
      page,
      limit: 25,
      ...(status !== 'All' ? { status } : {}),
      ...(method !== 'All' ? { method } : {}),
      ...(search ? { search } : {}),
    }).then((r) => r.data.data),
    keepPreviousData: true,
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl text-gray-900">Payments</h1>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <Input
          placeholder="Search user or reference..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="sm:w-72"
        />
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${status === s ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {METHODS.map((m) => (
            <button key={m} onClick={() => { setMethod(m); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${method === m ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm text-center py-12">Loading...</p>
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Method</th>
                  <th className="text-left px-4 py-3">Reference</th>
                  <th className="text-right px-4 py-3">USD</th>
                  <th className="text-right px-4 py-3">Credits</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.payments?.length ? data.payments.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{dayjs(p.createdAt).format('MMM D, HH:mm')}</td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/users/${p.userId?._id}`} className="text-brand-600 hover:underline font-medium">
                        {p.userId?.name}
                      </Link>
                      <p className="text-xs text-gray-400">{p.userId?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.method === 'PAYSTACK' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono-num text-xs text-gray-600 max-w-[160px] truncate">{p.externalId}</td>
                    <td className="px-4 py-3 text-right font-mono-num font-medium">${p.amountUSD?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono-num text-green-600">{p.creditsAdded?.toLocaleString()}</td>
                    <td className="px-4 py-3"><Badge label={p.status.toLowerCase()} variant={p.status.toLowerCase()} /></td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-400 text-sm">No payments found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
          {data?.pages > 1 && (
            <Pagination page={page} pages={data.pages} total={data.total} limit={25} onPage={setPage} />
          )}
        </>
      )}
    </div>
  );
}
