import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { verifyPaystack } from '../../api/payments';
import { getMe } from '../../api/user';
import useAuthStore from '../../store/authStore';

export default function PaymentVerifyPage() {
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref');
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [status, setStatus] = useState('verifying');

  useEffect(() => {
    if (!reference) { setStatus('success'); return; }

    const verify = async () => {
      try {
        await verifyPaystack(reference);
        // Refresh user to get updated balance
        const { data } = await getMe();
        useAuthStore.setState({ user: data.data.user });
        setStatus('success');
      } catch {
        setStatus('error');
      }
    };
    verify();
  }, [reference]);

  if (status === 'verifying') return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600 mx-auto mb-4" />
        <p className="text-gray-600">Verifying payment...</p>
      </div>
    </div>
  );

  if (status === 'success') return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="font-display font-bold text-2xl text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-500 mb-8">Your credits have been added to your account.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/dashboard" className="bg-brand-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-brand-700 transition-colors">Go to Dashboard</Link>
          <Link to="/numbers" className="border border-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors">Get a Number</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="font-display font-bold text-2xl text-gray-900 mb-2">Payment Failed</h1>
        <p className="text-gray-500 mb-8">Something went wrong. Please try again.</p>
        <Link to="/credits" className="bg-brand-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-brand-700 transition-colors">Try Again</Link>
      </div>
    </div>
  );
}
