import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { forgotPassword } from '../../api/auth';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-display font-bold text-2xl text-gray-900">✓ VerifyNow</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-2">Reset your password</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">📧</div>
              <h2 className="font-semibold text-gray-900 mb-2">Check your inbox</h2>
              <p className="text-sm text-gray-500">If an account with that email exists, we've sent a reset link.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
              <Button type="submit" loading={loading} className="w-full" size="lg">Send Reset Link</Button>
            </form>
          )}
        </div>
        <p className="text-center mt-6 text-sm text-gray-500">
          <Link to="/login" className="text-brand-600 hover:underline">← Back to login</Link>
        </p>
      </div>
    </div>
  );
}
