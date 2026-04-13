import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { getTransactions } from '../../api/admin';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import Input from '../../components/common/Input';

const TYPES = ['All', 'PURCHASE', 'SPEND', 'REFUND', 'ADMIN_ADJUST'];

export default function AdminTransactionsPage() {
  const [type, setType] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['adminTransactions', type, search, page],
    queryFn: () => getTransactions({
      page,
      limit: 25,
      ...(type !== 'All' ? { type } : {}),
      ...(search ? { search } : {}),
    }).then((r) => r.data.data),
    keepPreviousData: true,
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl text-gray-900">Transactions</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search user email or name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="sm:w-72"
        />
        <div className="flex gap-2 flex-wrap">
          {TYPES.map((t) => (
            <button key={t} onClick={() => { setType(t); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${type === t ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {t}
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
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.transactions?.length ? data.transactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{dayjs(tx.createdAt).format('MMM D, HH:mm')}</td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/users/${tx.userId?._id}`} className="text-brand-600 hover:underline font-medium">
                        {tx.userId?.name}
                      </Link>
                      <p className="text-xs text-gray-400">{tx.userId?.email}</p>
                    </td>
                    <td className="px-4 py-3"><Badge label={tx.type} variant={tx.type} /></td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{tx.description}</td>
                    <td className={`px-4 py-3 text-right font-mono-num font-semibold whitespace-nowrap ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-gray-500">{tx.balanceAfter}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-400 text-sm">No transactions found</td>
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
