import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FiInbox, FiArrowRight } from 'react-icons/fi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getRecentSms } from '../../api/numbers';
import Card from '../common/Card';

dayjs.extend(relativeTime);

const SERVICE_EMOJI = {
  whatsapp:'💬', telegram:'✈️', google:'🔍', instagram:'📸', facebook:'📘',
  tiktok:'🎵', twitter:'🐦', discord:'🎮', snapchat:'👻', amazon:'📦',
  netflix:'🎬', linkedin:'💼', uber:'🚗', paypal:'💳',
};

export default function RecentSmsInbox() {
  const { data, isLoading } = useQuery({
    queryKey: ['recentSms'],
    queryFn: () => getRecentSms().then((r) => r.data.data),
    refetchInterval: 30000,
    staleTime: 20000,
  });

  const messages = data?.messages || [];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
            <FiInbox size={15} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">SMS Inbox</h3>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Recent codes across all numbers</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Link to="/numbers/history" className="text-xs text-brand-600 dark:text-brand-300 hover:underline">All</Link>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          <FiInbox size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-xs">No SMS yet</p>
          <Link to="/numbers" className="inline-flex items-center gap-1 mt-2 text-xs text-brand-600 dark:text-brand-300 font-semibold hover:underline">
            Get a number <FiArrowRight size={11} />
          </Link>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
          {messages.map((msg, i) => (
            <Link
              key={`${msg.orderId}-${i}`}
              to={`/numbers/${msg.orderId}`}
              className="block p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
            >
              <div className="flex items-start gap-2.5">
                <span className="text-base shrink-0 mt-0.5">{msg.country?.flagEmoji || '📱'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                      {msg.service?.name || (SERVICE_EMOJI[msg.service?.slug] ? msg.service.slug : 'SMS')}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                      {dayjs(msg.receivedAt).fromNow(true)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{msg.text}</p>
                </div>
                {msg.code && (
                  <span className="font-mono-num font-bold text-xs text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded shrink-0">
                    {msg.code}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
