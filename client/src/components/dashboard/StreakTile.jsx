import { useQuery } from '@tanstack/react-query';
import { FiAward, FiZap } from 'react-icons/fi';
import dayjs from 'dayjs';
import { getUsageSparkline } from '../../api/numbers';
import useAuthStore from '../../store/authStore';
import Card from '../common/Card';
import AnimatedNumber from '../common/AnimatedNumber';

/**
 * Derives an activity "streak" from the 7-day sparkline: consecutive days
 * (counting back from today) that had at least one order.
 */
export default function StreakTile() {
  const { user } = useAuthStore();
  const { data } = useQuery({
    queryKey: ['usageSparkline'],
    queryFn: () => getUsageSparkline().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const days = data?.days || [];
  // Streak: walk back from today (last entry) counting consecutive >0 days
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].orders > 0) streak++;
    else break;
  }

  const memberDays = user?.createdAt ? dayjs().diff(dayjs(user.createdAt), 'day') : 0;
  const weeklyOrders = data?.totalOrders ?? 0;

  return (
    <Card className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 flex items-center justify-center">
            <FiAward size={15} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">Your activity</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Stay consistent — keep the streak alive</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="text-4xl">{streak >= 3 ? '🔥' : '🌱'}</div>
        <div>
          <p className="font-display font-bold text-3xl text-amber-700 dark:text-amber-200 leading-none">
            <AnimatedNumber value={streak} duration={1.2} />
            <span className="text-sm font-medium text-amber-600 dark:text-amber-300 ml-1">
              day{streak === 1 ? '' : 's'}
            </span>
          </p>
          <p className="text-xs text-amber-700/70 dark:text-amber-300/70 font-medium mt-0.5">
            {streak === 0 ? 'Order today to start' : `Active streak${streak >= 3 ? ' 🚀' : ''}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-amber-200 dark:border-amber-800">
        <div>
          <p className="text-[10px] text-amber-700/70 dark:text-amber-300/70 font-semibold uppercase tracking-wider">Week</p>
          <p className="font-mono-num font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1">
            <FiZap size={11} className="text-amber-500" />
            <AnimatedNumber value={weeklyOrders} duration={1.2} /> orders
          </p>
        </div>
        <div>
          <p className="text-[10px] text-amber-700/70 dark:text-amber-300/70 font-semibold uppercase tracking-wider">Member</p>
          <p className="font-mono-num font-bold text-sm text-gray-900 dark:text-white">
            <AnimatedNumber value={memberDays} duration={1.4} /> day{memberDays === 1 ? '' : 's'}
          </p>
        </div>
      </div>
    </Card>
  );
}
