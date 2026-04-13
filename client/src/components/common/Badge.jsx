const variants = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-gray-100 text-gray-600',
  refunded: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-700',
  banned: 'bg-red-100 text-red-700',
  PURCHASE: 'bg-green-100 text-green-800',
  SPEND: 'bg-red-100 text-red-700',
  REFUND: 'bg-blue-100 text-blue-700',
  ADMIN_ADJUST: 'bg-purple-100 text-purple-700',
  PAYSTACK: 'bg-indigo-100 text-indigo-700',
  CRYPTO: 'bg-orange-100 text-orange-700',
  USER: 'bg-gray-100 text-gray-700',
  ADMIN: 'bg-brand-100 text-brand-700',
};

export default function Badge({ label, variant }) {
  const cls = variants[variant] || variants[label?.toLowerCase()] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
