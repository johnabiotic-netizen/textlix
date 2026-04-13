import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      toast.error('OAuth login failed');
      navigate('/login');
      return;
    }

    if (!token) {
      navigate('/login');
      return;
    }

    useAuthStore.getState().setAccessToken(token);

    api.get('/user/me').then(({ data }) => {
      setAuth(data.data.user, token);
      toast.success('Logged in successfully!');
      navigate(data.data.user.role === 'ADMIN' ? '/admin' : '/dashboard');
    }).catch(() => {
      navigate('/login');
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600 mx-auto mb-4" />
        <p className="text-gray-600">Signing you in...</p>
      </div>
    </div>
  );
}
