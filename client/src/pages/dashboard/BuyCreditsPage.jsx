import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { RiCoinLine } from 'react-icons/ri';
import { getPackages, initializePaystack, createCrypto, getPaymentHistory } from '../../api/payments';
import useAuthStore from '../../store/authStore';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import dayjs from 'dayjs';

const CURRENCIES = ['USDT', 'BTC', 'ETH'];

export default function BuyCreditsPage() {
  const { user } = useAuthStore();
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [customUSD, setCustomUSD] = useState('');
  const [method, setMethod] = useState('card');
  const [currency, setCurrency] = useState('USDT');
  const [loading, setLoading] = useState(false);

  const { data: pkgData } = useQuery({
    queryKey: ['packages'],
    queryFn: () => getPackages().then((r) => r.data.data.packages),
  });

  const { data: payData } = useQuery({
    queryKey: ['paymentHistory'],
    queryFn: () => getPaymentHistory({ page: 1, limit: 10 }).then((r) => r.data.data),
  });

  const getAmount = () => {
    if (selectedPkg) return selectedPkg.amountUSD;
    return parseFloat(customUSD) || 0;
  };

  const handlePay = async () => {
    const amount = getAmount();
    if (amount < 2) { toast.error('Minimum $2 required'); return; }
    setLoading(true);

    try {
      if (method === 'card') {
        const body = selectedPkg ? { packageId: selectedPkg.id } : { amountUSD: amount };
        const { data } = await initializePaystack(body);
        window.location.href = data.data.authorizationUrl;
      } else {
        const body = selectedPkg ? { packageId: selectedPkg.id, currency } : { amountUSD: amount, currency };
        const { data } = await createCrypto(body);
        window.location.href = data.data.paymentUrl;
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display font-bold text-2xl text-gray-900">Buy Credits</h1>
        <p className="text-gray-500 text-sm mt-1">1 credit = $0.01 USD</p>
      </div>

      {/* Current balance */}
      <Card className="p-5 bg-amber-50 border-amber-200">
        <div className="flex items-center gap-3">
          <RiCoinLine size={24} className="text-amber-500" />
          <div>
            <p className="text-xs text-amber-600 font-medium">Current Balance</p>
            <p className="font-mono-num font-bold text-2xl text-amber-700">{user?.creditBalance?.toLocaleString()} credits</p>
          </div>
        </div>
      </Card>

      {/* Package selection */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Select Package</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(pkgData || []).map((pkg) => (
            <div
              key={pkg.id}
              onClick={() => { setSelectedPkg(pkg); setCustomUSD(''); }}
              className={`border rounded-xl p-4 text-center cursor-pointer transition-all ${selectedPkg?.id === pkg.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500' : 'border-gray-200 hover:border-brand-300'}`}
            >
              <p className="font-bold text-xl text-gray-900">${pkg.amountUSD}</p>
              <p className="text-xs text-gray-500 mt-1">{pkg.totalCredits.toLocaleString()} cr</p>
              {pkg.bonus > 0 && <p className="text-xs text-green-600 font-medium">+{pkg.bonus} bonus</p>}
              <p className="text-xs text-gray-400 mt-1">{pkg.label}</p>
            </div>
          ))}
          <div
            onClick={() => setSelectedPkg(null)}
            className={`border rounded-xl p-4 text-center cursor-pointer transition-all ${!selectedPkg ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500' : 'border-gray-200 hover:border-brand-300'}`}
          >
            <p className="font-bold text-xl text-gray-900">Custom</p>
            <p className="text-xs text-gray-500">Min $2</p>
          </div>
        </div>

        {!selectedPkg && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-500">$</span>
            <input
              type="number"
              value={customUSD}
              onChange={(e) => setCustomUSD(e.target.value)}
              placeholder="Enter amount (min $2)"
              min="2"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
            {customUSD >= 2 && <span className="text-sm text-gray-500">= {Math.floor(customUSD * 100).toLocaleString()} credits</span>}
          </div>
        )}
      </div>

      {/* Payment method */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Payment Method</h2>
        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <button onClick={() => setMethod('card')} className={`border rounded-xl p-4 font-medium text-sm transition-all ${method === 'card' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            💳 Card
          </button>
          <button onClick={() => setMethod('crypto')} className={`border rounded-xl p-4 font-medium text-sm transition-all ${method === 'crypto' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            ₿ Crypto
          </button>
        </div>

        {method === 'crypto' && (
          <div className="flex gap-2 mt-3">
            {CURRENCIES.map((c) => (
              <button key={c} onClick={() => setCurrency(c)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${currency === c ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}>{c}</button>
            ))}
          </div>
        )}
      </div>

      {/* Pay button */}
      <Button onClick={handlePay} loading={loading} size="lg" disabled={getAmount() < 2}>
        {method === 'card' ? '💳' : '₿'} Pay ${getAmount().toFixed(2)}
      </Button>

      {/* Recent payments */}
      {payData?.payments?.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Recent Purchases</h2>
          <Card className="divide-y divide-gray-100">
            {payData.payments.map((p) => (
              <div key={p._id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.method === 'PAYSTACK' ? '💳' : '₿'} ${p.amountUSD}</p>
                  <p className="text-xs text-gray-400">{dayjs(p.createdAt).format('MMM D, YYYY')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono-num text-gray-700">+{p.creditsAdded} credits</p>
                  <Badge label={p.status.toLowerCase()} variant={p.status.toLowerCase()} />
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
