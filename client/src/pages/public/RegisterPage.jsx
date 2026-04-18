import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import toast from 'react-hot-toast';
import { register } from '../../api/auth';
import useAuthStore from '../../store/authStore';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const payload = { name: form.name, email: form.email, password: form.password };
      if (refCode) payload.referralCode = refCode;
      const { data } = await register(payload);
      const { user, accessToken } = data.data;
      setAuth(user, accessToken);
      toast.success('Account created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 font-display font-bold text-2xl text-gray-900 mb-2"><span>✓</span> TextLix</Link>
          <h1 className="text-xl font-semibold text-gray-900">Create your account</h1>
        </div>

        {refCode && (
          <div className="mb-4 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 text-sm text-brand-700 text-center">
            🎉 You were invited — you'll get started with a bonus when you top up!
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full name" value={form.name} onChange={f('name')} required placeholder="John Doe" />
            <Input label="Email" type="email" value={form.email} onChange={f('email')} required placeholder="you@example.com" />
            <Input label="Password" type="password" value={form.password} onChange={f('password')} required placeholder="Min. 8 characters" />
            <Input label="Confirm password" type="password" value={form.confirm} onChange={f('confirm')} required placeholder="Repeat password" />
            <Button type="submit" loading={loading} className="w-full" size="lg">Create Account</Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-sm"><span className="bg-white px-3 text-gray-400">or continue with</span></div>
          </div>

          <div className="flex">
            <a href={`${import.meta.env.VITE_API_URL || ''}/api/v1/auth/google`} className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <FcGoogle size={18} /> Continue with Google
            </a>
          </div>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          Already have an account? <Link to="/login" className="text-brand-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
