import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FiCopy, FiCheck, FiArrowLeft } from 'react-icons/fi';
import dayjs from 'dayjs';
import { getOrder } from '../../api/numbers';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium">
      {copied ? <FiCheck size={12} /> : <FiCopy size={12} />} {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => getOrder(orderId).then((r) => r.data.data.order),
  });

  if (isLoading) return <div className="py-12 text-center text-gray-400">Loading...</div>;
  if (!data) return <div className="py-12 text-center text-gray-500">Order not found.</div>;

  const o = data;
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/orders" className="text-gray-400 hover:text-gray-600"><FiArrowLeft size={20} /></Link>
        <div>
          <h1 className="font-display font-bold text-xl text-gray-900">Order Details</h1>
          <p className="text-xs text-gray-400 font-mono">{o._id}</p>
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{o.countryId?.flagEmoji}</span>
            <div>
              <p className="font-semibold text-gray-900">{o.countryId?.name}</p>
              <p className="text-sm text-gray-500">{o.serviceId?.name || (o.orderType === 'RENTAL' ? 'Rental' : 'OTP')}</p>
            </div>
          </div>
          <Badge label={o.status.toLowerCase()} variant={o.status.toLowerCase()} />
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Phone number</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold">{o.phoneNumber}</span>
              <CopyBtn text={o.phoneNumber} />
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Credits charged</span>
            <span className="font-mono font-semibold">{o.creditsCharged} cr</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Ordered at</span>
            <span>{dayjs(o.createdAt).format('MMM D, YYYY HH:mm')}</span>
          </div>
          {o.smsReceivedAt && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">SMS received</span>
              <span>{dayjs(o.smsReceivedAt).format('MMM D, YYYY HH:mm:ss')}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Provider</span>
            <span className="capitalize">{o.provider}</span>
          </div>
        </div>

        {o.smsContent && o.smsContent !== '[deleted]' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-green-700 uppercase tracking-wide">SMS Received ✓</p>
            {o.smsCode && (
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-2xl tracking-widest text-gray-900">{o.smsCode}</span>
                <CopyBtn text={o.smsCode} />
              </div>
            )}
            <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-green-100">{o.smsContent}</p>
          </div>
        )}

        {o.smsMessages?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{o.smsMessages.length} SMS received (rental)</p>
            {[...o.smsMessages].reverse().map((msg, i) => (
              <div key={msg.fivesimId || i} className="bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400">{dayjs(msg.receivedAt).format('MMM D HH:mm:ss')}</span>
                  {msg.code && <div className="flex items-center gap-1"><span className="font-mono font-bold text-brand-600 text-sm">{msg.code}</span><CopyBtn text={msg.code} /></div>}
                </div>
                <p className="text-sm text-gray-700">{msg.text}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
