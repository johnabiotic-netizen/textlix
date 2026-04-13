import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { getOrders } from '../../api/admin';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import Input from '../../components/common/Input';

const STATUSES = ['All', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'REFUNDED'];

export default function AdminOrdersPage() {
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adminOrders', status, search, page],
    queryFn: () => getOrders({
      page,
      limit: 25,
      ...(status !== 'All' ? { status } : {}),
      ...(search ? { search } : {}),
    }).then((r) => r.data.data),
    keepPreviousData: true,
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl text-gray-900">Number Orders</h1>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <Input
          placeholder="Search user, number, service..."
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
                  <th className="text-left px-4 py-3">Number</th>
                  <th className="text-left px-4 py-3">Country</th>
                  <th className="text-left px-4 py-3">Service</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Credits</th>
                  <th className="text-center px-4 py-3">SMS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.orders?.length ? data.orders.map((order) => (
                  <>
                    <tr key={order._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === order._id ? null : order._id)}>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{dayjs(order.createdAt).format('MMM D, HH:mm')}</td>
                      <td className="px-4 py-3">
                        <Link to={`/admin/users/${order.userId?._id}`} className="text-brand-600 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
                          {order.userId?.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono-num text-xs">{order.phoneNumber}</td>
                      <td className="px-4 py-3">{order.countryId?.flagEmoji} {order.countryId?.name}</td>
                      <td className="px-4 py-3">{order.serviceId?.name}</td>
                      <td className="px-4 py-3"><Badge label={order.status.toLowerCase()} variant={order.status.toLowerCase()} /></td>
                      <td className="px-4 py-3 text-right font-mono-num">{order.creditsCharged}</td>
                      <td className="px-4 py-3 text-center">{order.smsContent ? '✓' : '—'}</td>
                    </tr>
                    {expanded === order._id && (
                      <tr key={`${order._id}-detail`} className="bg-gray-50">
                        <td colSpan="8" className="px-4 py-3">
                          <div className="grid sm:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Provider Order ID</p>
                              <p className="font-mono-num text-gray-700">{order.providerOrderId || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Expires At</p>
                              <p className="text-gray-700">{order.expiresAt ? dayjs(order.expiresAt).format('MMM D, HH:mm:ss') : '—'}</p>
                            </div>
                            {order.smsContent && (
                              <div className="sm:col-span-2 bg-white border border-gray-200 rounded-lg p-3">
                                <p className="text-xs text-gray-400 mb-1">SMS Content</p>
                                <p className="text-gray-700">{order.smsContent === '[deleted]' ? 'Content deleted (retention expired)' : order.smsContent}</p>
                                {order.smsCode && order.smsContent !== '[deleted]' && (
                                  <p className="font-mono-num font-bold text-brand-600 mt-2 text-lg">{order.smsCode}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )) : (
                  <tr>
                    <td colSpan="8" className="px-4 py-8 text-center text-gray-400 text-sm">No orders found</td>
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
