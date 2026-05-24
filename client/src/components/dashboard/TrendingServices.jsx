import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FiTrendingUp, FiArrowRight } from 'react-icons/fi';
import { getTrendingServices } from '../../api/numbers';
import Card from '../common/Card';

const SERVICE_EMOJI = {
  whatsapp:'💬', telegram:'✈️', google:'🔍', instagram:'📸', facebook:'📘',
  tiktok:'🎵', twitter:'🐦', discord:'🎮', snapchat:'👻', amazon:'📦',
  netflix:'🎬', linkedin:'💼', uber:'🚗', paypal:'💳', spotify:'🎵',
  binance:'🪙', coinbase:'🟦', revolut:'💳', steam:'🎮', apple:'🍎',
};

export default function TrendingServices() {
  const { data, isLoading } = useQuery({
    queryKey: ['trendingServices'],
    queryFn: () => getTrendingServices().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const trending = (data?.trending || []).slice(0, 5);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 flex items-center justify-center">
            <FiTrendingUp size={15} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">Trending now</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Most ordered · last 24h</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : trending.length === 0 ? (
        <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500">
          Quiet right now — be the first to order today.
        </div>
      ) : (
        <div className="space-y-1.5">
          {trending.map((svc, i) => (
            <Link
              key={svc.slug}
              to={`/numbers/otp/service/${svc.slug}`}
              className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
            >
              <span className="text-xs font-bold text-gray-300 dark:text-gray-600 w-4 text-center">{i + 1}</span>
              <span className="text-xl">{SERVICE_EMOJI[svc.slug] || '📱'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{svc.name}</p>
              </div>
              <span className="text-xs font-mono-num text-gray-400 dark:text-gray-500 group-hover:hidden">
                {svc.count}
              </span>
              <FiArrowRight size={14} className="text-brand-600 dark:text-brand-400 hidden group-hover:block" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
