import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import toast from 'react-hot-toast';
import { login } from '../../api/auth';
import { getMe } from '../../api/user';
import useAuthStore from '../../store/authStore';
import api from '../../api/axios';
import Logo from '../../components/common/Logo';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

function TwoFAStep({ tempToken, onSuccess }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/2fa/complete', { tempToken, code });
      onSuccess(data.data.user, data.data.accessToken);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Invalid code');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-2">
        <p className="text-2xl mb-2">🔐</p>
        <h2 className="font-display font-bold text-xl text-gray-900 dark:text-white">Two-Factor Authentication</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter the 6-digit code from your authenticator app</p>
      </div>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-brand-500 outline-none"
        autoFocus
        maxLength={6}
      />
      {error && <p className="text-red-600 dark:text-red-400 text-sm text-center">{error}</p>}
      <Button type="submit" loading={loading} className="w-full" disabled={code.length !== 6}>Verify</Button>
    </form>
  );
}

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [twoFAState, setTwoFAState] = useState(null);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const redirectParam = new URLSearchParams(window.location.search).get('redirect');
  // Strict allowlist — only our own dashboards or the SSO bridge endpoints, never
  // an arbitrary URL (open-redirect guard). The creator SSO bridge is allowed so a
  // logged-out creator gets sent here to sign in, then bounced back through the
  // bridge to land authenticated on creator.textlix.com.
  const isSafeRedirect = (url) =>
    !!url &&
    (url.endsWith('.textlix.com/dashboard') ||
      /^https:\/\/api\.textlix\.com\/api\/v1\/auth\/sso\//.test(url));
  const safeRedirect = isSafeRedirect(redirectParam) ? redirectParam : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await login(form);
      if (data.data.requiresTwoFA) {
        setTwoFAState({ tempToken: data.data.tempToken });
        return;
      }
      const { user, accessToken } = data.data;
      setAuth(user, accessToken);
      toast.success(`Welcome back, ${user.name}!`);
      if (safeRedirect) { window.location.href = safeRedirect; return; }
      navigate(user.role === 'ADMIN' ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/"><Logo textClassName="text-2xl" className="mb-2" /></Link>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Sign in to your account</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {twoFAState ? (
            <TwoFAStep
              tempToken={twoFAState.tempToken}
              onSuccess={(user, token) => { setAuth(user, token); if (safeRedirect) { window.location.href = safeRedirect; } else { navigate('/dashboard'); } }}
            />
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="you@example.com" />
                <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="••••••••" />
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-sm text-brand-600 hover:underline">Forgot password?</Link>
                </div>
                <Button type="submit" loading={loading} className="w-full" size="lg">Sign in</Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-gray-600" /></div>
                <div className="relative flex justify-center text-sm"><span className="bg-white dark:bg-gray-800 px-3 text-gray-400 dark:text-gray-400">or continue with</span></div>
              </div>

              <div className="flex">
                <a href={`${import.meta.env.VITE_API_URL || ''}/api/v1/auth/google`} className="w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <FcGoogle size={18} /> Continue with Google
                </a>
              </div>
            </>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
          Don't have an account? <Link to="/register" className="text-brand-600 font-semibold hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
