import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { RiCoinLine, RiArrowLeftLine, RiBankCardLine } from 'react-icons/ri';
import { getPackages, initializeKorapay, createOxprocessing, getPaymentHistory } from '../../api/payments';
import useAuthStore from '../../store/authStore';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import dayjs from 'dayjs';

const NGN_RATE = 1600;

const CRYPTO_COINS = [
  {
    id: 'USDT', label: 'USDT', name: 'Tether', symbol: '₮',
    networks: [
      { value: 'USDT', label: 'TRC-20', note: 'Recommended · Lowest fees' },
      { value: 'USDT', label: 'ERC-20', note: '' },
      { value: 'USDT', label: 'BEP-20', note: '' },
    ],
  },
  {
    id: 'BTC', label: 'BTC', name: 'Bitcoin', symbol: '₿',
    networks: [{ value: 'BTC', label: 'Bitcoin', note: '' }],
  },
  {
    id: 'ETH', label: 'ETH', name: 'Ethereum', symbol: 'Ξ',
    networks: [
      { value: 'ETH', label: 'ERC-20', note: '' },
      { value: 'ETH', label: 'BEP-20', note: '' },
    ],
  },
  {
    id: 'USDC', label: 'USDC', name: 'USD Coin', symbol: '$',
    networks: [{ value: 'USDC', label: 'ERC-20', note: '' }],
  },
  {
    id: 'LTC', label: 'LTC', name: 'Litecoin', symbol: 'Ł',
    networks: [{ value: 'LTC', label: 'LTC', note: '' }],
  },
  {
    id: 'DOGE', label: 'DOGE', name: 'Dogecoin', symbol: 'Ð',
    networks: [{ value: 'DOGE', label: 'DOGE', note: '' }],
  },
];

