import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiGithub } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import toast from 'react-hot-toast';
import { login } from '../../api/auth';
import { getMe } from '../../api/user';
import useAuthStore from '../../store/authStore';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await login(form);
      const { user, accessToken } = data.data;
      setAuth(user, accessToken);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(user.role === 'ADMIN' ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 font-display font-bold text-2xl text-gray-900 mb-2">
            <span>✓</span> TextLix
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Sign in to your account</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="you@example.com" />
            <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="••••••••" />
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-brand-600 hover:underline">Forgot password?</Link>
            </div>
            <Button type="submit" loading={loading} className="w-full" size="lg">Sign in</Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-sm"><span className="bg-white px-3 text-gray-400">or continue with</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a href={`${import.meta.env.VITE_API_URL || ''}/api/v1/auth/google`} className="flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <FcGoogle size={18} /> Google
            </a>
            <a href={`${import.meta.env.VITE_API_URL || ''}/api/v1/auth/github`} className="flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <FiGithub size={18} /> GitHub
            </a>
          </div>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          Don't have an account? <Link to="/register" className="text-brand-600 font-semibold hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
