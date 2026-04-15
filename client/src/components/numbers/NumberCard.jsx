import { useState, useEffect } from 'react';
import { FiCopy, FiCheck, FiX, FiCheckCircle, FiCalendar } from 'react-icons/fi';
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

  const days = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return { days, hrs, mins, secs, expired: seconds === 0 };
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
  const { days, hrs, mins, secs, expired } = useCountdown(order.expiresAt);
  const isRental = order.orderType === 'RENTAL';

  useSocket(
    (data) => {
      if (data.orderId?.toString() !== order._id?.toString()) return;

      if (data.orderType === 'RENTAL' && data.newMessages) {
        // Append new messages to rental card
        setOrder((o) => ({
          ...o,
          smsMessages: [...(o.smsMessages || []), ...data.newMessages],
        }));
        toast.success(`${data.newMessages.length} new SMS received!`);
        onSmsReceived?.();
      } else if (data.orderType !== 'RENTAL') {
        // OTP: single SMS
        setOrder((o) => ({ ...o, smsContent: data.smsContent, smsCode: data.smsCode, status: 'COMPLETED' }));
        toast.success('SMS received!');
        onSmsReceived?.();
      }
    },
    (data) => {
      if (data.orderId?.toString() === order._id?.toString()) {
        onCancel?.();
      }
    }
  );

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data } = await cancelOrder(order._id);
      if (data.data.refunded) {
        toast.success(`Cancelled. ${data.data.creditsRefunded} credits refunded.`);
      } else {
        toast.success(isRental ? 'Rental cancelled.' : 'Number released.');
      }
      onCancel?.();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  const country = order.countryId;
  const service = order.serviceId;

  // Timer display
  const timerText = isRental
    ? expired
      ? 'Expired'
      : days > 0
      ? `${days}d ${hrs}h`
      : `${hrs}h ${String(mins).padStart(2, '0')}m`
    : expired
    ? 'Expired'
    : `${mins}:${String(secs).padStart(2, '0')}`;

  const timerColor = expired
    ? 'bg-red-100 text-red-700'
    : (!isRental && mins < 5) || (isRental && days === 0 && hrs < 1)
    ? 'bg-yellow-100 text-yellow-700'
    : 'bg-gray-100 text-gray-600';

  const messages = order.smsMessages || [];
  const hasAnySms = isRental ? messages.length > 0 : !!order.smsContent;

  return (
    <div className={`bg-white border rounded-xl p-5 shadow-sm transition-all ${hasAnySms ? 'border-green-300' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{country?.flagEmoji}</span>
            <span className="text-sm text-gray-500">{country?.name}</span>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">{service?.name}</span>
            {isRental && (
              <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                <FiCalendar size={10} /> {order.rentalDays}d rental
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono-num font-semibold text-xl text-gray-900 tracking-wider">{order.phoneNumber}</span>
            <CopyButton text={order.phoneNumber} />
          </div>
        </div>
        <div className={`text-sm font-mono-num font-medium px-2.5 py-1 rounded-lg ${timerColor}`}>
          {timerText}
        </div>
      </div>

      {/* SMS section */}
      {isRental ? (
        <RentalSmsSection messages={messages} />
      ) : (
        <OtpSmsSection smsContent={order.smsContent} smsCode={order.smsCode} />
      )}

      {/* Actions */}
      {isRental ? (
        // Rental: cancel only (no refund warning shown inline)
        !expired && (
          <Button variant="outline" size="sm" loading={cancelling} onClick={handleCancel} className="w-full mt-4 text-red-600 border-red-200 hover:bg-red-50">
            <FiX size={14} /> Cancel Rental (no refund)
          </Button>
        )
      ) : order.smsContent ? (
        <Button variant="outline" size="sm" onClick={() => onCancel?.()} className="w-full mt-4 border-green-200 text-green-700 hover:bg-green-50">
          <FiCheckCircle size={14} /> Done — Dismiss
        </Button>
      ) : !expired ? (
        <Button variant="outline" size="sm" loading={cancelling} onClick={handleCancel} className="w-full mt-4">
          <FiX size={14} /> Cancel & Refund
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => onCancel?.()} className="w-full mt-4 text-gray-500">
          Dismiss
        </Button>
      )}
    </div>
  );
}

function OtpSmsSection({ smsContent, smsCode }) {
  if (smsContent) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-0">
        <p className="text-xs text-green-600 font-medium mb-2">SMS Received ✓</p>
        <p className="text-sm text-gray-700 mb-3">{smsContent}</p>
        {smsCode && (
          <div className="flex items-center justify-between bg-white border border-green-200 rounded-lg px-4 py-3">
            <span className="font-mono-num font-bold text-2xl text-gray-900 tracking-widest">{smsCode}</span>
            <CopyButton text={smsCode} />
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 text-gray-500">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
      <span className="text-sm">Waiting for SMS...</span>
    </div>
  );
}

function RentalSmsSection({ messages }) {
  if (messages.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 text-gray-500 mb-0">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
        <span className="text-sm">Waiting for SMS... (rental stays active)</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto mb-0">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{messages.length} message{messages.length !== 1 ? 's' : ''} received</p>
      {[...messages].reverse().map((msg, i) => (
        <div key={msg.fivesimId || i} className="bg-green-50 border border-green-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">{dayjs(msg.receivedAt).format('MMM D, HH:mm:ss')}</span>
            {msg.code && (
              <div className="flex items-center gap-1">
                <span className="font-mono font-bold text-brand-600">{msg.code}</span>
                <CopyButton text={msg.code} />
              </div>
            )}
          </div>
          <p className="text-sm text-gray-700">{msg.text}</p>
        </div>
      ))}
    </div>
  );
}
