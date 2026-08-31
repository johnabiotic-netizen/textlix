import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FiCopy, FiCheck, FiArrowLeft } from 'react-icons/fi';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { getOrder, extendRental } from '../../api/numbers';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { copyToClipboard } from '../../utils/clipboard';

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (!(await copyToClipboard(text))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={onCopy}
      className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium">
      {copied ? <FiCheck size={12} /> : <FiCopy size={12} />} {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => getOrder(orderId).then((r) => r.data.data.order),
  });

  const extendMut = useMutation({
    mutationFn: (days) => extendRental(orderId, days),
    onSuccess: () => {
      toast.success('Rental extended');
      qc.invalidateQueries({ queryKey: ['order', orderId] });
      qc.invalidateQueries({ queryKey: ['activeOrders'] });
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Could not extend the rental'),
  });

  if (isLoading) return <div className="py-12 text-center text-gray-400 dark:text-gray-500">Loading...</div>;
  if (!data) return <div className="py-12 text-center text-gray-500 dark:text-gray-400">Order not found.</div>;

  const o = data;
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/orders" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><FiArrowLeft size={20} /></Link>
        <div>
          <h1 className="font-display font-bold text-xl text-gray-900 dark:text-white">Order Details</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{o._id}</p>
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{o.countryId?.flagEmoji}</span>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{o.countryId?.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{o.serviceId?.name || (o.orderType === 'RENTAL' ? 'Rental' : 'OTP')}</p>
            </div>
          </div>
          <Badge label={o.status.toLowerCase()} variant={o.status.toLowerCase()} />
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Phone number</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold">{o.phoneNumber}</span>
              <CopyBtn text={o.phoneNumber} />
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Credits charged</span>
            <span className="font-mono font-semibold">{o.creditsCharged} cr</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Ordered at</span>
            <span>{dayjs(o.createdAt).format('MMM D, YYYY HH:mm')}</span>
          </div>
          {o.smsReceivedAt && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">SMS received</span>
              <span>{dayjs(o.smsReceivedAt).format('MMM D, YYYY HH:mm:ss')}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Server</span>
            <span>{o.server || '—'}</span>
          </div>
        </div>

        {o.smsContent && o.smsContent !== '[deleted]' && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide">SMS Received ✓</p>
            {o.smsCode && (
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-2xl tracking-widest text-gray-900 dark:text-white">{o.smsCode}</span>
                <CopyBtn text={o.smsCode} />
              </div>
            )}
            <p className="text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-100 dark:border-green-800">{o.smsContent}</p>
          </div>
        )}

        {o.smsMessages?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{o.smsMessages.length} SMS received (rental)</p>
            {[...o.smsMessages].reverse().map((msg, i) => (
              <div key={msg.messageId || i} className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{dayjs(msg.receivedAt).format('MMM D HH:mm:ss')}</span>
                  {msg.code && <div className="flex items-center gap-1"><span className="font-mono font-bold text-brand-600 text-sm">{msg.code}</span><CopyBtn text={msg.code} /></div>}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200">{msg.text}</p>
              </div>
            ))}
          </div>
        )}

        {o.orderType === 'RENTAL' && o.status === 'ACTIVE' && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-500 dark:text-gray-400">Expires</span>
              <span className="font-medium text-gray-900 dark:text-white">{o.expiresAt ? dayjs(o.expiresAt).format('MMM D, YYYY HH:mm') : '—'}</span>
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Extend this rental — keep the same number for longer</p>
            <div className="grid grid-cols-4 gap-2">
              {[7, 14, 21, 30].map((d) => (
                <button
                  key={d}
                  disabled={extendMut.isPending}
                  onClick={() => extendMut.mutate(d)}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg py-2 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:border-brand-400 hover:text-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  +{d} days
                </button>
              ))}
            </div>
            {extendMut.isPending && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Extending…</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
