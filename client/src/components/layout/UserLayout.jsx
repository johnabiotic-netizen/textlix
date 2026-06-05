import { useState, lazy, Suspense } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from './Navbar';
import { useSocket } from '../../hooks/useSocket';
import { playNotificationSound } from '../../hooks/useNotificationSound';
import { getMe } from '../../api/user';
import useAuthStore from '../../store/authStore';

// Lazy — the chat widget loads as its own chunk only on the authenticated
// surface, so it never enters the public/landing bundle or the initial JS.
const SupportWidget = lazy(() => import('../support/SupportWidget'));

function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: () => axios.get(`${import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1'}/public/settings`).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const banner = data?.announcementBanner;
  if (!banner || dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-4">
      <p className="text-sm text-amber-800 text-center flex-1">📢 {banner}</p>
      <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-700 shrink-0 text-lg leading-none">✕</button>
    </div>
  );
}

function GlobalSmsNotifier() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useSocket(
    (data) => {
      playNotificationSound();
      queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
      const code = data.smsCode;
      toast.success(
        code ? (
          <span>
            SMS received! Code:{' '}
            <strong style={{ fontFamily: 'monospace', letterSpacing: '0.1em', fontSize: '1.05em' }}>{code}</strong>
          </span>
        ) : 'New SMS received on your number!',
        { duration: 8000, id: `sms-${data.orderId}` }
      );
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('SMS received — textlix', {
          body: code ? `Your code: ${code}` : 'Check your active numbers',
          icon: '/icons/icon-192.png',
          tag: `sms-${data.orderId}`,
        });
      }
    },
    () => {},
    async (data) => {
      try {
        const meRes = await getMe();
        useAuthStore.setState({ user: meRes.data.data.user });
      } catch {}
      toast.success(`Payment confirmed! +${data.creditsAdded?.toLocaleString()} credits added.`, { duration: 6000, id: 'payment-completed' });
      navigate('/dashboard');
    }
  );
  return null;
}

export default function UserLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <GlobalSmsNotifier />
      <AnnouncementBanner />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">© {new Date().getFullYear()} textlix. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-gray-500 dark:text-gray-400">
            <Link to="/terms" className="hover:text-gray-700 dark:hover:text-gray-200">Terms</Link>
            <Link to="/privacy" className="hover:text-gray-700 dark:hover:text-gray-200">Privacy</Link>
            <Link to="/support" className="hover:text-gray-700 dark:hover:text-gray-200">Support</Link>
          </div>
        </div>
      </footer>
      <Suspense fallback={null}>
        <SupportWidget />
      </Suspense>
    </div>
  );
}
