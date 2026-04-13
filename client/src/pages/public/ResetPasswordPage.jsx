import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { resetPassword } from '../../api/auth';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [form, setForm] = useState({ newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await resetPassword({ token, newPassword: form.newPassword });
      toast.success('Password reset! Please log in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-display font-bold text-2xl text-gray-900">✓ TextLix</Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-2">Set new password</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="New password" type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required placeholder="Min. 8 characters" />
            <Input label="Confirm password" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required placeholder="Repeat password" />
            <Button type="submit" loading={loading} className="w-full" size="lg">Reset Password</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
