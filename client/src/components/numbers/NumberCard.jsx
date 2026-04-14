import { useState, useEffect } from 'react';
import { FiCopy, FiCheck, FiX, FiCheckCircle } from 'react-icons/fi';
import { useSocket } from '../../hooks/useSocket';
import { cancelOrder } from '../../api/numbers';
import Button from '../common/Button';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

function useCountdown(expiresAt) {
  const [seconds, setSeconds] = useState(Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000)));

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return { mins, secs, expired: seconds === 0 };
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
      {copied ? <FiCheck size={16} className="text-green-500" /> : <FiCopy size={16} />}
    </button>
  );
}

export default function NumberCard({ order: initialOrder, onCancel, onSmsReceived }) {
  const [order, setOrder] = useState(initialOrder);
  const [cancelling, setCancelling] = useState(false);
  const { mins, secs, expired } = useCountdown(order.expiresAt);

  useSocket(
    (data) => {
      if (data.orderId === order._id || data.orderId?.toString() === order._id?.toString()) {
        // Update card in place — do NOT call onSmsReceived here because getActiveOrders
        // only returns ACTIVE orders, so a refetch would wipe the card before the user
        // can read/copy the code. The user dismisses it manually with the Done button.
        setOrder((o) => ({ ...o, smsContent: data.smsContent, smsCode: data.smsCode, status: 'COMPLETED' }));
        toast.success('SMS received!');
      }
    },
    (data) => {
      if (data.orderId === order._id || data.orderId?.toString() === order._id?.toString()) {
        onCancel?.();
      }
    }
  );

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data } = await cancelOrder(order._id);
      toast.success(data.data.refunded ? `Cancelled. ${data.data.creditsRefunded} credits refunded.` : 'Number released.');
      onCancel?.();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  const country = order.countryId;
  const service = order.serviceId;

  return (
    <div className={`bg-white border rounded-xl p-5 shadow-sm transition-all ${order.smsContent ? 'border-green-300 animate-pulse-green' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{country?.flagEmoji}</span>
            <span className="text-sm text-gray-500">{country?.name}</span>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">{service?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono-num font-semibold text-xl text-gray-900 tracking-wider">{order.phoneNumber}</span>
            <CopyButton text={order.phoneNumber} />
          </div>
        </div>
        <div className={`text-sm font-mono-num font-medium px-2.5 py-1 rounded-lg ${expired ? 'bg-red-100 text-red-700' : mins < 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
          {expired ? 'Expired' : `${mins}:${String(secs).padStart(2, '0')}`}
        </div>
      </div>

      {order.smsContent ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <p className="text-xs text-green-600 font-medium mb-2">SMS Received ✓</p>
          <p className="text-sm text-gray-700 mb-3">{order.smsContent}</p>
          {order.smsCode && (
            <div className="flex items-center justify-between bg-white border border-green-200 rounded-lg px-4 py-3">
              <span className="font-mono-num font-bold text-2xl text-gray-900 tracking-widest">{order.smsCode}</span>
              <CopyButton text={order.smsCode} />
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center gap-3 text-gray-500">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
          <span className="text-sm">Waiting for SMS...</span>
        </div>
      )}

      {order.smsContent ? (
        // SMS received — let user copy code then dismiss
        <Button variant="outline" size="sm" onClick={() => onCancel?.()} className="w-full border-green-200 text-green-700 hover:bg-green-50">
          <FiCheckCircle size={14} /> Done — Dismiss
        </Button>
      ) : !expired ? (
        <Button variant="outline" size="sm" loading={cancelling} onClick={handleCancel} className="w-full">
          <FiX size={14} /> Cancel & Refund
        </Button>
      ) : (
        // Timer hit zero — dismiss the card (expiry cron refunds automatically)
        <Button variant="outline" size="sm" onClick={() => onCancel?.()} className="w-full text-gray-500">
          Dismiss
        </Button>
      )}
    </div>
  );
}
