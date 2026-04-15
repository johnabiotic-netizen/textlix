import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getActiveOrders } from '../../api/numbers';
import NumberCard from '../../components/numbers/NumberCard';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonCard } from '../../components/common/Skeleton';

export default function ActiveNumbersPage() {
  const [displayOrders, setDisplayOrders] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['activeOrders'],
    queryFn: () => getActiveOrders().then((r) => r.data.data),
    // Poll every 15s as a socket fallback — backend now returns recently
    // COMPLETED orders too, so if socket missed the event the card reappears
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  // Merge server data — never remove a card mid-display if it just received SMS
  useEffect(() => {
    if (!data?.orders) return;
    setDisplayOrders((prev) => {
      if (!prev) return data.orders;

      const serverIds = new Set(data.orders.map((o) => o._id?.toString()));

      // Keep pinned cards (SMS arrived, user hasn't dismissed yet) even if
      // the server no longer returns them (>30 min window edge case)
      const pinned = prev.filter((o) => o._pinned && !serverIds.has(o._id?.toString()));

      return [...pinned, ...data.orders];
    });
  }, [data]);

  const handleSmsReceived = useCallback((orderId) => {
    setDisplayOrders((prev) =>
      prev?.map((o) =>
        o._id?.toString() === orderId?.toString() ? { ...o, _pinned: true } : o
      )
    );
  }, []);

  const handleCancel = useCallback(
    (orderId) => {
      setDisplayOrders((prev) =>
        prev?.filter((o) => o._id?.toString() !== orderId?.toString())
      );
      refetch();
    },
    [refetch]
  );

  const orders = displayOrders || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Active Numbers</h1>
          <p className="text-gray-500 text-sm mt-1">SMS arrives here in real-time</p>
        </div>
        <Link to="/numbers" className="text-sm text-brand-600 hover:underline font-medium">
          + Get Another
        </Link>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon="📱"
          title="No active numbers"
          description="Get your first number to start receiving SMS verification codes."
          action={() => window.location.href = '/numbers'}
          actionLabel="Get a Number"
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {orders.map((order) => (
            <NumberCard
              key={order._id}
              order={order}
              onSmsReceived={() => handleSmsReceived(order._id)}
              onCancel={() => handleCancel(order._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
