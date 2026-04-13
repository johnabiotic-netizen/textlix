import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getDashboard, getRevenueReport } from '../../api/admin';
import Card from '../../components/common/Card';
import { SkeletonCard } from '../../components/common/Skeleton';

function StatCard({ label, value, sub, color = 'brand' }) {
  return (
    <Card className="p-6">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="font-display font-bold text-3xl text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </Card>
  );
}

export default function AdminOverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: () => getDashboard().then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const { data: revenueData } = useQuery({
    queryKey: ['revenueReport', '30d'],
    queryFn: () => getRevenueReport({ period: 'daily' }).then((r) => r.data.data),
  });

  if (isLoading) return <div className="grid grid-cols-4 gap-6">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>;

  const chartData = revenueData?.data?.map((d) => ({
    name: `${d._id.month}/${d._id.day}`,
    revenue: d.revenue.toFixed(2),
    orders: d.count,
  })) || [];

  return (
    <div className="space-y-8">
      <h1 className="font-display font-bold text-2xl text-gray-900">Overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Revenue Today" value={`$${data?.revenue?.today?.toFixed(2) || '0.00'}`} sub={`$${data?.revenue?.month?.toFixed(2)} this month`} />
        <StatCard label="Active Users Today" value={data?.users?.active_today || 0} sub={`${data?.users?.total} total`} />
        <StatCard label="Active Numbers" value={data?.numbers?.active_now || 0} sub={`${data?.numbers?.total_ordered} total ordered`} />
        <StatCard label="Success Rate" value={`${data?.numbers?.success_rate || 0}%`} sub="Last 7 days" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Revenue (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`$${v}`, 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#6366F1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Credits Summary</h3>
          <div className="space-y-4">
            {[
              { label: 'Purchased', value: data?.credits?.total_purchased || 0, color: 'text-green-600' },
              { label: 'Spent', value: data?.credits?.total_spent || 0, color: 'text-red-600' },
              { label: 'Refunded', value: data?.credits?.total_refunded || 0, color: 'text-blue-600' },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-sm text-gray-500">{item.label}</span>
                <span className={`font-mono-num font-semibold ${item.color}`}>{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">New users today</span>
              <span className="font-medium text-gray-900">{data?.users?.new_today || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Revenue this week</span>
              <span className="font-medium text-gray-900">${data?.revenue?.week?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Revenue total</span>
              <span className="font-medium text-gray-900">${data?.revenue?.total?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
