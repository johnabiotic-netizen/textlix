import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RiCoinLine } from 'react-icons/ri';
import { FiHash, FiCreditCard } from 'react-icons/fi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import useAuthStore from '../../store/authStore';
import { getActiveOrders } from '../../api/numbers';
import { getCreditHistory } from '../../api/payments';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { SkeletonCard } from '../../components/common/Skeleton';
import NumberCard from '../../components/numbers/NumberCard';
import useDismissedOrders from '../../hooks/useDismissedOrders';

dayjs.extend(relativeTime);

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [displayOrders, setDisplayOrders] = useState(null);
  const { dismiss, isDismissed } = useDismissedOrders();

  const { data: activeData, isLoading: loadingActive, refetch } = useQuery({
    queryKey: ['activeOrders'],
    queryFn: () => getActiveOrders().then((r) => r.data.data),
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!activeData?.orders) return;
    setDisplayOrders(activeData.orders.filter((o) => !isDismissed(o._id?.toString())));
  }, [activeData, isDismissed]);

  const handleCancel = useCallback((orderId) => {
    dismiss(orderId?.toString());
    setDisplayOrders((prev) => prev?.filter((o) => o._id?.toString() !== orderId?.toString()));
    refetch();
  }, [dismiss, refetch]);

  const orders = displayOrders ?? [];

  const { data: txData, isLoading: loadingTx } = useQuery({
    queryKey: ['recentTx'],
    queryFn: () => getCreditHistory({ page: 1, limit: 5 }).then((r) => r.data.data),
  });

  return (
    <div className="space-y-8">
      {/* Welcome bar */}
      <div className="bg-gradient-to-r from-brand-600 to-purple-600 rounded-2xl p-6 md:p-8 text-white">
        <p className="text-brand-100 text-sm mb-1">Welcome back</p>
        <h1 className="font-display font-bold text-3xl mb-4">{user?.name} 👋</h1>
        <div className="flex items-center gap-2 bg-white/20 rounded-xl px-4 py-3 w-fit">
          <RiCoinLine size={20} className="text-yellow-300" />
          <span className="font-mono-num font-semibold text-xl">{user?.creditBalance?.toLocaleString()}</span>
          <span className="text-brand-100 text-sm">credits</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Link to="/numbers">
          <Card hover className="p-6 border-brand-200 bg-brand-50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center text-white text-2xl">📱</div>
              <div>
                <h3 className="font-display font-semibold text-gray-900 text-lg">Get a Number</h3>
                <p className="text-sm text-gray-500">Browse 50+ countries, receive SMS instantly</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/credits">
          <Card hover className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">💳</div>
              <div>
                <h3 className="font-display font-semibold text-gray-900 text-lg">Buy Credits</h3>
                <p className="text-sm text-gray-500">Top up with card or cryptocurrency</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Active numbers */}
      {loadingActive ? (
        <div className="grid md:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /></div>
      ) : orders.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-lg text-gray-900">Active Numbers</h2>
            <Link to="/numbers/active" className="text-sm text-brand-600 hover:underline">View all →</Link>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {orders.slice(0, 4).map((order) => (
              <NumberCard key={order._id} order={order} onCancel={() => handleCancel(order._id)} onSmsReceived={refetch} />
            ))}
          </div>
        </div>
      ) : null}

      {/* Recent activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg text-gray-900">Recent Activity</h2>
          <Link to="/transactions" className="text-sm text-brand-600 hover:underline">View all →</Link>
        </div>
        <Card className="divide-y divide-gray-100">
          {loadingTx ? (
            <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
          ) : txData?.transactions?.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No transactions yet. Buy credits to get started.</div>
          ) : (
            txData?.transactions?.map((tx) => (
              <div key={tx._id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === 'PURCHASE' ? 'bg-green-100' : tx.type === 'SPEND' ? 'bg-red-100' : 'bg-blue-100'}`}>
                    {tx.type === 'PURCHASE' ? '💳' : tx.type === 'SPEND' ? '📱' : '↩️'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                    <p className="text-xs text-gray-400">{dayjs(tx.createdAt).fromNow()}</p>
                  </div>
                </div>
                <span className={`font-mono-num font-semibold text-sm ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
