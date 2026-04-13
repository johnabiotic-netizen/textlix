import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getRevenueReport } from '../../api/admin';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { exportTransactions } from '../../api/admin';
import toast from 'react-hot-toast';

const PERIODS = [
  { label: 'Daily (30d)', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

function StatBox({ label, value, sub }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold font-mono-num text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminReportsPage() {
  const [period, setPeriod] = useState('daily');
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['revenueReport', period],
    queryFn: () => getRevenueReport({ period }).then((r) => r.data.data),
  });

  const chartData = (data?.data || []).map((d) => {
    let name = '';
    if (period === 'daily') name = `${d._id.month}/${d._id.day}`;
    else if (period === 'weekly') name = `W${d._id.week}`;
    else name = `${d._id.year}/${String(d._id.month).padStart(2, '0')}`;
    return {
      name,
      revenue: parseFloat(d.revenue?.toFixed(2) || 0),
      orders: d.count,
    };
  });

  const totalRevenue = (data?.data || []).reduce((sum, d) => sum + (d.revenue || 0), 0);
  const totalOrders = (data?.data || []).reduce((sum, d) => sum + (d.count || 0), 0);
  const avgRevenue = chartData.length ? (totalRevenue / chartData.length).toFixed(2) : '0.00';

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportTransactions();
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl text-gray-900">Reports</h1>
        <Button variant="secondary" size="sm" loading={exporting} onClick={handleExport}>
          Export Transactions CSV
        </Button>
      </div>

      {/* Period toggle */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {PERIODS.map((p) => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} sub={`${chartData.length} periods`} />
        <StatBox label="Total Orders" value={totalOrders.toLocaleString()} sub="Number rentals" />
        <StatBox label="Avg Revenue / Period" value={`$${avgRevenue}`} />
        <StatBox label="Avg Orders / Period" value={chartData.length ? (totalOrders / chartData.length).toFixed(1) : '0'} />
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm text-center py-12">Loading...</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Revenue chart */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Revenue</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`$${v}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#6366F1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Orders chart */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Order Volume</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, 'Orders']} />
                <Line type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Data table */}
          <Card className="p-6 lg:col-span-2">
            <h3 className="font-semibold text-gray-900 mb-4">Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left py-2">Period</th>
                    <th className="text-right py-2">Orders</th>
                    <th className="text-right py-2">Revenue</th>
                    <th className="text-right py-2">Avg / Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {chartData.length ? [...chartData].reverse().map((row) => (
                    <tr key={row.name} className="hover:bg-gray-50">
                      <td className="py-2 font-mono-num text-gray-700">{row.name}</td>
                      <td className="py-2 text-right font-mono-num">{row.orders}</td>
                      <td className="py-2 text-right font-mono-num font-medium">${row.revenue}</td>
                      <td className="py-2 text-right font-mono-num text-gray-500">
                        {row.orders ? `$${(row.revenue / row.orders).toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" className="py-8 text-center text-gray-400 text-sm">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
