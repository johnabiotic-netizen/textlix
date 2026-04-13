import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { getCreditHistory } from '../../api/payments';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';

const TABS = ['All', 'PURCHASE', 'SPEND', 'REFUND'];

export default function TransactionHistoryPage() {
  const [tab, setTab] = useState('All');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['txHistory', tab, page],
    queryFn: () => getCreditHistory({ page, limit: 20, ...(tab !== 'All' ? { type: tab } : {}) }).then((r) => r.data.data),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="font-display font-bold text-2xl text-gray-900">Transaction History</h1>

      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
      ) : !data?.transactions?.length ? (
        <EmptyState icon="📊" title="No transactions" description="Buy credits to see your transaction history." />
      ) : (
        <>
          <Card className="divide-y divide-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.transactions.map((tx) => (
                  <tr key={tx._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{dayjs(tx.createdAt).format('MMM D, HH:mm')}</td>
                    <td className="px-4 py-3"><Badge label={tx.type} variant={tx.type} /></td>
                    <td className="px-4 py-3 text-gray-700">{tx.description}</td>
                    <td className={`px-4 py-3 text-right font-mono-num font-semibold whitespace-nowrap ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-gray-500">{tx.balanceAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination page={page} pages={data.pages} total={data.total} limit={20} onPage={setPage} />
        </>
      )}
    </div>
  );
}
