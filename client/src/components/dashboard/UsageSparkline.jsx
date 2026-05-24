import { useQuery } from '@tanstack/react-query';
import { FiActivity, FiTrendingUp } from 'react-icons/fi';
import { getUsageSparkline } from '../../api/numbers';
import Card from '../common/Card';
import AnimatedNumber from '../common/AnimatedNumber';

/**
 * Mini bar chart of orders per day for the last 7 days, plus credits spent.
 * Pure SVG so no charting library is loaded just for this.
 */
export default function UsageSparkline() {
  const { data, isLoading } = useQuery({
    queryKey: ['usageSparkline'],
    queryFn: () => getUsageSparkline().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const days = data?.days || [];
  const maxOrders = Math.max(1, ...days.map((d) => d.orders));
  const totalOrders = data?.totalOrders ?? 0;
  const totalCredits = data?.totalCredits ?? 0;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 flex items-center justify-center">
            <FiActivity size={15} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">7-day usage</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Orders + credits spent</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-semibold">
          <FiTrendingUp size={12} />
          <AnimatedNumber value={totalOrders} duration={1.2} />
        </span>
      </div>

      {/* Mini bar chart */}
      <div className="h-20 flex items-end gap-1.5 mb-3">
        {(isLoading ? Array.from({ length: 7 }) : days).map((d, i) => {
          const day = d || { orders: 0, date: '' };
          const heightPct = (day.orders / maxOrders) * 100;
          const isToday = i === 6;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group">
              <div
                className={`w-full rounded-md transition-all duration-300 ${
                  isToday
                    ? 'bg-brand-500 dark:bg-brand-400'
                    : 'bg-brand-200 dark:bg-brand-800 group-hover:bg-brand-300 dark:group-hover:bg-brand-700'
                }`}
                style={{ height: `${Math.max(heightPct, 4)}%`, minHeight: 3 }}
                title={`${day.orders} order${day.orders === 1 ? '' : 's'}`}
              />
            </div>
          );
        })}
      </div>

      {/* Day labels */}
      <div className="flex gap-1.5 mb-3">
        {(days.length ? days : Array.from({ length: 7 })).map((d, i) => {
          const label = d?.date
            ? new Date(d.date).toLocaleDateString('en', { weekday: 'narrow' })
            : '—';
          const isToday = i === 6;
          return (
            <div key={i} className={`flex-1 text-center text-[10px] font-medium ${isToday ? 'text-brand-600 dark:text-brand-300' : 'text-gray-400 dark:text-gray-500'}`}>
              {label}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-xs border-t border-gray-100 dark:border-gray-700 pt-3">
        <span className="text-gray-500 dark:text-gray-400">Credits spent</span>
        <span className="font-mono-num font-bold text-brand-700 dark:text-brand-300">
          <AnimatedNumber value={totalCredits} duration={1.4} />
        </span>
      </div>
    </Card>
  );
}
