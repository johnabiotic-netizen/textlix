import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAnalyticsOverview, getAnalyticsTimeseries, exportAnalytics } from '../../api/admin';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import toast from 'react-hot-toast';

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
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

export default function AdminConversionsPage() {
  const [days, setDays] = useState(30);
  const [exporting, setExporting] = useState(false);
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Auto-refresh every 30s so the dashboard feels live.
  const { data: overview, isLoading } = useQuery({
    queryKey: ['analyticsOverview', days],
    queryFn: () => getAnalyticsOverview({ from }).then((r) => r.data.data),
    refetchInterval: 30000,
  });
  const { data: ts } = useQuery({
    queryKey: ['analyticsTimeseries', days],
    queryFn: () => getAnalyticsTimeseries({ from }).then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const totals = overview?.totals || { visits: 0, signups: 0, payingUsers: 0, sales: 0, revenueUSD: 0, visitToSignupPct: 0, signupToPayingPct: 0 };
  const sources = overview?.sources || [];
  const series = (ts?.series || []).map((d) => ({ ...d, name: d.date.slice(5) })); // MM-DD

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const res = await exportAnalytics({ format, from });
      const type =
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([res.data], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `textlix-conversions-${new Date().toISOString().slice(0, 10)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Conversions</h1>
          <p className="text-sm text-gray-400">Where your users come from — visits, signups & revenue by source. Auto-refreshes every 30s.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" loading={exporting} onClick={() => handleExport('xlsx')}>Export Excel</Button>
          <Button variant="secondary" size="sm" loading={exporting} onClick={() => handleExport('pdf')}>Export PDF</Button>
        </div>
      </div>

      {/* Range toggle */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {RANGES.map((r) => (
          <button key={r.days} onClick={() => setDays(r.days)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${days === r.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Funnel KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatBox label="Visits" value={totals.visits.toLocaleString()} />
        <StatBox label="Signups" value={totals.signups.toLocaleString()} sub={`${totals.visitToSignupPct}% of visits`} />
        <StatBox label="Paying Customers" value={totals.payingUsers.toLocaleString()} sub={`${totals.signupToPayingPct}% of signups`} />
        <StatBox label="Sales" value={totals.sales.toLocaleString()} />
        <StatBox label="Revenue" value={`$${totals.revenueUSD.toFixed(2)}`} />
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm text-center py-12">Loading...</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Visits vs signups */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Visits & Signups</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="visits" stroke="#4a7fa7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="signups" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Revenue */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Revenue</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`$${v}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#4a7fa7" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* By-source table */}
          <Card className="p-6 lg:col-span-2">
            <h3 className="font-semibold text-gray-900 mb-4">By Source</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left py-2">Source</th>
                    <th className="text-right py-2">Visits</th>
                    <th className="text-right py-2">Signups</th>
                    <th className="text-right py-2">Paying</th>
                    <th className="text-right py-2">Sales</th>
                    <th className="text-right py-2">Revenue</th>
                    <th className="text-right py-2">Visit→Signup</th>
                    <th className="text-right py-2">Signup→Paying</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sources.length ? sources.map((r) => (
                    <tr key={r.source} className="hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-800 capitalize">{r.source}</td>
                      <td className="py-2 text-right font-mono-num">{r.visits.toLocaleString()}</td>
                      <td className="py-2 text-right font-mono-num">{r.signups.toLocaleString()}</td>
                      <td className="py-2 text-right font-mono-num">{r.payingUsers.toLocaleString()}</td>
                      <td className="py-2 text-right font-mono-num">{r.sales.toLocaleString()}</td>
                      <td className="py-2 text-right font-mono-num font-medium">${r.revenueUSD.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono-num text-gray-500">{r.visitToSignupPct}%</td>
                      <td className="py-2 text-right font-mono-num text-gray-500">{r.signupToPayingPct}%</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="8" className="py-8 text-center text-gray-400 text-sm">No data yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              "unknown" = users who signed up before source tracking was added. "direct" = no ad/referrer detected.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
