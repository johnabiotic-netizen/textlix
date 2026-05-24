import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api/auth';
import useAuthStore from '../../store/authStore';
import Logo from '../../components/common/Logo';

export default function CreatorLoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await login(form);
      const { user, accessToken } = data.data;
      setAuth(user, accessToken);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Logo textClassName="text-xl" className="justify-center mb-1" />
          <p className="text-xs text-brand-600 dark:text-brand-300 font-medium">Creator Program</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center">Sign in to your account</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                placeholder="you@example.com"
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                placeholder="••••••••"
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
        <div className="mt-4 text-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-gray-600" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-gray-50 dark:bg-gray-900 px-3 text-gray-400 dark:text-gray-400">or</span></div>
          </div>
          <a
            href={`${import.meta.env.VITE_API_URL || ''}/api/v1/auth/sso/creator`}
            className="w-full inline-block text-center border border-gray-300 dark:border-gray-600 rounded-xl py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 transition-colors"
          >
            Continue with textlix.com account
          </a>
        </div>
        <p className="text-center mt-4 text-xs text-gray-500 dark:text-gray-400">
          Don't have a textlix account?{' '}
          <a href="https://www.textlix.com/register" className="text-brand-600 dark:text-brand-300 hover:underline font-medium">Sign up</a>
        </p>
      </div>
    </div>
  );
}
