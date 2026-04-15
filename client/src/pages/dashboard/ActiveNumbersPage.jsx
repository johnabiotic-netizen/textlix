import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getActiveOrders } from '../../api/numbers';
import NumberCard from '../../components/numbers/NumberCard';
import EmptyState from '../../components/common/EmptyState';
import { SkeletonCard } from '../../components/common/Skeleton';

export default function ActiveNumbersPage() {
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['activeOrders'],
    queryFn: () => getActiveOrders().then((r) => r.data.data),
  });

  const orders = data?.orders || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Active Numbers</h1>
          <p className="text-gray-500 text-sm mt-1">SMS arrives here in real-time</p>
        </div>
        <Link to="/numbers" className="text-sm text-brand-600 hover:underline font-medium">+ Get Another</Link>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}</div>
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
            <NumberCard key={order._id} order={order} onCancel={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
