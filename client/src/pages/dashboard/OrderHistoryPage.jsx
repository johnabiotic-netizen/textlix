import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { FiDownload, FiPrinter, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { getOrderHistory } from '../../api/numbers';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';

const TABS = ['All', 'COMPLETED', 'EXPIRED', 'REFUNDED', 'CANCELLED'];

function downloadCSV(orders) {
  const headers = ['Date', 'Country', 'Service', 'Phone Number', 'Status', 'Credits Charged', 'SMS Code', 'SMS Content', 'SMS Received At'];
  const rows = orders.map((o) => [
    dayjs(o.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    `${o.countryId?.flagEmoji || ''} ${o.countryId?.name || ''}`.trim(),
    o.serviceId?.name || '',
    o.phoneNumber || '',
    o.status || '',
    o.creditsCharged || 0,
    o.smsCode && o.smsContent !== '[deleted]' ? o.smsCode : '',
    o.smsContent && o.smsContent !== '[deleted]' ? o.smsContent.replace(/,/g, ';').replace(/\n/g, ' ') : '',
    o.smsReceivedAt ? dayjs(o.smsReceivedAt).format('YYYY-MM-DD HH:mm:ss') : '',
  ]);

  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `textlix-history-${dayjs().format('YYYY-MM-DD')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printHistory(orders) {
  const rows = orders.map((o) => `
    <tr>
      <td>${dayjs(o.createdAt).format('MMM D, YYYY HH:mm')}</td>
      <td>${o.countryId?.flagEmoji || ''} ${o.countryId?.name || ''}</td>
      <td>${o.serviceId?.name || ''}</td>
      <td style="font-family:monospace">${o.phoneNumber || ''}</td>
      <td>${o.status || ''}</td>
      <td>${o.creditsCharged || 0} cr</td>
      <td style="font-family:monospace;font-weight:bold">${o.smsCode && o.smsContent !== '[deleted]' ? o.smsCode : '—'}</td>
      <td style="font-size:11px;max-width:200px">${o.smsContent && o.smsContent !== '[deleted]' ? o.smsContent : '—'}</td>
    </tr>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>TextLix Order History</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      .sub { color: #888; margin-bottom: 16px; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #4f46e5; color: white; padding: 6px 8px; text-align: left; font-size: 11px; }
      td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
      tr:nth-child(even) td { background: #f9fafb; }
      @media print { body { padding: 10px; } }
    </style></head>
    <body>
      <h1>TextLix — Order History</h1>
      <p class="sub">Exported ${dayjs().format('MMMM D, YYYY')} &nbsp;|&nbsp; ${orders.length} orders shown</p>
      <table>
        <thead><tr>
          <th>Date</th><th>Country</th><th>Service</th><th>Phone Number</th>
          <th>Status</th><th>Credits</th><th>Code</th><th>SMS Content</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

export default function OrderHistoryPage() {
  const [tab, setTab] = useState('All');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orderHistory', tab, page],
    queryFn: () => getOrderHistory({ page, limit: 20, ...(tab !== 'All' ? { status: tab } : {}) }).then((r) => r.data.data),
  });

  // Fetch all orders for export (no pagination limit)
  const { data: allData } = useQuery({
    queryKey: ['orderHistoryAll', tab],
    queryFn: () => getOrderHistory({ page: 1, limit: 1000, ...(tab !== 'All' ? { status: tab } : {}) }).then((r) => r.data.data),
    enabled: !!data?.orders?.length,
  });

  const ordersForExport = allData?.orders || data?.orders || [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Order History</h1>
          <p className="text-sm text-gray-500 mt-1">Every number you've rented, with SMS codes received</p>
        </div>
        {ordersForExport.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadCSV(ordersForExport)}>
              <FiDownload size={14} /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => printHistory(ordersForExport)}>
              <FiPrinter size={14} /> Print / PDF
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.charAt(0) + t.slice(1).toLowerCase()}
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
                  <th className="text-left px-4 py-3">Phone Number</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Credits</th>
                  <th className="text-center px-4 py-3">Code</th>
                  <th className="text-center px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.orders.map((order) => (
                  <Fragment key={order._id}>
                    <tr
                      className={`hover:bg-gray-50 ${order.smsContent ? 'cursor-pointer' : ''}`}
                      onClick={() => order.smsContent && setExpanded(expanded === order._id ? null : order._id)}
                    >
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        <div>{dayjs(order.createdAt).format('MMM D, YYYY')}</div>
                        <div className="text-xs text-gray-400">{dayjs(order.createdAt).format('HH:mm')}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="mr-1">{order.countryId?.flagEmoji}</span>
                        {order.countryId?.name}
                      </td>
                      <td className="px-4 py-3">{order.serviceId?.name}</td>
                      <td className="px-4 py-3 font-mono text-xs tracking-wide">{order.phoneNumber}</td>
                      <td className="px-4 py-3">
                        <Badge label={order.status.toLowerCase()} variant={order.status.toLowerCase()} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono-num">
                        <div>{order.creditsCharged} cr</div>
                        <div className="text-xs text-gray-400">${(order.creditsCharged / 100).toFixed(2)}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {order.smsCode && order.smsContent !== '[deleted]' ? (
                          <span className="font-mono font-bold text-brand-600 text-sm">{order.smsCode}</span>
                        ) : order.smsContent === '[deleted]' ? (
                          <span className="text-gray-400 text-xs">deleted</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400">
                        {order.smsContent && order.smsContent !== '[deleted]' && (
                          expanded === order._id ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />
                        )}
                      </td>
                    </tr>
                    {expanded === order._id && order.smsContent && (
                      <tr className="bg-indigo-50">
                        <td colSpan="8" className="px-4 py-4">
                          <div className="space-y-2">
                            {order.smsCode && (
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 uppercase tracking-wide font-medium w-20">Code</span>
                                <span className="font-mono font-bold text-2xl text-brand-600 tracking-widest">{order.smsCode}</span>
                              </div>
                            )}
                            <div className="flex items-start gap-3">
                              <span className="text-xs text-gray-500 uppercase tracking-wide font-medium w-20 pt-0.5">Full SMS</span>
                              <p className="text-sm text-gray-700 flex-1">{order.smsContent}</p>
                            </div>
                            {order.smsReceivedAt && (
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 uppercase tracking-wide font-medium w-20">Received</span>
                                <span className="text-xs text-gray-500">{dayjs(order.smsReceivedAt).format('MMM D, YYYY HH:mm:ss')}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