export default function BuyCreditsPage() {
  const { user } = useAuthStore();

  // wizard state
  const [step, setStep] = useState(0); // 0 = method, 1 = details
  const [method, setMethod] = useState(null); // 'naira' | 'crypto'

  // amount state
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [customUSD, setCustomUSD] = useState('');

  // crypto state
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState(null);

  const [loading, setLoading] = useState(false);

  const { data: pkgData } = useQuery({
    queryKey: ['packages'],
    queryFn: () => getPackages().then((r) => r.data.data.packages),
  });

  const { data: payData } = useQuery({
    queryKey: ['paymentHistory'],
    queryFn: () => getPaymentHistory({ page: 1, limit: 10 }).then((r) => r.data.data),
  });

  const amountUSD = selectedPkg ? selectedPkg.amountUSD : parseFloat(customUSD) || 0;
  const estimatedCredits = selectedPkg
    ? selectedPkg.totalCredits
    : Math.floor(amountUSD * 100);

  const chooseMethod = (m) => {
    setMethod(m);
    setSelectedPkg(null);
    setCustomUSD('');
    setSelectedCoin(null);
    setSelectedNetwork(null);
    setStep(1);
  };

  const chooseCoin = (coin) => {
    setSelectedCoin(coin);
    setSelectedNetwork(coin.networks.length === 1 ? coin.networks[0] : null);
  };

  const handlePay = async () => {
    if (amountUSD < 2) { toast.error('Minimum $2 required'); return; }
    if (method === 'crypto' && !selectedNetwork) { toast.error('Select a network to continue'); return; }
    setLoading(true);

    try {
      if (method === 'naira') {
        const body = selectedPkg ? { packageId: selectedPkg.id } : { amountUSD };
        const { data } = await initializeKorapay(body);
        window.location.href = data.data.checkoutUrl;
      } else {
        const body = selectedPkg
          ? { packageId: selectedPkg.id, currency: selectedNetwork.value }
          : { amountUSD, currency: selectedNetwork.value };
        const { data } = await createOxprocessing(body);
        const { formAction, formFields } = data.data;
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = formAction;
        Object.entries(formFields).forEach(([name, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = value;
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const canPay = amountUSD >= 2 && (method === 'naira' || (selectedCoin && selectedNetwork));

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        {step === 1 && (
          <button onClick={() => setStep(0)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RiArrowLeftLine size={20} />
          </button>
        )}
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900">Buy Credits</h1>
          <p className="text-gray-500 text-sm mt-0.5">1 credit = $0.01 USD</p>
        </div>
      </div>

      {/* Balance */}
      <Card className="p-5 bg-amber-50 border-amber-200">
        <div className="flex items-center gap-3">
          <RiCoinLine size={24} className="text-amber-500" />
          <div>
            <p className="text-xs text-amber-600 font-medium">Current Balance</p>
            <p className="font-mono font-bold text-2xl text-amber-700">
              {user?.creditBalance?.toLocaleString()} credits
            </p>
          </div>
        </div>
      </Card>

      {/* ── Step 0: Method selection ────────────────────────────────────────── */}
      {step === 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-4">How would you like to pay?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => chooseMethod('naira')}
              className="border-2 border-gray-200 hover:border-brand-400 rounded-2xl p-6 text-left transition-all group"
            >
              <div className="text-3xl mb-3">💳</div>
              <p className="font-semibold text-gray-900 text-lg group-hover:text-brand-700">Naira Top-Up</p>
              <p className="text-sm text-gray-500 mt-1">Pay with card or bank transfer in NGN via KoraPay</p>
            </button>

            <button
              onClick={() => chooseMethod('crypto')}
              className="border-2 border-gray-200 hover:border-brand-400 rounded-2xl p-6 text-left transition-all group"
            >
              <div className="text-3xl mb-3">₿</div>
              <p className="font-semibold text-gray-900 text-lg group-hover:text-brand-700">Crypto</p>
              <p className="text-sm text-gray-500 mt-1">Pay with USDT, BTC, ETH and more via 0xProcessing</p>
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Amount + details ────────────────────────────────────────── */}
      {step === 1 && (
        <>
          {/* Amount selection */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-3">Choose an amount</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {(pkgData || []).map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => { setSelectedPkg(pkg); setCustomUSD(''); }}
                  className={`border rounded-xl p-3 text-center transition-all ${
                    selectedPkg?.id === pkg.id
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500'
                      : 'border-gray-200 hover:border-brand-300'
                  }`}
                >
                  <p className="font-bold text-lg text-gray-900">${pkg.amountUSD}</p>
                  <p className="text-xs text-gray-500">{pkg.totalCredits.toLocaleString()} cr</p>
                  {pkg.bonus > 0 && (
                    <p className="text-xs text-green-600 font-medium">+{pkg.bonus} bonus</p>
                  )}
                </button>
              ))}

              {/* Custom tile */}
              <button
                onClick={() => setSelectedPkg(null)}
                className={`border rounded-xl p-3 text-center transition-all ${
                  !selectedPkg
                    ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500'
                    : 'border-gray-200 hover:border-brand-300'
                }`}
              >
                <p className="font-bold text-lg text-gray-900">Custom</p>
                <p className="text-xs text-gray-500">Min $2</p>
              </button>
            </div>

            {/* Custom amount input */}
            {!selectedPkg && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">$</span>
                <input
                  type="number"
                  value={customUSD}
                  onChange={(e) => setCustomUSD(e.target.value)}
                  placeholder="Enter amount (min $2)"
                  min="2"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none w-48"
                />
                {amountUSD >= 2 && (
                  <span className="text-sm text-gray-500">
                    = {estimatedCredits.toLocaleString()} credits
                  </span>
                )}
              </div>
            )}

            {/* NGN equivalent for Naira method */}
            {method === 'naira' && amountUSD >= 2 && (
              <p className="mt-2 text-sm text-gray-500">
                ≈ ₦{(amountUSD * NGN_RATE).toLocaleString()} at current rate
              </p>
            )}
          </div>

          {/* ── Crypto: coin + network selection ─────────────────────────────── */}
          {method === 'crypto' && (
            <>
              <div>
                <h2 className="font-semibold text-gray-900 mb-3">Select cryptocurrency</h2>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {CRYPTO_COINS.map((coin) => (
                    <button
                      key={coin.id}
                      onClick={() => chooseCoin(coin)}
                      className={`border rounded-xl p-3 text-center transition-all ${
                        selectedCoin?.id === coin.id
                          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500'
                          : 'border-gray-200 hover:border-brand-300'
                      }`}
                    >
                      <p className="font-mono text-xl font-bold text-gray-700">{coin.symbol}</p>
                      <p className="text-xs font-semibold text-gray-900 mt-1">{coin.label}</p>
                      <p className="text-xs text-gray-400">{coin.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Network selection — shown when coin has >1 network */}
              {selectedCoin && selectedCoin.networks.length > 1 && (
                <div>
                  <h2 className="font-semibold text-gray-900 mb-3">Select network</h2>
                  <div className="flex flex-wrap gap-2">
                    {selectedCoin.networks.map((net) => (
                      <button
                        key={net.label}
                        onClick={() => setSelectedNetwork(net)}
                        className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          selectedNetwork?.label === net.label
                            ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500'
                            : 'border-gray-200 text-gray-600 hover:border-brand-300'
                        }`}
                      >
                        {net.label}
                        {net.note && (
                          <span className="block text-xs font-normal text-green-600">{net.note}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Pay button */}
          <div>
            <Button
              onClick={handlePay}
              loading={loading}
              size="lg"
              disabled={!canPay}
              className="w-full sm:w-auto"
            >
              {method === 'naira'
                ? `Pay ₦${amountUSD >= 2 ? (amountUSD * NGN_RATE).toLocaleString() : '—'}`
                : selectedNetwork
                  ? `Pay $${amountUSD >= 2 ? amountUSD.toFixed(2) : '—'} with ${selectedCoin?.label} (${selectedNetwork.label})`
                  : `Pay with Crypto`}
            </Button>
            {method === 'crypto' && selectedCoin && !selectedNetwork && selectedCoin.networks.length > 1 && (
              <p className="mt-2 text-xs text-amber-600">Select a network above to continue</p>
            )}
          </div>
        </>
      )}

      {/* ── Recent purchases (always visible) ─────────────────────────────── */}
      {payData?.payments?.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Recent Purchases</h2>
          <Card className="divide-y divide-gray-100">
            {payData.payments.map((p) => (
              <div key={p._id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {p.method === 'KORAPAY' ? '💳' : '₿'} ${p.amountUSD}
                  </p>
                  <p className="text-xs text-gray-400">{dayjs(p.createdAt).format('MMM D, YYYY')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-gray-700">+{p.creditsAdded} credits</p>
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
