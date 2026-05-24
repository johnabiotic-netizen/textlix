import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { verifyKorapay } from '../../api/payments';
import { getMe } from '../../api/user';
import useAuthStore from '../../store/authStore';
import { useSocket } from '../../hooks/useSocket';

export default function PaymentVerifyPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const reference = params.get('reference') || params.get('trxref');
  const isCancelPage = location.pathname === '/payments/cancel';
  const isSuccessPage = location.pathname === '/payments/success';

  // Determine initial status based on route + params
  const getInitialStatus = () => {
    if (isCancelPage) return 'cancelled';
    if (isSuccessPage && !reference) return 'crypto_pending';
    if (!reference) return 'cancelled';
    return 'verifying';
  };

  const [status, setStatus] = useState(getInitialStatus);
  const [countdown, setCountdown] = useState(5);

  // Listen for payment:completed socket event while on the crypto pending screen
  const handlePaymentCompleted = useCallback(async () => {
    if (status !== 'crypto_pending') return;
    try {
      const meRes = await getMe();
      useAuthStore.setState({ user: meRes.data.data.user });
    } catch (_) {}
    setStatus('success');
  }, [status]);

  useSocket(null, null, handlePaymentCompleted);

  // KoraPay verify flow (reference present)
  useEffect(() => {
    if (status !== 'verifying' || !reference) return;

    const verify = async () => {
      try {
        const { data } = await verifyKorapay(reference);
        const payment = data?.data?.payment;

        if (payment?.status === 'COMPLETED') {
          const meRes = await getMe();
          useAuthStore.setState({ user: meRes.data.data.user });
          setStatus('success');
        } else {
          setStatus('cancelled');
        }
      } catch {
        setStatus('error');
      }
    };
    verify();
  }, [reference, status]);

  // Auto-redirect to dashboard after success
  useEffect(() => {
    if (status !== 'success') return;
    if (countdown <= 0) { navigate('/dashboard'); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown, navigate]);

  if (status === 'verifying') return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-300">Verifying payment...</p>
      </div>
    </div>
  );

  if (status === 'crypto_pending') return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">⏳</div>
        <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-2">Payment Submitted</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-2">Your crypto payment was received. Credits will be added to your account once the transaction is confirmed on-chain.</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">This page will update automatically — you can also check your balance in a few minutes.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/dashboard" className="bg-brand-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-brand-700 transition-colors">Go to Dashboard</Link>
          <Link to="/credits" className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Buy More</Link>
        </div>
      </div>
    </div>
  );

  if (status === 'success') return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-2">Payment Successful!</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-2">Your credits have been added to your account.</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">Redirecting to dashboard in {countdown}s…</p>
        <div className="flex gap-3 justify-center">
          <Link to="/dashboard" className="bg-brand-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-brand-700 transition-colors">Go to Dashboard</Link>
          <Link to="/numbers" className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Get a Number</Link>
        </div>
      </div>
    </div>
  );

  if (status === 'cancelled') return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">↩️</div>
        <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-2">Payment Cancelled</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">No charge was made. You can try again whenever you're ready.</p>
        <Link to="/credits" className="bg-brand-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-brand-700 transition-colors">Back to Buy Credits</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="font-display font-bold text-2xl text-gray-900 dark:text-white mb-2">Verification Failed</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">Something went wrong. Please try again.</p>
        <Link to="/credits" className="bg-brand-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-brand-700 transition-colors">Try Again</Link>
      </div>
    </div>
  );
}
