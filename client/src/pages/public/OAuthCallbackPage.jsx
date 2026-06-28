import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { trackCompleteRegistration } from '../../utils/analytics';
import { setAttribution } from '../../api/auth';
import { getAttribution, getSessionId } from '../../utils/attribution';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const token = hashParams.get('token');
    const error = hashParams.get('error');

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
      const user = data.data.user;
      setAuth(user, token);
      // OAuth has no new-vs-returning flag, so count it as a signup only when the
      // account was just created (within ~2 min) — avoids logging every login.
      if (user.createdAt && Date.now() - new Date(user.createdAt).getTime() < 120000) {
        trackCompleteRegistration();
        // Stamp first-touch acquisition source for the new account (best-effort).
        setAttribution({ attribution: getAttribution(), sessionId: getSessionId() }).catch(() => {});
      }
      toast.success('Logged in successfully!');
      navigate(user.role === 'ADMIN' ? '/admin' : '/dashboard');
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
