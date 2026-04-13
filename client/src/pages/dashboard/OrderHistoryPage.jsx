import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { getOrderHistory } from '../../api/numbers';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';

const TABS = ['All', 'COMPLETED', 'EXPIRED', 'REFUNDED'];

export default function OrderHistoryPage() {
  const [tab, setTab] = useState('All');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orderHistory', tab, page],
    queryFn: () => getOrderHistory({ page, limit: 20, ...(tab !== 'All' ? { status: tab } : {}) }).then((r) => r.data.data),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="font-display font-bold text-2xl text-gray-900">Order History</h1>

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
      ) : !data?.orders?.length ? (
        <EmptyState icon="📱" title="No orders" description="Your number rental history will appear here." />
      ) : (
        <>
          <Card className="divide-y divide-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Country</th>
                  <th className="text-left px-4 py-3">Service</th>
                  <th className="text-left px-4 py-3">Number</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Credits</th>
                  <th className="text-center px-4 py-3">SMS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.orders.map((order) => (
                  <>
                    <tr key={order._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === order._id ? null : order._id)}>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{dayjs(order.createdAt).format('MMM D, HH:mm')}</td>
                      <td className="px-4 py-3">{order.countryId?.flagEmoji} {order.countryId?.name}</td>
                      <td className="px-4 py-3">{order.serviceId?.name}</td>
                      <td className="px-4 py-3 font-mono-num text-xs">{order.phoneNumber}</td>
                      <td className="px-4 py-3"><Badge label={order.status.toLowerCase()} variant={order.status.toLowerCase()} /></td>
                      <td className="px-4 py-3 text-right font-mono-num">{order.creditsCharged}</td>
                      <td className="px-4 py-3 text-center">{order.smsContent ? '✓' : '—'}</td>
                    </tr>
                    {expanded === order._id && order.smsContent && (
                      <tr key={`${order._id}-detail`} className="bg-gray-50">
                        <td colSpan="7" className="px-4 py-3">
                          <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
                            <p className="text-xs text-gray-400 mb-1">SMS Content</p>
                            <p className="text-gray-700">{order.smsContent === '[deleted]' ? 'Content deleted (retention period expired)' : order.smsContent}</p>
                            {order.smsCode && order.smsContent !== '[deleted]' && (
                              <p className="font-mono-num font-bold text-brand-600 mt-2 text-lg">{order.smsCode}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
